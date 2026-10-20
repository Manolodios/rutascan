import { useMemo } from "react";
import { ArrowLeftIcon, DownloadIcon, RefreshCwIcon, SmartphoneIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataCard, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteStatusBadge } from "@/components/views/status-badge";
import { DriverManifestTable } from "@/components/driver/manifest-table";
import { NoRouteToday } from "@/components/driver/no-route-today";
import {
	api,
	type DriverCounts,
	type DriverManifestItem,
	type DriverPending,
	type DriverRoute,
	type DriverRouteDetail,
	type DriverToday,
} from "@/lib/api";
import { useAsyncData } from "@/lib/use-async";
import { formatDate, formatPercent } from "@/lib/format";
import { useHash } from "@/lib/use-hash";
import { cn } from "@/lib/utils";

type RoutePayload = DriverToday | DriverRouteDetail;
type RouteSummary = Omit<DriverRoute, "counts">;

export function DriverRouteView() {
	const hash = useHash();
	const routeId = useMemo(
		() => new URLSearchParams(hash.split("?")[1] ?? "").get("ruta"),
		[hash],
	);

	const { data, error, loading, reload } = useAsyncData<RoutePayload>(
		() =>
			routeId
				? api<DriverRouteDetail>(`/api/v1/driver/routes/${routeId}`)
				: api<DriverToday>("/api/v1/driver/today"),
		[routeId],
	);

	const route: RouteSummary | null = data?.route ?? null;
	const counts: DriverCounts | null = data?.counts ?? null;
	const items: DriverManifestItem[] = data?.items ?? [];
	const pending: DriverPending = data?.pending ?? { lines: 0, units: 0 };
	const isToday = data !== null && "scans" in data;
	const emptyState = data && !route ? (data as DriverToday) : null;

	const pendingItems = items.filter(
		(item) => item.remaining_quantity > 0 && item.status !== "REJECTED",
	);

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
				{routeId ? (
					<Button asChild variant="ghost" size="sm">
						<a href="#/mi-ruta">
							<ArrowLeftIcon />
							Mi ruta de hoy
						</a>
					</Button>
				) : null}
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

			{emptyState ? (
				<NoRouteToday truck={emptyState.truck} message={emptyState.message} />
			) : null}

			{route && counts ? (
				<>
					<Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<RouteStatusBadge status={route.status} />
								{isToday ? (
									<Badge variant="outline">Ruta de hoy</Badge>
								) : (
									<Badge variant="outline">{formatDate(route.route_date)}</Badge>
								)}
							</div>
							<h2 className="mt-2 font-heading font-semibold text-lg">
								Manifiesto de la ruta
							</h2>
							<p className="text-muted-foreground text-sm">
								{route.truck?.model ?? "Camión asignado"} · {counts.lines}{" "}
								productos
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

					<Card className="gap-0 overflow-hidden py-0">
						<div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
							<span className="font-heading font-medium text-sm">Por entregar</span>
							<Badge variant="outline">
								{pending.units} unidades · {pending.lines} productos
							</Badge>
						</div>
						{pendingItems.length === 0 ? (
							<p className="px-4 py-10 text-center text-muted-foreground text-sm">
								No le queda nada por entregar en esta ruta.
							</p>
						) : (
							<ul className="divide-y px-4">
								{pendingItems.map((item) => (
									<li
										key={item.route_detail_id}
										className="flex items-center justify-between gap-3 py-3"
									>
										<div className="min-w-0">
											<div className="font-medium text-sm">
												{item.product.description}
											</div>
											<div className="font-mono text-muted-foreground text-xs">
												{item.product.barcode_qr}
											</div>
										</div>
										<div className="text-right">
											<div className="font-heading font-semibold tabular-nums">
												{item.remaining_quantity} uds.
											</div>
											<div className="text-muted-foreground text-xs">
												de {item.assigned_quantity} asignadas
											</div>
										</div>
									</li>
								))}
							</ul>
						)}
					</Card>

					<DataCard title="Productos del manifiesto">
						<DriverManifestTable items={items} />
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
