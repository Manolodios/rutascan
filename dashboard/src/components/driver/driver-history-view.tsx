import { useState } from "react";
import {
	CircleCheckIcon,
	EyeIcon,
	PackageIcon,
	RefreshCwIcon,
	RouteIcon,
	TrendingUpIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataCard, PageHeader } from "@/components/page-header";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { RouteStatusBadge } from "@/components/views/status-badge";
import { DriverManifestTable } from "@/components/driver/manifest-table";
import { DriverStat } from "@/components/driver/stat-card";
import {
	api,
	type DriverHistory,
	type DriverRoute,
	type DriverRouteDetail,
} from "@/lib/api";
import { useAsyncData } from "@/lib/use-async";
import { formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_OPTIONS = [7, 14, 30];

export function DriverHistoryView() {
	const [days, setDays] = useState(14);
	const [selected, setSelected] = useState<DriverRoute | null>(null);

	const { data, error, loading, reload } = useAsyncData<DriverHistory>(
		() => api<DriverHistory>(`/api/v1/driver/history?days=${days}`),
		[days],
	);

	const totals = data?.totals;

	return (
		<div className="flex flex-col gap-4">
			<PageHeader
				title="Mi historial"
				description={
					totals
						? `Últimos ${days} días · ${totals.routes} rutas · ${formatPercent(
								totals.completion_pct,
							)} de cumplimiento`
						: "Rendimiento de tus últimas rutas"
				}
			>
				<Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
					<SelectTrigger className="w-[140px]" aria-label="Período">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DAY_OPTIONS.map((option) => (
							<SelectItem key={option} value={String(option)}>
								Últimos {option} días
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button variant="outline" size="sm" onClick={reload} disabled={loading}>
					<RefreshCwIcon className={cn(loading && "animate-spin")} />
					Actualizar
				</Button>
			</PageHeader>

			{loading && !data ? (
				<div className="flex flex-col gap-4">
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
					<p className="font-medium text-destructive">No se pudo cargar tu historial</p>
					<p className="max-w-md text-muted-foreground text-sm">{error}</p>
					<Button variant="outline" onClick={reload}>
						Reintentar
					</Button>
				</Card>
			) : null}

			{data && totals ? (
				<>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<DriverStat
							icon={<RouteIcon className="size-4" />}
							label="Rutas"
							value={totals.routes}
							hint={`en los últimos ${days} días`}
						/>
						<DriverStat
							icon={<PackageIcon className="size-4" />}
							label="Unidades asignadas"
							value={totals.assigned_units}
						/>
						<DriverStat
							icon={<CircleCheckIcon className="size-4" />}
							label="Unidades entregadas"
							value={totals.delivered_units}
						/>
						<DriverStat
							icon={<TrendingUpIcon className="size-4" />}
							label="Cumplimiento"
							value={formatPercent(totals.completion_pct)}
						/>
					</div>

					<DataCard title="Rutas realizadas">
						{data.routes.length === 0 ? (
							<p className="px-4 py-10 text-center text-muted-foreground text-sm">
								No tienes rutas en este período.
							</p>
						) : (
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Fecha</TableHead>
											<TableHead>Camión</TableHead>
											<TableHead>Estado</TableHead>
											<TableHead className="text-right">Asignadas</TableHead>
											<TableHead className="text-right">Entregadas</TableHead>
											<TableHead className="w-44">Cumplimiento</TableHead>
											<TableHead className="text-right" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.routes.map((route) => (
											<TableRow key={route.id}>
												<TableCell className="whitespace-nowrap">
													<div className="font-medium">
														{formatDate(route.route_date)}
													</div>
													{route.notes ? (
														<div className="text-muted-foreground text-xs">
															{route.notes}
														</div>
													) : null}
												</TableCell>
												<TableCell>{route.truck?.license_plate ?? "—"}</TableCell>
												<TableCell>
													<RouteStatusBadge status={route.status} />
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{route.counts.assigned_units}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{route.counts.delivered_units}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Progress
															value={route.counts.completion_pct}
															className="h-2 flex-1"
														/>
														<span className="w-11 text-right text-xs tabular-nums">
															{formatPercent(route.counts.completion_pct)}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setSelected(route)}
													>
														<EyeIcon />
														Ver
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</DataCard>
				</>
			) : null}

			{selected ? (
				<RouteDetailDialog route={selected} onClose={() => setSelected(null)} />
			) : null}
		</div>
	);
}

function RouteDetailDialog({
	route,
	onClose,
}: {
	route: DriverRoute;
	onClose: () => void;
}) {
	const { data, error, loading } = useAsyncData<DriverRouteDetail>(
		() => api<DriverRouteDetail>(`/api/v1/driver/routes/${route.id}`),
		[route.id],
	);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Ruta {route.truck?.license_plate ?? ""}</DialogTitle>
					<DialogDescription>
						{formatDate(route.route_date)}
						{route.started_at ? " · Ver detalle del manifiesto" : ""}
					</DialogDescription>
				</DialogHeader>

				{loading ? <Skeleton className="h-48 rounded-lg" /> : null}
				{error ? (
					<Badge variant="outline" className="text-destructive">
						{error}
					</Badge>
				) : null}

				{data ? (
					<div className="flex flex-col gap-4">
						<div className="grid grid-cols-3 gap-3">
							<div className="rounded-lg border p-3 text-center">
								<div className="font-heading font-semibold text-xl tabular-nums">
									{data.counts.assigned_units}
								</div>
								<div className="text-muted-foreground text-xs">asignadas</div>
							</div>
							<div className="rounded-lg border p-3 text-center">
								<div className="font-heading font-semibold text-xl tabular-nums">
									{data.counts.delivered_units}
								</div>
								<div className="text-muted-foreground text-xs">entregadas</div>
							</div>
							<div className="rounded-lg border p-3 text-center">
								<div className="font-heading font-semibold text-xl tabular-nums">
									{formatPercent(data.counts.completion_pct)}
								</div>
								<div className="text-muted-foreground text-xs">cumplimiento</div>
							</div>
						</div>
						<DriverManifestTable items={data.items} />
					</div>
				) : null}

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cerrar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
