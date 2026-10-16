/**
 * RutaScan API client (ported from web/js/api.js).
 * JWT session persisted in localStorage with automatic refresh-on-401.
 */

const STORAGE_KEY = "rutascan.session.v1";

export type Role = "ADMIN" | "WAREHOUSE" | "DRIVER";

export type SessionUser = {
	id: string;
	user_cedula: string;
	full_name: string;
	role: Role;
	is_active: boolean;
};

export type SessionCompany = {
	id: string;
	name: string;
	tax_id: string;
	license_key: string;
};

export type LicenseSnapshot = {
	subscription_status: string;
	days_remaining: number;
	max_trucks: number;
	active_devices?: number;
	expiration_date?: string;
};

export type Session = {
	access_token: string;
	refresh_token: string;
	token_type?: string;
	expires_in?: number;
	user: SessionUser;
	company?: SessionCompany;
	license?: LicenseSnapshot;
	grace_token?: string;
	grace_expires_at?: string;
};

export class ApiError extends Error {
	status: number;
	code: string | null;

	constructor(status: number, message?: string, code?: string | null) {
		super(message || "Error inesperado");
		this.name = "ApiError";
		this.status = status;
		this.code = code ?? null;
	}
}

let session: Session | null = loadSession();
let refreshing: Promise<string> | null = null;

function loadSession(): Session | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

export function getSession(): Session | null {
	return session;
}

export function setSession(data: Partial<Session>): void {
	session = { ...(session ?? ({} as Session)), ...data } as Session;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
	session = null;
	localStorage.removeItem(STORAGE_KEY);
	// Let React know the session went away (e.g. a failed token refresh).
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("rutascan:session-lost"));
	}
}

export function isLogged(): boolean {
	return Boolean(session?.access_token && session?.user);
}

type ApiOptions = {
	method?: string;
	body?: unknown;
	form?: FormData | null;
	expect?: "json" | "blob" | "none";
};

async function refreshTokens(): Promise<string> {
	const refresh = session?.refresh_token;
	if (!refresh) throw new ApiError(401, "Sin sesión", "NO_SESSION");
	const res = await fetch("/auth/refresh", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refresh_token: refresh }),
	});
	if (!res.ok) throw new ApiError(401, "Sesión expirada", "SESSION_EXPIRED");
	const data = (await res.json()) as Session;
	setSession(data);
	return data.access_token;
}

/**
 * api("/api/v1/admin/dashboard/summary")
 * api("/auth/login", { method: "POST", body: { cedula, pin } })
 */
export async function api<T = unknown>(
	path: string,
	{ method = "GET", body = null, form = null, expect = "json" }: ApiOptions = {},
): Promise<T> {
	const headers: Record<string, string> = {};
	if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

	let payload: BodyInit | null = null;
	if (form) {
		payload = form;
	} else if (body !== null && body !== undefined) {
		headers["Content-Type"] = "application/json";
		payload = JSON.stringify(body);
	}

	let res = await fetch(path, { method, headers, body: payload });

	if (res.status === 401 && session?.refresh_token && !path.startsWith("/auth/refresh")) {
		try {
			refreshing = refreshing ?? refreshTokens().finally(() => (refreshing = null));
			await refreshing;
		} catch {
			clearSession();
			throw new ApiError(401, "Sesión expirada, vuelva a iniciar sesión.", "SESSION_EXPIRED");
		}
		headers.Authorization = `Bearer ${session?.access_token}`;
		res = await fetch(path, { method, headers, body: payload });
	}

	if (!res.ok) {
		let data: { detail?: unknown; code?: string; errors?: Array<{ msg?: string }> } | null = null;
		try {
			data = await res.json();
		} catch {
			/* not json */
		}
		let message = `Error ${res.status}`;
		if (data) {
			if (typeof data.detail === "string") message = data.detail;
			else if (data.detail && typeof data.detail === "object" && "detail" in data.detail)
				message = String((data.detail as { detail?: unknown }).detail ?? message);
			else if (Array.isArray(data.errors) && data.errors[0]?.msg) message = data.errors[0].msg;
		}
		if (res.status === 401) clearSession();
		throw new ApiError(res.status, message, data?.code ?? null);
	}

	if (expect === "blob") return (await res.blob()) as T;
	if (expect === "none" || res.status === 204) return null as T;
	const text = await res.text();
	return (text ? JSON.parse(text) : null) as T;
}

export async function login(cedula: string, pin: string): Promise<Session> {
	const data = await api<Session>("/auth/login", {
		method: "POST",
		body: { cedula, pin },
	});
	setSession(data);
	return data;
}

export async function logout(): Promise<void> {
	const refresh = session?.refresh_token;
	try {
		await api("/auth/logout", {
			method: "POST",
			body: { refresh_token: refresh },
			expect: "none",
		});
	} catch {
		/* ignore */
	}
	clearSession();
}

/* ------------------------------- API types ------------------------------- */

export type DashboardSummary = {
	date: string;
	routes: { total: number; pending: number; in_progress: number; completed: number };
	trucks: { total: number; active_on_route: number };
	deliveries: {
		assigned: number;
		delivered: number;
		rejected: number;
		in_truck: number;
		returns_pending: number;
		completion_pct: number;
	};
	alerts: { security_events_24h: number; by_type: Record<string, number> };
	weekly: Array<{ date: string; DELIVER: number; REJECT: number; LOAD: number }>;
	recent_activity: ActivityRow[];
};

export type ActivityRow = {
	id: string;
	action: "DELIVER" | "REJECT" | "LOAD";
	product: string;
	barcode: string;
	driver: string;
	at: string;
	scan_at: string;
	offline: boolean;
	flags: Record<string, unknown>;
	latitude: number | null;
	longitude: number | null;
	rejection_reason: string | null;
};

export type LiveMapTruck = {
	route_id: string;
	route_status: string;
	truck: { id: string | null; license_plate: string; model: string | null };
	driver: { id: string; full_name: string } | null;
	counts: { in_truck: number; delivered: number; rejected: number };
	assigned_units: number;
	delivered_units: number;
	completion_pct: number;
	last_position: {
		latitude: number | null;
		longitude: number | null;
		at: string;
		action: string;
		minutes_ago: number;
		mock_gps: boolean;
	} | null;
};

export type LiveMap = { date: string; trucks: LiveMapTruck[] };

export type LicenseInfo = {
	license_key: string;
	subscription_status: string;
	expiration_date: string;
	days_remaining: number;
	max_trucks: number;
	is_active: boolean;
	active_devices?: number;
	devices?: Array<{ id: string; device_uuid: string; platform: string; is_blocked: boolean }>;
};
