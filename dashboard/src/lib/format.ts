/** Formatting helpers for RutaScan (Colombia / es-CO). */

export const LOCALE = "es-CO";

/** ISO date (yyyy-mm-dd) → "16 oct". */
export function formatDayMonth(isoDate: string): string {
	const date = new Date(`${isoDate}T12:00:00`);
	return date.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

/** ISO date → "mié". */
export function formatWeekday(isoDate: string): string {
	const date = new Date(`${isoDate}T12:00:00`);
	return date.toLocaleDateString(LOCALE, { weekday: "short" });
}

/** ISO timestamp → "16 oct, 14:20". */
export function formatDateTime(value: string | null | undefined): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleString(LOCALE, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** ISO timestamp → "hace 12 min". */
export function formatRelative(value: string | null | undefined): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	const minutes = Math.round((Date.now() - date.getTime()) / 60000);
	if (minutes < 1) return "ahora";
	if (minutes < 60) return `hace ${minutes} min`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `hace ${hours} h`;
	return `hace ${Math.round(hours / 24)} d`;
}

export function formatInteger(value: number): string {
	return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
	return `${value.toFixed(fractionDigits)}%`;
}

export const ACTION_LABEL: Record<string, string> = {
	DELIVER: "Entrega",
	REJECT: "Rechazo",
	LOAD: "Carga",
};

export const ROUTE_STATUS_LABEL: Record<string, string> = {
	PENDING: "Pendiente",
	IN_PROGRESS: "En ruta",
	COMPLETED: "Completada",
	CANCELLED: "Cancelada",
};

export const REJECTION_LABEL: Record<string, string> = {
	DAMAGED: "Dañado",
	WRONG_ITEM: "Producto equivocado",
	CLIENT_REJECTED: "Rechazado por cliente",
	NO_ONE_HOME: "Nadie en el destino",
	ADDRESS_NOT_FOUND: "Dirección no encontrada",
	OTHER: "Otro",
};

export const SECURITY_EVENT_LABEL: Record<string, string> = {
	MOCK_GPS: "GPS simulado",
	SPEED_ANOMALY: "Velocidad imposible",
	TIMESTAMP_SKEW: "Reloj adelantado",
	STALE_SCAN: "Escaneo offline antiguo",
	PIN_LOCKOUT: "Bloqueo de PIN",
	DEVICE_LIMIT: "Límite de dispositivos",
	CROSS_TENANT: "Licencia cruzada",
	MANIFEST_MISMATCH: "Fuera del manifiesto",
	DUPLICATE_SCAN: "Escaneo duplicado",
	OTHER: "Otro",
};

export const ROLE_LABEL: Record<string, string> = {
	ADMIN: "Administrador",
	WAREHOUSE: "Bodega",
	DRIVER: "Conductor",
};

export const DETAIL_STATUS_LABEL: Record<string, string> = {
	PENDING: "Pendiente",
	LOADED: "Cargado",
	IN_TRUCK: "En camión",
	DELIVERED: "Entregado",
	REJECTED: "Rechazado",
};

/** Today's date as yyyy-mm-dd in the browser's local timezone. */
export function todayISO(): string {
	const now = new Date();
	const offset = now.getTimezoneOffset();
	return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

/** yyyy-mm-dd → "16 oct 2026". */
export function formatDate(value: string | null | undefined): string {
	if (!value) return "—";
	const date = new Date(`${value}T12:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString(LOCALE, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/** Turns the raw DeliveryLog flags into human-readable notes (skips informational ones). */
export function formatFlags(flags: Record<string, unknown> | null | undefined): string[] {
	if (!flags) return [];
	const notes: string[] = [];
	if (typeof flags.timestamp_future_minutes === "number") {
		notes.push(`reloj +${flags.timestamp_future_minutes} min`);
	}
	if (typeof flags.stale_days === "number") {
		notes.push(`offline ${flags.stale_days} días`);
	}
	if (typeof flags.implied_speed_kmh === "number") {
		notes.push(`${flags.implied_speed_kmh} km/h`);
	}
	return notes;
}
