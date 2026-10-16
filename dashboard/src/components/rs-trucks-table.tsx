import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/dashboard-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveMap } from "@/lib/api";
import { ROUTE_STATUS_LABEL, formatPercent, formatRelative } from "@/lib/format";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
	IN_PROGRESS: "default",
	COMPLETED: "secondary",
	PENDING: "outline",
	CANCELLED: "destructive",
};

export function RsTrucksTable({ liveMap }: { liveMap: LiveMap }) {
	const trucks = liveMap.trucks;

	return (
		<DashboardCard className="gap-0 md:col-span-2">
			<CardHeader className="border-b">
				<CardTitle>Camiones en ruta hoy</CardTitle>
				<CardDescription>Avance por vehículo y última señal GPS.</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto px-0">
				<Table>
					<TableCaption className="sr-only">
						Camiones con ruta asignada hoy, su avance y última posición.
					</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead className="ps-6">Camión</TableHead>
							<TableHead>Conductor</TableHead>
							<TableHead className="text-right tabular-nums">Entregas</TableHead>
							<TableHead className="text-right tabular-nums">Avance</TableHead>
							<TableHead className="pe-6 text-right">Estado</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{trucks.map((row) => (
							<TableRow className="h-12" key={row.route_id}>
								<TableCell className="ps-6">
									<div className="font-medium">{row.truck.license_plate}</div>
									<div className="text-muted-foreground text-xs">
										{row.truck.model ?? "—"}
									</div>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{row.driver?.full_name ?? "Sin asignar"}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{row.delivered_units}/{row.assigned_units}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatPercent(row.completion_pct)}
								</TableCell>
								<TableCell className="pe-6 text-right">
									<div className="flex items-center justify-end gap-2">
										{row.last_position ? (
											<span className="text-muted-foreground text-xs">
												{formatRelative(row.last_position.at)}
												{row.last_position.mock_gps ? " · GPS simulado" : ""}
											</span>
										) : null}
										<Badge variant={STATUS_VARIANT[row.route_status] ?? "outline"}>
											{ROUTE_STATUS_LABEL[row.route_status] ?? row.route_status}
										</Badge>
									</div>
								</TableCell>
							</TableRow>
						))}
						{trucks.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-10 text-center text-muted-foreground"
									colSpan={5}
								>
									No hay rutas programadas para hoy.
								</TableCell>
							</TableRow>
						) : null}
					</TableBody>
				</Table>
			</CardContent>
		</DashboardCard>
	);
}
