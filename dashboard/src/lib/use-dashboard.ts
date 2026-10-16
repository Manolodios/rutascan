import { useCallback, useEffect, useState } from "react";
import {
	api,
	type DashboardSummary,
	type LicenseInfo,
	type LiveMap,
} from "@/lib/api";

export type DashboardState = {
	summary: DashboardSummary | null;
	liveMap: LiveMap | null;
	license: LicenseInfo | null;
	error: string | null;
	loading: boolean;
	lastUpdated: Date | null;
	reload: () => Promise<void>;
};

const POLL_MS = 30_000;

export function useDashboardData(): DashboardState {
	const [summary, setSummary] = useState<DashboardSummary | null>(null);
	const [liveMap, setLiveMap] = useState<LiveMap | null>(null);
	const [license, setLicense] = useState<LicenseInfo | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	const load = useCallback(async () => {
		try {
			const [s, m, l] = await Promise.all([
				api<DashboardSummary>("/api/v1/admin/dashboard/summary"),
				api<LiveMap>("/api/v1/admin/dashboard/live-map"),
				api<LicenseInfo>("/api/v1/admin/license").catch(() => null),
			]);
			setSummary(s);
			setLiveMap(m);
			setLicense(l);
			setError(null);
			setLastUpdated(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al cargar el panel");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
		const timer = setInterval(() => void load(), POLL_MS);
		return () => clearInterval(timer);
	}, [load]);

	return { summary, liveMap, license, error, loading, lastUpdated, reload: load };
}
