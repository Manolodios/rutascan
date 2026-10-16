/**
 * Platform (SaaS operator) API client.
 * Talks to /api/v1/platform/* using the X-Platform-Key header, which is
 * separate from the company JWT session used by the rest of the panel.
 */

const STORAGE_KEY = "rutascan.platform.v1";

export type CompanyOut = {
	id: string;
	name: string;
	tax_id: string;
	license_key: string;
	subscription_status: string;
	expiration_date: string;
	max_trucks: number;
	is_active: boolean;
	created_at: string;
	active_devices: number;
	users_count: number;
	trucks_count: number;
};

export type CompanyCreatedOut = {
	company_id: string;
	name: string;
	license_key: string;
	expiration_date: string;
	max_trucks: number;
	admin_user_id: string;
};

export type CompanyCreateRequest = {
	name: string;
	tax_id: string;
	max_trucks: number;
	expiration_date: string;
	admin_cedula: string;
	admin_full_name: string;
	admin_pin: string;
};

export type CompanyLicenseUpdate = {
	subscription_status?: string;
	expiration_date?: string;
	max_trucks?: number;
	is_active?: boolean;
};

export class PlatformError extends Error {
	status: number;
	code: string | null;

	constructor(status: number, message: string, code: string | null = null) {
		super(message);
		this.name = "PlatformError";
		this.status = status;
		this.code = code ?? null;
	}
}

/* --------------------------------- key ---------------------------------- */

export function getPlatformKey(): string | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { platform_key?: string };
		return parsed.platform_key?.trim() || null;
	} catch {
		return null;
	}
}

export function setPlatformKey(key: string): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ platform_key: key.trim() }));
}

export function clearPlatformKey(): void {
	localStorage.removeItem(STORAGE_KEY);
}

/* --------------------------------- api ---------------------------------- */

type PlatformOptions = {
	method?: string;
	body?: unknown;
};

export async function platformApi<T = unknown>(
	path: string,
	{ method = "GET", body = null }: PlatformOptions = {},
): Promise<T> {
	const headers: Record<string, string> = {
		"X-Platform-Key": getPlatformKey() ?? "",
	};
	if (body !== null && body !== undefined) headers["Content-Type"] = "application/json";

	const res = await fetch(path, {
		method,
		headers,
		body: body === null || body === undefined ? null : JSON.stringify(body),
	});

	if (!res.ok) {
		let message = `Error ${res.status}`;
		let code: string | null = null;
		try {
			const data = (await res.json()) as {
				detail?: unknown;
				code?: string;
			};
			if (typeof data.detail === "string") message = data.detail;
			else if (data.detail && typeof data.detail === "object") {
				const inner = data.detail as { detail?: string; code?: string };
				if (inner.detail) message = inner.detail;
				if (inner.code) code = inner.code;
			}
			if (data.code) code = data.code;
		} catch {
			/* not json */
		}
		throw new PlatformError(res.status, message, code);
	}

	if (res.status === 204) return null as T;
	const text = await res.text();
	return (text ? JSON.parse(text) : null) as T;
}

export const INVALID_KEY = "INVALID_PLATFORM_KEY";

/* -------------------------------- helpers ------------------------------- */

/** Whole days from today until the given yyyy-mm-dd (negative = already past). */
export function daysUntil(isoDate: string): number {
	const target = new Date(`${isoDate}T00:00:00`);
	if (Number.isNaN(target.getTime())) return 0;
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type CompanyHealth =
	| "OPERATIVA"
	| "POR_VENCER"
	| "VENCIDA"
	| "SUSPENDIDA"
	| "INACTIVA";

export const HEALTH_LABEL: Record<CompanyHealth, string> = {
	OPERATIVA: "Operativa",
	POR_VENCER: "Por vencer",
	VENCIDA: "Vencida",
	SUSPENDIDA: "Suspendida",
	INACTIVA: "Inactiva",
};

/** Warn this many days before the license runs out. */
export const EXPIRING_DAYS = 15;

export function companyHealth(company: CompanyOut): CompanyHealth {
	if (!company.is_active) return "INACTIVA";
	if (company.subscription_status !== "ACTIVE") return "SUSPENDIDA";
	const days = daysUntil(company.expiration_date);
	if (days < 0) return "VENCIDA";
	if (days <= EXPIRING_DAYS) return "POR_VENCER";
	return "OPERATIVA";
}

export function isOperative(company: CompanyOut): boolean {
	return companyHealth(company) === "OPERATIVA" || companyHealth(company) === "POR_VENCER";
}

/**
 * yyyy-mm-dd N months after `from`, or after today when `from` is missing or
 * already in the past (so "renew 12 months" always extends forward).
 */
export function addMonths(months: number, from?: string): string {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	if (from) {
		const parsed = new Date(`${from}T00:00:00`);
		if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > start.getTime()) {
			start.setTime(parsed.getTime());
		}
	}

	const result = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
	const offset = result.getTimezoneOffset();
	return new Date(result.getTime() - offset * 60000).toISOString().slice(0, 10);
}
