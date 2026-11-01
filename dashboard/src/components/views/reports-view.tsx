import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { DataCard, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	api,
	downloadFile,
	type DashboardSummary,
	type RouteOut,
} from "@/lib/api";
import { formatDate, formatInteger, formatPercent, todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/mutate";
import { useAsyncData } from "@/lib/use-async";

const NONE = "__none__";

function daysAgoISO(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() - days);
	const offset = date.getTimezoneOffset();
	return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function ReportsView() {
	const [from, setFrom] = useState(() => daysAgoISO(6));
	const [to, setTo] = useState(todayISO());
	const [routeId, setRouteId] = useState(NONE);
	const [routes, setRoutes] = useState<RouteOut[]>([]);
	const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

	const preview = useAsyncData<DashboardSummary>(
		() => api<DashboardSummary>("/api/v1/admin/dashboard/summary"),
		[],
	);

	useEffect(() => {
		let alive = true;
		const days = Array.from(new Set([from, to])).filter(Boolean);
		void Promise.all(
			days.map((day) => api<RouteOut[]>(`/api/v1/admin/routes?day=${day}`)),
		)
			.then((lists) => {
				if (alive) setRoutes(lists.flat());
			})
			.catch(() => {
				/* non-blocking */
			});
		return () => {
			alive = false;
		};
	}, [from, to]);

	function params(): string {
		const search = new URLSearchParams({ date_from: from, date_to: to });
		if (routeId !== NONE) search.set("route_id", routeId);
		return search.toString();
	}

	async function download(kind: "xlsx" | "pdf") {
		if (!from || !to) {
			toast.error("Seleccione el rango de fechas");
			return;
		}
		if (from > to) {
			toast.error("La fecha inicial no puede ser posterior a la final");
			return;
		}
		setBusy(kind);
		try {
			const name = await downloadFile(
				`/api/v1/admin/reports/deliveries.${kind}?${params()}`,
				`rutascan_entregas.${kind}`,
			);
			toast.success(`Descargado: ${name}`);
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			setBusy(null);
		}
	}

	function applyPreset(days: number) {
		setTo(todayISO());
		setFrom(daysAgoISO(days));
	}

	const summary = preview.data;

	return (
		<div className="max-w-3xl space-y-4">
			<PageHeader
				description="Exporte el historial de entregas del rango que necesite."
				title="Reportes"
			/>

			<DataCard title="Rango de fechas">
				<div className="grid gap-4 p-4 sm:grid-cols-3">
					<div className="grid gap-1.5">
						<Label htmlFor="r-from">Desde</Label>
						<Input
							id="r-from"
							onChange={(event) => setFrom(event.target.value)}
							type="date"
							value={from}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="r-to">Hasta</Label>
						<Input
							id="r-to"
							onChange={(event) => setTo(event.target.value)}
							type="date"
							value={to}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="r-route">Ruta (opcional)</Label>
						<Select onValueChange={setRouteId} value={routeId}>
							<SelectTrigger className="w-full" id="r-route">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>Todas las rutas del rango</SelectItem>
								{routes.map((route) => (
									<SelectItem key={route.id} value={route.id}>
										{route.route_date} · {route.truck?.license_plate ?? ""} ·{" "}
										{route.driver?.full_name ?? ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 px-4 pb-2">
					<Button onClick={() => applyPreset(0)} size="sm" variant="outline">
						Hoy
					</Button>
					<Button onClick={() => applyPreset(6)} size="sm" variant="outline">
						Últimos 7 días
					</Button>
					<Button onClick={() => applyPreset(29)} size="sm" variant="outline">
						Últimos 30 días
					</Button>
					<span className="text-muted-foreground text-xs">
						{formatDate(from)} → {formatDate(to)}
					</span>
				</div>

				<div className="flex flex-wrap gap-2 border-t p-4">
					<Button
						disabled={busy !== null}
						onClick={() => void download("xlsx")}
						variant="secondary"
					>
						<FileSpreadsheetIcon />
						{busy === "xlsx" ? "Generando…" : "Descargar Excel (.xlsx)"}
					</Button>
					<Button disabled={busy !== null} onClick={() => void download("pdf")}>
						<FileTextIcon />
						{busy === "pdf" ? "Generando…" : "Descargar PDF"}
					</Button>
				</div>
				<p className="border-t px-4 py-3 text-muted-foreground text-xs">
					El Excel incluye 3 hojas: entregas detalladas (con GPS y señales
					antifraude), cumplimiento por ruta e información general.
				</p>
			</DataCard>

			<DataCard title="Vista previa de hoy">
				<div className="p-4">
					{preview.loading && !summary ? (
						<Skeleton className="h-16 w-full" />
					) : preview.error ? (
						<p className="text-destructive text-sm">{preview.error}</p>
					) : summary ? (
						<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
							<Kpi label="Rutas hoy" value={formatInteger(summary.routes.total)} />
							<Kpi
								label="Unidades entregadas"
								value={formatInteger(summary.deliveries.delivered)}
							/>
							<Kpi
								label="Cumplimiento"
								value={formatPercent(summary.deliveries.completion_pct)}
							/>
							<Kpi
								alert={summary.alerts.security_events_24h > 0}
								label="Alertas 24 h"
								value={formatInteger(summary.alerts.security_events_24h)}
							/>
						</div>
					) : null}
					<p className="mt-3 text-muted-foreground text-xs">
						Resumen del día actual. La descarga respeta el rango y la ruta
						seleccionados.
					</p>
				</div>
			</DataCard>
		</div>
	);
}

function Kpi({
	label,
	value,
	alert = false,
}: {
	label: string;
	value: string;
	alert?: boolean;
}) {
	return (
		<div>
			<div className="font-semibold text-muted-foreground text-xs uppercase">
				{label}
			</div>
			<div className={`font-semibold text-xl ${alert ? "text-destructive" : ""}`}>
				{value}
			</div>
		</div>
	);
}
