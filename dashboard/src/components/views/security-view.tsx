import { useState } from "react";
import { MapPinIcon, RefreshCwIcon } from "lucide-react";
import { DataCard, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api, type SecurityEventOut } from "@/lib/api";
import { SECURITY_EVENT_LABEL, formatDateTime, formatInteger } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async";

const ALL_TYPES = [
	"MOCK_GPS",
	"SPEED_ANOMALY",
	"TIMESTAMP_SKEW",
	"STALE_SCAN",
	"PIN_LOCKOUT",
	"DEVICE_LIMIT",
	"CROSS_TENANT",
	"MANIFEST_MISMATCH",
	"DUPLICATE_SCAN",
	"OTHER",
];

const NONE = "__none__";

type Coords = { latitude: number; longitude: number };

export function SecurityView() {
	const [type, setType] = useState(NONE);
	const [coords, setCoords] = useState<Coords | null>(null);

	const state = useAsyncData<SecurityEventOut[]>(
		() =>
			api<SecurityEventOut[]>(
				`/api/v1/admin/security-events?limit=200${
					type === NONE ? "" : `&event_type=${type}`
				}`,
			),
		[type],
	);

	const events = state.data ?? [];

	return (
		<div className="space-y-4">
			<PageHeader
				description={
					state.loading && !state.data
						? "Cargando eventos…"
						: `${formatInteger(events.length)} evento(s)`
				}
				title="Seguridad"
			>
				<div className="flex items-center gap-2">
					<Label className="text-muted-foreground text-xs" htmlFor="s-type">
						Tipo
					</Label>
					<Select onValueChange={setType} value={type}>
						<SelectTrigger className="w-56" id="s-type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE}>Todos los tipos</SelectItem>
							{ALL_TYPES.map((value) => (
								<SelectItem key={value} value={value}>
									{SECURITY_EVENT_LABEL[value] ?? value}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<Button onClick={state.reload} variant="outline">
					<RefreshCwIcon /> Actualizar
				</Button>
			</PageHeader>

			{state.error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
					{state.error}
				</div>
			) : null}

			<DataCard>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="ps-4">Fecha</TableHead>
							<TableHead>Tipo</TableHead>
							<TableHead>Usuario</TableHead>
							<TableHead>Dispositivo</TableHead>
							<TableHead>Ubicación</TableHead>
							<TableHead className="pe-4">Detalle</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{state.loading && !state.data ? (
							Array.from({ length: 5 }).map((_, index) => (
								<TableRow key={`event-skeleton-${index}`}>
									<TableCell colSpan={6}>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : events.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-10 text-center text-muted-foreground"
									colSpan={6}
								>
									Sin eventos de seguridad. Todo en orden.
								</TableCell>
							</TableRow>
						) : (
							events.map((event) => {
								const detail = JSON.stringify(event.detail ?? {});
								return (
									<TableRow key={event.id}>
										<TableCell className="ps-4 whitespace-nowrap text-muted-foreground text-xs">
											{formatDateTime(event.created_at)}
										</TableCell>
										<TableCell>
											<Badge variant="secondary">
												{SECURITY_EVENT_LABEL[event.event_type] ??
													event.event_type}
											</Badge>
										</TableCell>
										<TableCell>
											{event.user ? (
												event.user.full_name
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="font-mono text-xs">
											{event.device_uuid
												? `${event.device_uuid.slice(0, 14)}…`
												: "—"}
										</TableCell>
										<TableCell>
											{event.latitude != null && event.longitude != null ? (
												<Button
													onClick={() =>
														setCoords({
															latitude: event.latitude as number,
															longitude: event.longitude as number,
														})
													}
													size="sm"
													variant="ghost"
												>
													<MapPinIcon /> Ver
												</Button>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="pe-4 max-w-[280px]">
											<span
												className="block truncate font-mono text-xs text-muted-foreground"
												title={detail}
											>
												{detail.slice(0, 90)}
											</span>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</DataCard>

			<p className="text-muted-foreground text-xs">
				Señales capturadas por el motor antifraude: GPS simulado, velocidad
				imposible, relojes desfasados, escaneos fuera del manifiesto y bloqueos de
				licencia.
			</p>

			<MapDialog coords={coords} onClose={() => setCoords(null)} />
		</div>
	);
}

function MapDialog({
	coords,
	onClose,
}: {
	coords: Coords | null;
	onClose: () => void;
}) {
	const open = coords !== null;
	const delta = 0.008;
	const bbox = coords
		? `${coords.longitude - delta},${coords.latitude - delta},${
				coords.longitude + delta
			},${coords.latitude + delta}`
		: "";
	const src = coords
		? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`
		: "";
	const link = coords
		? `https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=16/${coords.latitude}/${coords.longitude}`
		: "#";

	return (
		<Dialog onOpenChange={(next) => (next ? undefined : onClose())} open={open}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Ubicación del evento</DialogTitle>
					<DialogDescription className="font-mono text-xs">
						{coords ? `${coords.latitude}, ${coords.longitude}` : ""}
					</DialogDescription>
				</DialogHeader>

				<div className="h-[340px] overflow-hidden rounded-lg border">
					{open ? (
						<iframe
							className="size-full"
							loading="lazy"
							src={src}
							title="Mapa del evento"
						/>
					) : null}
				</div>

				<a
					className="text-primary text-sm underline underline-offset-4"
					href={link}
					rel="noreferrer"
					target="_blank"
				>
					Abrir en OpenStreetMap
				</a>
			</DialogContent>
		</Dialog>
	);
}
