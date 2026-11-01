/**
 * RutaScan API client.
 * JWT session persisted in localStorage with automatic refresh-on-401.
 */

const STORAGE_KEY = "rutascan.session.v1";

/** Flag consumed by the login screen after a forced logout. */
export const SESSION_EXPIRED_FLAG = "rutascan:session-expired";

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

export function clearSession(reason: "expired" | "logout" = "logout"): void {
	session = null;
	localStorage.removeItem(STORAGE_KEY);
	// Let React know the session went away (e.g. a failed token refresh).
	if (typeof window !== "undefined") {
		if (reason === "expired") {
			try {
				sessionStorage.setItem(SESSION_EXPIRED_FLAG, "1");
			} catch {
				/* storage no disponible */
			}
		}
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

/** Raw fetch with the bearer token + single-flight refresh-on-401. */
async function request(
	path: string,
	{ method = "GET", body = null, form = null }: ApiOptions = {},
): Promise<Response> {
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
			clearSession("expired");
			throw new ApiError(401, "Sesión expirada, vuelva a iniciar sesión.", "SESSION_EXPIRED");
		}
		headers.Authorization = `Bearer ${session?.access_token}`;
		res = await fetch(path, { method, headers, body: payload });
	}

	return res;
}

/** Turns a failed response into an ApiError, reading the backend's message. */
async function toApiError(res: Response): Promise<ApiError> {
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
	if (res.status === 401 && session) clearSession("expired");
	if (res.status === 402 && data?.code?.startsWith("SUBSCRIPTION_")) {
		window.dispatchEvent(new CustomEvent("rutascan:license-blocked"));
	}
	return new ApiError(res.status, message, data?.code ?? null);
}

/**
 * api("/api/v1/admin/dashboard/summary")
 * api("/auth/login", { method: "POST", body: { cedula, pin } })
 */
export async function api<T = unknown>(
	path: string,
	{ expect = "json", ...opts }: ApiOptions = {},
): Promise<T> {
	const res = await request(path, opts);
	if (!res.ok) throw await toApiError(res);

	if (expect === "blob") return (await res.blob()) as T;
	if (expect === "none" || res.status === 204) return null as T;
	const text = await res.text();
	return (text ? JSON.parse(text) : null) as T;
}

/** Downloads a server-generated file, honouring its Content-Disposition name. */
export async function downloadFile(path: string, fallbackName: string): Promise<string> {
	const res = await request(path, {});
	if (!res.ok) throw await toApiError(res);

	const blob = await res.blob();
	const disposition = res.headers.get("Content-Disposition") || "";
	const match = /filename="?([^";]+)"?/.exec(disposition);
	const name = match ? match[1] : fallbackName;

	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 5000);
	return name;
}

/** Opens a server-generated binary (e.g. a QR PNG) in a new tab. */
export async function openBlobInTab(path: string): Promise<void> {
	const res = await request(path, {});
	if (!res.ok) throw await toApiError(res);

	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	window.open(url, "_blank", "noopener");
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
	company_name: string;
	tax_id: string;
	subscription_status: string;
	expiration_date: string;
	days_remaining: number;
	expiring_soon: boolean;
	expired: boolean;
	max_trucks: number;
	active_devices: number;
	device_ttl_days: number;
	devices: DeviceOut[];
};

/* ------------------------- admin resource types -------------------------- */

export type UserBrief = {
	id: string;
	user_cedula: string;
	full_name: string;
	role: Role;
};

export type TruckBrief = {
	id: string;
	license_plate: string;
	model: string | null;
	is_active: boolean;
};

export type TruckOut = TruckBrief & {
	assigned_driver: UserBrief | null;
	has_route_today: boolean;
	route_status_today: string | null;
};

export type UserOut = UserBrief & {
	is_active: boolean;
	last_login_at: string | null;
	created_at: string;
};

export type ProductOut = {
	id: string;
	barcode_qr: string;
	description: string;
	unit: string;
	weight: number;
	is_active: boolean;
	created_at: string;
};

export type RouteCounts = {
	lines: number;
	assigned_units: number;
	delivered_units: number;
	rejected_lines: number;
	in_truck_lines: number;
	completion_pct: number;
};

export type RouteOut = {
	id: string;
	route_date: string;
	status: string;
	notes: string | null;
	started_at: string | null;
	completed_at: string | null;
	created_at: string;
	truck: TruckBrief | null;
	driver: UserBrief | null;
	counts: RouteCounts;
};

export type RouteDetailItem = {
	id: string;
	product: { id: string; barcode_qr: string; description: string; unit: string; weight: number };
	status: string;
	assigned_quantity: number;
	delivered_quantity: number;
	return_required: boolean;
	rejection_reason: string | null;
	last_scan_at: string | null;
};

export type RouteFullOut = RouteOut & { details: RouteDetailItem[] };

export type ImportResult = {
	total_rows: number;
	created: number;
	updated: number;
	errors: string[];
};

export type DeviceOut = {
	id: string;
	device_uuid: string;
	platform: string | null;
	app_version: string | null;
	is_active: boolean;
	first_seen_at: string | null;
	last_seen_at: string | null;
	user: UserBrief | null;
};

export type SecurityEventOut = {
	id: string;
	event_type: string;
	created_at: string;
	device_uuid: string | null;
	latitude: number | null;
	longitude: number | null;
	detail: Record<string, unknown> | null;
	user: UserBrief | null;
};

/* ---------------------------- driver portal ------------------------------ */

export type DriverCounts = {
	lines: number;
	assigned_units: number;
	delivered_units: number;
	rejected_lines: number;
	in_truck_lines: number;
	completion_pct: number;
};

export type DriverTruck = {
	id: string;
	license_plate: string;
	model: string | null;
};

export type DriverManifestItem = {
	route_detail_id: string;
	status: string;
	assigned_quantity: number;
	delivered_quantity: number;
	remaining_quantity: number;
	return_required: boolean;
	rejection_reason: string | null;
	last_scan_at: string | null;
	product: {
		id: string;
		barcode_qr: string;
		description: string;
		unit: string;
		weight: number;
	};
};

export type DriverScan = {
	id: string;
	action: "DELIVER" | "REJECT" | "LOAD";
	product: string;
	barcode: string;
	quantity: number;
	at: string;
	synced_at: string;
	offline: boolean;
	mock_gps: boolean;
	latitude: number | null;
	longitude: number | null;
	rejection_reason: string | null;
	flags: Record<string, unknown>;
};

export type DriverRoute = {
	id: string;
	route_date: string;
	status: string;
	notes: string | null;
	started_at: string | null;
	completed_at: string | null;
	truck: DriverTruck | null;
	counts: DriverCounts;
};

export type DriverPending = {
	lines: number;
	units: number;
};

export type DriverToday = {
	day: string;
	route: Omit<DriverRoute, "counts"> | null;
	counts: DriverCounts;
	items: DriverManifestItem[];
	truck: DriverTruck | null;
	message: string | null;
	pending: DriverPending;
	/** Routes of the driver's truck that are still open (today and later). */
	pending_routes: DriverRoute[];
	scans: DriverScan[];
	last_position: {
		latitude: number;
		longitude: number;
		at: string;
		action: string;
	} | null;
};

export type DriverHistory = {
	days: number;
	since: string;
	truck: DriverTruck | null;
	routes: DriverRoute[];
	totals: {
		routes: number;
		assigned_units: number;
		delivered_units: number;
		completion_pct: number;
	};
};

export type DriverRouteDetail = {
	route: DriverRoute;
	counts: DriverCounts;
	pending: DriverPending;
	items: DriverManifestItem[];
};

