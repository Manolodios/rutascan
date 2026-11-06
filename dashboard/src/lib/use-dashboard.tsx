import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	api,
	type DashboardSummary,
	type LicenseInfo,
	type LiveMap,
	type SecurityEventOut,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type DashboardState = {
	summary: DashboardSummary | null;
	liveMap: LiveMap | null;
	license: LicenseInfo | null;
	securityEvents: SecurityEventOut[];
	error: string | null;
	loading: boolean;
	lastUpdated: Date | null;
	reload: () => Promise<void>;
};

const POLL_MS = 30_000;

const DashboardContext = createContext<DashboardState | null>(null);

/**
 * Single source of truth for the dashboard data.
 *
 * The header (notification badge) and the dashboard view share this provider,
 * so the panel makes one set of requests every 30 s instead of one per
 * consumer. Drivers are skipped entirely: they have no access to the admin
 * endpoints and used to receive a 403 every poll.
 */
export function DashboardProvider({ children }: { children: ReactNode }) {
	const { logged, user } = useAuth();
	const enabled = logged && user?.role !== "DRIVER";
	const isAdmin = user?.role === "ADMIN";

	const [summary, setSummary] = useState<DashboardSummary | null>(null);
	const [liveMap, setLiveMap] = useState<LiveMap | null>(null);
	const [license, setLicense] = useState<LicenseInfo | null>(null);
	const [securityEvents, setSecurityEvents] = useState<SecurityEventOut[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(enabled);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	const inFlight = useRef(false);
	const alive = useRef(true);

	const load = useCallback(async () => {
		if (!enabled || inFlight.current) return;
		if (typeof document !== "undefined" && document.visibilityState === "hidden") {
			return;
		}
		inFlight.current = true;
		try {
			const [s, m, l, events] = await Promise.all([
				api<DashboardSummary>("/api/v1/admin/dashboard/summary"),
				api<LiveMap>("/api/v1/admin/dashboard/live-map"),
				isAdmin
					? api<LicenseInfo>("/api/v1/admin/license").catch(() => null)
					: Promise.resolve<LicenseInfo | null>(null),
				api<SecurityEventOut[]>("/api/v1/admin/security-events?limit=5").catch(
					() => [] as SecurityEventOut[],
				),
			]);
			if (!alive.current) return;
			setSummary(s);
			setLiveMap(m);
			setLicense(l);
			setSecurityEvents(events);
			setError(null);
			setLastUpdated(new Date());
		} catch (err) {
			if (!alive.current) return;
			setError(err instanceof Error ? err.message : "Error al cargar el panel");
		} finally {
			inFlight.current = false;
			if (alive.current) setLoading(false);
		}
	}, [enabled, isAdmin]);

	useEffect(() => {
		alive.current = true;
		if (!enabled) {
			return () => {
				alive.current = false;
			};
		}

		void load();
		const timer = setInterval(() => void load(), POLL_MS);
		const onVisibility = () => {
			if (document.visibilityState === "visible") void load();
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			alive.current = false;
			clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [enabled, load]);

	const value = useMemo<DashboardState>(
		() => ({
			summary,
			liveMap,
			license,
			securityEvents,
			error,
			loading,
			lastUpdated,
			reload: load,
		}),
		[summary, liveMap, license, securityEvents, error, loading, lastUpdated, load],
	);

	return (
		<DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
	);
}

export function useDashboardData(): DashboardState {
	const ctx = useContext(DashboardContext);
	if (!ctx) {
		throw new Error("useDashboardData debe usarse dentro de <DashboardProvider>");
	}
	return ctx;
}
