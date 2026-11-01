/** Formatting helpers for RutaScan (Venezuela / es-VE). */

export const LOCALE = "es-VE";

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

/** ISO date → "martes, 20 de octubre". */
export function formatLongDate(value: string | null | undefined): string {
	if (!value) return "—";
	const date = new Date(`${value}T12:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString(LOCALE, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
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

const SECURITY_DETAIL_LABEL: Record<string, string> = {
	cedula: "Cédula",
	qr_code: "QR",
	qr_escaneado: "QR",
	barcode: "Código",
	scan_uuid: "Escaneo",
	route_id: "Ruta",
	route_detail_id: "Línea",
	path: "Ruta solicitada",
	device_utc: "Reloj del dispositivo",
	server_utc: "Reloj del servidor",
	max_trucks: "Límite",
	license_key: "Licencia",
};

function detailNumber(detail: Record<string, unknown>, key: string): number | null {
	const value = detail[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function detailText(detail: Record<string, unknown>, key: string): string | null {
	const value = detail[key];
	return typeof value === "string" && value.trim() ? value : null;
}

function plural(value: number, singular: string, pluralForm: string): string {
	return `${formatInteger(value)} ${value === 1 ? singular : pluralForm}`;
}

function waitLabel(seconds: number): string {
	return seconds < 60 ? `${Math.round(seconds)} s` : `${Math.ceil(seconds / 60)} min`;
}

/**
 * Human-readable summary of a security event's `detail` payload.
 * Falls back to "clave: valor" for unknown event types.
 */
export function formatSecurityDetail(
	eventType: string,
	detail: Record<string, unknown> | null | undefined,
): string {
	const data = detail ?? {};

	switch (eventType) {
		case "PIN_LOCKOUT": {
			const attempts = detailNumber(data, "intentos_fallidos");
			const wait = detailNumber(data, "retry_after_seconds");
			const parts: string[] = [];
			if (attempts !== null) parts.push(`${plural(attempts, "intento fallido", "intentos fallidos")}`);
			if (wait !== null) parts.push(`bloqueado ${waitLabel(wait)}`);
			return parts.length ? parts.join(" · ") : "Bloqueo temporal por intentos fallidos";
		}
		case "MOCK_GPS": {
			const qr = detailText(data, "qr_code");
			const reason = detailText(data, "motivo");
			if (qr) return `Ubicación simulada al escanear ${qr}`;
			return reason ? `Ubicación simulada: ${reason}` : "Ubicación simulada detectada";
		}
		case "TIMESTAMP_SKEW": {
			const skew = detailNumber(data, "desfase_segundos");
			if (skew !== null) {
				return `Reloj del dispositivo ${skew >= 0 ? "adelantado" : "atrasado"} ${Math.abs(skew)} s`;
			}
			const device = detailText(data, "device_utc");
			const server = detailText(data, "server_utc");
			if (device && server) {
				const diff = Math.round(
					(new Date(device).getTime() - new Date(server).getTime()) / 1000,
				);
				if (Number.isFinite(diff) && Math.abs(diff) >= 1) {
					return `Reloj del dispositivo ${diff > 0 ? "adelantado" : "atrasado"} ${Math.abs(diff)} s`;
				}
			}
			return "Reloj del dispositivo desfasado";
		}
		case "STALE_SCAN": {
			const device = detailText(data, "device_utc");
			const server = detailText(data, "server_utc");
			if (device && server) {
				const days = Math.abs(
					(new Date(server).getTime() - new Date(device).getTime()) / 86_400_000,
				);
				if (Number.isFinite(days) && days >= 1) {
					return `Escaneo sincronizado ${plural(Math.round(days), "día", "días")} después`;
				}
			}
			return "Escaneo sincronizado fuera del plazo permitido";
		}
		case "SPEED_ANOMALY": {
			const speed = detailNumber(data, "implied_speed_kmh");
			const distance = detailNumber(data, "distance_m");
			const parts: string[] = [];
			if (speed !== null) {
				parts.push(`${speed.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} km/h`);
			}
			if (distance !== null) parts.push(`en ${formatInteger(Math.round(distance))} m`);
			return parts.length ? `Velocidad calculada: ${parts.join(" ")}` : "Velocidad imposible detectada";
		}
		case "MANIFEST_MISMATCH": {
			const qr = detailText(data, "qr_escaneado") ?? detailText(data, "barcode");
			return qr ? `QR fuera del manifiesto: ${qr}` : "Producto fuera del manifiesto";
		}
		case "DUPLICATE_SCAN": {
			const attempts = detailNumber(data, "intentos");
			return attempts !== null
				? `${plural(attempts, "intento de escaneo duplicado", "intentos de escaneo duplicado")}`
				: "Escaneo duplicado";
		}
		case "CROSS_TENANT": {
			const path = detailText(data, "path");
			return path
				? `Licencia de otra empresa en ${path}`
				: "La licencia no corresponde al usuario";
		}
		case "DEVICE_LIMIT": {
			const max = detailNumber(data, "max_trucks");
			return max !== null
				? `Límite de ${plural(max, "dispositivo", "dispositivos")} alcanzado`
				: "Límite de dispositivos alcanzado";
		}
		default: {
			const entries = Object.entries(data).filter(
				([, value]) => value !== null && value !== undefined && value !== "",
			);
			if (!entries.length) return "Sin detalle";
			return entries
				.map(([key, value]) => `${SECURITY_DETAIL_LABEL[key] ?? key}: ${String(value)}`)
				.join(" · ");
		}
	}
}

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
