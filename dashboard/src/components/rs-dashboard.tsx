import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RsActivity } from "@/components/rs-activity";
import { RsLicenseCard } from "@/components/rs-license-card";
import { RsStats } from "@/components/rs-stats";
import { RsTrucksTable } from "@/components/rs-trucks-table";
import { RsWeeklyChart } from "@/components/rs-weekly-chart";
import { useDashboardData } from "@/lib/use-dashboard";

export function RsDashboard() {
	const { summary, liveMap, license, error, loading, lastUpdated, reload } =
		useDashboardData();

	if (loading && !summary) {
		return <DashboardSkeleton />;
	}

	if (error && !summary) {
		return (
			<div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
				<p className="font-medium text-destructive">
					No se pudo cargar el panel
				</p>
				<p className="text-muted-foreground text-sm">{error}</p>
				<Button onClick={() => void reload()} variant="outline">
					Reintentar
				</Button>
			</div>
		);
	}

	if (!summary || !liveMap) {
		return null;
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h1 className="font-heading font-semibold text-xl">Panel de operación</h1>
					<p className="text-muted-foreground text-sm">
						Datos del {summary.date}
						{lastUpdated
							? ` · actualizado ${lastUpdated.toLocaleTimeString("es-CO", {
									hour: "2-digit",
									minute: "2-digit",
								})}`
							: ""}
					</p>
				</div>
				<Button
					disabled={loading}
					onClick={() => void reload()}
					size="sm"
					variant="outline"
				>
					{loading ? "Actualizando…" : "Actualizar"}
				</Button>
			</div>

			{error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-destructive text-sm">
					{error}
				</div>
			) : null}

			<div className="grid grid-cols-1 gap-px bg-border p-px md:grid-cols-2 lg:grid-cols-4">
				<RsStats summary={summary} />
				<RsWeeklyChart summary={summary} />
				<RsTrucksTable liveMap={liveMap} />
				<RsLicenseCard license={license} />
				<RsActivity activity={summary.recent_activity} />
			</div>

			{summary.deliveries.returns_pending > 0 ? (
				<div className="rounded-xl border border-amber-300/60 bg-amber-50 px-5 py-4 text-amber-900 text-sm dark:bg-amber-950/30 dark:text-amber-200">
					<strong>{summary.deliveries.returns_pending} devolución(es) pendiente(s):</strong>{" "}
					ítems rechazados que deben reingresar a bodega al finalizar la ruta.
				</div>
			) : null}
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-8 w-56" />
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, index) => (
					<Skeleton className="h-32 w-full" key={`kpi-${index}`} />
				))}
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<Skeleton className="h-96 w-full" />
				<Skeleton className="h-96 w-full" />
			</div>
		</div>
	);
}
