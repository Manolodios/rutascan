import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";
import type { DashboardSummary } from "@/lib/api";
import { SECURITY_EVENT_LABEL, formatInteger, formatPercent } from "@/lib/format";

type Stat = { label: string; value: string; hint: string; alert?: boolean };

export function RsStats({ summary }: { summary: DashboardSummary }) {
	const d = summary.deliveries;
	const alertTypes = Object.entries(summary.alerts.by_type);
	const alertHint = alertTypes.length
		? alertTypes.map(([key, value]) => `${SECURITY_EVENT_LABEL[key] ?? key}: ${value}`).join(" · ")
		: "Sin novedades";

	const stats: Stat[] = [
		{
			label: "Camiones en ruta",
			value: `${summary.trucks.active_on_route}/${summary.trucks.total}`,
			hint: `Rutas hoy: ${summary.routes.total} · ${summary.routes.completed} completadas`,
		},
		{
			label: "Cumplimiento de entregas",
			value: formatPercent(d.completion_pct),
			hint: `${formatInteger(d.delivered)} de ${formatInteger(d.assigned)} unidades entregadas`,
		},
		{
			label: "Ítems por entregar",
			value: formatInteger(d.in_truck),
			hint: `Rechazados: ${d.rejected} · Devoluciones pendientes: ${d.returns_pending}`,
		},
		{
			label: "Alertas (24 h)",
			value: formatInteger(summary.alerts.security_events_24h),
			hint: alertHint,
			alert: summary.alerts.security_events_24h > 0,
		},
	];

	return (
		<>
			{stats.map((stat) => (
				<DashboardCard key={stat.label}>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="font-normal text-xs tracking-wide">
							{stat.label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p
							className={`font-semibold text-2xl tabular-nums ${
								stat.alert ? "text-destructive" : "text-foreground"
							}`}
						>
							{stat.value}
						</p>
						<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">{stat.hint}</p>
					</CardContent>
				</DashboardCard>
			))}
		</>
	);
}
