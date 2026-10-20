import { useMemo } from "react";
import {
	CircleCheckIcon,
	DownloadIcon,
	PackageIcon,
	RefreshCwIcon,
	SmartphoneIcon,
	TruckIcon,
	XCircleIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataCard, PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteStatusBadge } from "@/components/views/status-badge";
import { DriverScanMap } from "@/components/driver/scan-map";
import { DriverStat } from "@/components/driver/stat-card";
import { NoRouteToday } from "@/components/driver/no-route-today";
import { api, type DriverToday } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAsyncData } from "@/lib/use-async";
import {
	ACTION_LABEL,
	formatDate,
	formatDateTime,
	formatLongDate,
	formatPercent,
	todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const SCAN_DOT: Record<string, string> = {
	DELIVER: "bg-emerald-500",
	REJECT: "bg-destructive",
	LOAD: "bg-primary",
};

export function DriverTodayView() {
	const { user } = useAuth();
	const { data, error, loading, reload } = useAsyncData<DriverToday>(
		() => api<DriverToday>("/api/v1/driver/today"),
		[],
	);

	const firstName = user?.full_name.split(" ")[0] ?? "conductor";
	const dayLabel = useMemo(() => {
		const label = formatLongDate(data?.day ?? todayISO());
		return label.charAt(0).toUpperCase() + label.slice(1);
	}, [data?.day]);

	const route = data?.route ?? null;
	const counts = data?.counts;

	return (
		<div className="flex flex-col gap-4">
			<PageHeader
				title="Mi jornada"
				description={
					<>
						Hola, {firstName}. <span>{dayLabel}</span>
					</>
				}
			>
				<Button variant="outline" size="sm" onClick={reload} disabled={loading}>
					<RefreshCwIcon className={cn(loading && "animate-spin")} />
					Actualizar
				</Button>
			</PageHeader>

			{loading && !data ? (
				<div className="flex flex-col gap-4">
					<Skeleton className="h-40 rounded-xl" />
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{Array.from({ length: 4 }).map((_, index) => (
							<Skeleton key={index} className="h-24 rounded-xl" />
						))}
					</div>
					<Skeleton className="h-72 rounded-xl" />
				</div>
			) : null}

			{error && !data ? (
				<Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
					<p className="font-medium text-destructive">No se pudo cargar tu jornada</p>
					<p className="max-w-md text-muted-foreground text-sm">{error}</p>
					<Button variant="outline" onClick={reload}>
						Reintentar
					</Button>
				</Card>
			) : null}

			{data && !route ? <NoRouteToday truck={data.truck} message={data.message} /> : null}

			{data && route && counts ? (
				<>
					<Card className="gap-0 overflow-hidden py-0">
						<div className="flex flex-wrap items-start justify-between gap-4 p-5">
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<RouteStatusBadge status={route.status} />
									<span className="text-muted-foreground text-xs">
										{formatDate(route.route_date)}
									</span>
								</div>
								<h2 className="mt-2 font-heading font-semibold text-xl">
									Ruta {route.truck?.license_plate ?? "de hoy"}
								</h2>
								<p className="text-muted-foreground text-sm">
									{route.truck?.model ?? "Camión asignado"}
									{route.started_at
										? ` · Iniciada ${formatDateTime(route.started_at)}`
										: ""}
								</p>
							</div>
							<div className="text-right">
								<div className="font-heading font-semibold text-3xl tabular-nums">
									{formatPercent(counts.completion_pct)}
								</div>
								<div className="text-muted-foreground text-xs">cumplimiento</div>
							</div>
						</div>
						<div className="border-t px-5 py-4">
							<Progress value={counts.completion_pct} />
							<div className="mt-2 flex flex-wrap justify-between gap-1 text-muted-foreground text-xs">
								<span>
									{counts.delivered_units} de {counts.assigned_units} unidades entregadas
								</span>
								<span>
									{counts.in_truck_lines} por entregar · {counts.rejected_lines}{" "}
									rechazos
								</span>
							</div>
						</div>
						{route.notes ? (
							<div className="border-t bg-muted/40 px-5 py-3 text-sm">
								<span className="font-medium">Nota de la central: </span>
								<span className="text-muted-foreground">{route.notes}</span>
							</div>
						) : null}
					</Card>

					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<DriverStat
							icon={<PackageIcon className="size-4" />}
							label="Asignadas"
							value={counts.assigned_units}
							hint={`${counts.lines} productos`}
						/>
						<DriverStat
							icon={<CircleCheckIcon className="size-4" />}
							label="Entregadas"
							value={counts.delivered_units}
							hint={formatPercent(counts.completion_pct)}
						/>
						<DriverStat
							icon={<TruckIcon className="size-4" />}
							label="En camión"
							value={counts.in_truck_lines}
							hint="por entregar"
						/>
						<DriverStat
							icon={<XCircleIcon className="size-4" />}
							label="Rechazos"
							value={counts.rejected_lines}
							hint="reportados"
						/>
					</div>

					<div className="grid gap-4 lg:grid-cols-3">
						<div className="lg:col-span-2">
							<DataCard
								title="Mi recorrido de hoy"
								actions={
									<Badge variant="outline">{data.scans.length} escaneos</Badge>
								}
							>
								<DriverScanMap scans={data.scans} />
							</DataCard>
						</div>

						<DataCard title="Últimos escaneos">
							{data.scans.length === 0 ? (
								<p className="px-4 py-10 text-center text-muted-foreground text-sm">
									Aún no has escaneado hoy.
								</p>
							) : (
								<ul className="divide-y px-4">
									{data.scans.slice(0, 8).map((scan) => (
										<li key={scan.id} className="flex items-start gap-3 py-3">
											<span
												className={cn(
													"mt-1.5 size-2 shrink-0 rounded-full",
													SCAN_DOT[scan.action] ?? "bg-muted-foreground",
												)}
											/>
											<div className="min-w-0 flex-1">
												<div className="flex items-baseline justify-between gap-2">
													<span className="font-medium text-sm">
														{ACTION_LABEL[scan.action] ?? scan.action}
													</span>
													<span className="text-muted-foreground text-xs">
														{formatDateTime(scan.at)}
													</span>
												</div>
												<p className="truncate text-muted-foreground text-xs">
													{scan.product}
												</p>
												{scan.offline || scan.mock_gps ? (
													<div className="mt-1 flex flex-wrap gap-1">
														{scan.offline ? (
															<Badge
																variant="outline"
																className="text-[10px]"
															>
																Offline
															</Badge>
														) : null}
														{scan.mock_gps ? (
															<Badge
																variant="outline"
																className="text-[10px]"
															>
																GPS simulado
															</Badge>
														) : null}
													</div>
												) : null}
											</div>
										</li>
									))}
								</ul>
							)}
						</DataCard>
					</div>

					<Card className="flex flex-wrap items-center gap-3 px-4 py-3">
						<div className="rounded-md bg-muted p-2 text-muted-foreground">
							<SmartphoneIcon className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm">Escanea desde la app del celular</p>
							<p className="text-muted-foreground text-xs">
								Este panel es de consulta. Las entregas y los rechazos se
								registran con la app.
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
