import {
	DownloadIcon,
	RefreshCwIcon,
	SmartphoneIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataCard, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteStatusBadge } from "@/components/views/status-badge";
import { DriverManifestTable } from "@/components/driver/manifest-table";
import { NoRouteToday } from "@/components/driver/no-route-today";
import { api, type DriverToday } from "@/lib/api";
import { useAsyncData } from "@/lib/use-async";
import {
	formatDate,
	formatPercent,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function DriverRouteView() {
	const { data, error, loading, reload } = useAsyncData<DriverToday>(
		() => api<DriverToday>("/api/v1/driver/today"),
		[],
	);

	const route = data?.route ?? null;
	const counts = data?.counts;

	return (
		<div className="flex flex-col gap-4">
			<PageHeader
				title="Mi ruta"
				description={
					route
						? `${formatDate(route.route_date)} · ${
								route.truck?.license_plate ?? "Camión asignado"
							}`
						: "Manifiesto del día"
				}
			>
				<Button variant="outline" size="sm" onClick={reload} disabled={loading}>
					<RefreshCwIcon className={cn(loading && "animate-spin")} />
					Actualizar
				</Button>
			</PageHeader>

			{loading && !data ? <Skeleton className="h-72 rounded-xl" /> : null}

			{error && !data ? (
				<Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
					<p className="font-medium text-destructive">No se pudo cargar tu ruta</p>
					<p className="max-w-md text-muted-foreground text-sm">{error}</p>
					<Button variant="outline" onClick={reload}>
						Reintentar
					</Button>
				</Card>
			) : null}

			{data && !route ? <NoRouteToday truck={data.truck} message={data.message} /> : null}

			{data && route && counts ? (
				<>
					<Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<RouteStatusBadge status={route.status} />
								{route.completed_at ? (
									<Badge variant="outline">
										Completada {formatDate(route.route_date)}
									</Badge>
								) : null}
							</div>
							<h2 className="mt-2 font-heading font-semibold text-lg">
								Manifiesto de la ruta
							</h2>
							<p className="text-muted-foreground text-sm">
								{route.truck?.model ?? "Camión asignado"} ·{" "}
								{counts.lines} productos
							</p>
						</div>
						<div className="flex items-center gap-6">
							<div className="text-center">
								<div className="font-heading font-semibold text-2xl tabular-nums">
									{counts.assigned_units}
								</div>
								<div className="text-muted-foreground text-xs">asignadas</div>
							</div>
							<div className="text-center">
								<div className="font-heading font-semibold text-2xl tabular-nums">
									{counts.delivered_units}
								</div>
								<div className="text-muted-foreground text-xs">entregadas</div>
							</div>
							<div className="text-center">
								<div className="font-heading font-semibold text-2xl tabular-nums">
									{formatPercent(counts.completion_pct)}
								</div>
								<div className="text-muted-foreground text-xs">cumplimiento</div>
							</div>
						</div>
					</Card>

					{route.notes ? (
						<Card className="bg-muted/40 px-4 py-3 text-sm">
							<span className="font-medium">Nota de la central: </span>
							<span className="text-muted-foreground">{route.notes}</span>
						</Card>
					) : null}

					<DataCard title="Productos del manifiesto">
						<DriverManifestTable items={data.items} />
					</DataCard>

					<Card className="flex flex-wrap items-center gap-3 px-4 py-3">
						<div className="rounded-md bg-muted p-2 text-muted-foreground">
							<SmartphoneIcon className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm">
								Las entregas se confirman desde la app
							</p>
							<p className="text-muted-foreground text-xs">
								Escanea el QR de cada producto para actualizar su estado en este
								manifiesto.
							</p>
						</div>
						<a
							className={buttonVariants({ variant: "outline", size: "sm" })}
							href="/uploads/RutaScan-Celular.apk"
							target="_blank"
							rel="noreferrer"
						>
							<DownloadIcon />
							App del celular
						</a>
					</Card>
				</>
			) : null}
		</div>
	);
}
