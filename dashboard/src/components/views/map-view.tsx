import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixedIcon, MapPinIcon, RefreshCwIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RouteStatusBadge } from "@/components/views/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api, type LiveMap, type LiveMapTruck } from "@/lib/api";
import { formatDateTime, formatLongDate, todayISO } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async";

/** Cabimas (Zulia), used until there is at least one GPS point to fit. */
const DEFAULT_CENTER: L.LatLngExpression = [10.399, -71.436];
const DEFAULT_ZOOM = 12;
const POLL_MS = 10_000;
/** A position younger than this is drawn green ("live"). */
const FRESH_MINUTES = 10;

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function pinHtml(fresh: boolean, mockGps: boolean): string {
	const color = mockGps ? "#dc2626" : fresh ? "#16a34a" : "#2f7ef7";
	return (
		`<div style="background:${color};width:18px;height:18px;border-radius:9999px;` +
		`border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div>`
	);
}

function popupHtml(truck: LiveMapTruck): string {
	const position = truck.last_position;
	if (!position) return "";
	const rows = [
		`<strong>${escapeHtml(truck.truck.license_plate)}</strong>${
			truck.truck.model ? ` · ${escapeHtml(truck.truck.model)}` : ""
		}`,
		`<span style="color:#475569">${escapeHtml(
			truck.driver?.full_name ?? "Sin conductor asignado",
		)}</span>`,
		`<span style="font-size:11px;color:#64748b">Último punto: ${escapeHtml(
			formatDateTime(position.at),
		)} (${position.minutes_ago} min)</span>`,
		`<span style="font-size:12px">✅ ${truck.counts.delivered} · ❌ ${truck.counts.rejected} · 📦 ${truck.counts.in_truck} · <b>${truck.completion_pct}%</b></span>`,
	];
	if (position.mock_gps) {
		rows.push(
			'<span style="color:#dc2626;font-size:11px">⚠ GPS FALSO DETECTADO</span>',
		);
	}
	return `<div style="min-width:190px">${rows.join("<br/>")}</div>`;
}

function LiveMapCanvas({
	trucks,
	focusToken,
}: {
	trucks: LiveMapTruck[];
	focusToken: number;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<L.Map | null>(null);
	const layerRef = useRef<L.LayerGroup | null>(null);
	const hasFittedRef = useRef(false);
	const lastFocusRef = useRef(0);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const map = L.map(element).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			maxZoom: 19,
			attribution: "&copy; OpenStreetMap",
		}).addTo(map);

		mapRef.current = map;
		layerRef.current = L.layerGroup().addTo(map);
		// Si el mapa se recrea (StrictMode / remount), vuelve a encuadrar.
		hasFittedRef.current = false;

		return () => {
			map.remove();
			mapRef.current = null;
			layerRef.current = null;
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		const layer = layerRef.current;
		if (!map || !layer) return;

		layer.clearLayers();
		const bounds: [number, number][] = [];

		for (const truck of trucks) {
			const position = truck.last_position;
			if (!position || position.latitude == null || position.longitude == null) {
				continue;
			}
			const marker = L.marker([position.latitude, position.longitude], {
				icon: L.divIcon({
					className: "",
					html: pinHtml(position.minutes_ago <= FRESH_MINUTES, position.mock_gps),
					iconSize: [18, 18],
					iconAnchor: [9, 9],
				}),
			});
			marker.bindPopup(popupHtml(truck));
			marker.addTo(layer);
			bounds.push([position.latitude, position.longitude]);
		}

		if (bounds.length > 0) {
			// Solo encuadrar la primera vez o cuando el usuario pulsa "Centrar":
			// el sondeo no debe mover el mapa mientras lo está revisando.
			if (!hasFittedRef.current || focusToken !== lastFocusRef.current) {
				map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
				hasFittedRef.current = true;
				lastFocusRef.current = focusToken;
			}
		} else if (focusToken !== lastFocusRef.current) {
			map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
			lastFocusRef.current = focusToken;
		}
	}, [trucks, focusToken]);

	return <div className="h-[560px] w-full" ref={containerRef} />;
}

function TruckCard({ truck }: { truck: LiveMapTruck }) {
	const position = truck.last_position;
	return (
		<div className="rounded-lg border p-3">
			<div className="flex items-center justify-between gap-2">
				<div className="font-semibold text-sm">
					{truck.truck.license_plate}{" "}
					{truck.truck.model ? (
						<span className="font-normal text-muted-foreground">
							{truck.truck.model}
						</span>
					) : null}
				</div>
				<RouteStatusBadge status={truck.route_status} />
			</div>
			<div className="text-muted-foreground text-xs">
				{truck.driver?.full_name ?? "Sin conductor asignado"}
			</div>
			<Progress className="mt-2 h-1.5" value={truck.completion_pct} />
			<div className="mt-1 flex justify-between text-xs text-muted-foreground">
				<span>
					✅ {truck.counts.delivered} · ❌ {truck.counts.rejected} · 📦{" "}
					{truck.counts.in_truck}
				</span>
				<span>{truck.completion_pct}%</span>
			</div>
			<div
				className={`mt-1 text-xs ${
					position ? "text-muted-foreground" : "text-amber-600"
				}`}
			>
				{position
					? `📍 Último punto: ${formatDateTime(position.at)} (${position.minutes_ago} min)`
					: "Sin posiciones capturadas hoy"}
				{position?.mock_gps ? (
					<span className="text-destructive"> · ⚠ GPS falso</span>
				) : null}
			</div>
		</div>
	);
}

export function MapView() {
	const [day, setDay] = useState(todayISO());
	const state = useAsyncData<LiveMap>(
		() => api<LiveMap>(`/api/v1/admin/dashboard/live-map?day=${day}`),
		[day],
	);
	const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
	const [focusToken, setFocusToken] = useState(0);

	const reload = state.reload;

	useEffect(() => {
		const tick = () => {
			// No gastar peticiones ni CPU con la pestaña en segundo plano.
			if (!document.hidden) reload();
		};
		const timer = setInterval(tick, POLL_MS);
		return () => clearInterval(timer);
	}, [reload]);

	const data = state.data;

	useEffect(() => {
		if (data) setUpdatedAt(new Date());
	}, [data]);

	if (state.loading && !data) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-[560px] w-full" />
			</div>
		);
	}

	if (state.error && !data) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
				{state.error}
			</div>
		);
	}

	const trucks = data?.trucks ?? [];
	const withPosition = trucks.filter(
		(truck) => truck.last_position?.latitude != null,
	).length;

	return (
		<div className="space-y-4">
			<PageHeader
				description={
					<span>
						Flota del {data?.date ? formatLongDate(data.date) : "—"}
						{updatedAt
							? ` · actualizado ${updatedAt.toLocaleTimeString("es-VE", {
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
								})}`
							: ""}{" "}
						· se actualiza solo cada 10 s
					</span>
				}
				title="Mapa en vivo"
			>
				<Button disabled={state.loading} onClick={reload} size="sm" variant="outline">
					<RefreshCwIcon />
					{state.loading ? "Actualizando…" : "Actualizar"}
				</Button>
				<div className="flex items-center gap-2">
					<Label className="text-muted-foreground text-xs" htmlFor="map-day">
						Fecha
					</Label>
					<Input
						className="h-7 w-36 text-xs"
						id="map-day"
						onChange={(event) => setDay(event.target.value)}
						type="date"
						value={day}
					/>
				</div>
			</PageHeader>

			{state.error ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-destructive text-sm">
					{state.error}
				</div>
			) : null}

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<div className="xl:col-span-2">
					<Card className="gap-0 overflow-hidden py-0">
						<div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
							<div className="flex items-center gap-2 font-heading font-medium text-sm">
								<MapPinIcon className="size-4 text-muted-foreground" />
								Última posición por camión
							</div>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground text-xs">
									{withPosition} de {trucks.length} camiones con GPS
								</span>
								<Button
									className="h-7 gap-1 px-2 text-xs"
									onClick={() => setFocusToken((value) => value + 1)}
									size="sm"
									variant="ghost"
								>
									<LocateFixedIcon className="size-3.5" />
									Centrar
								</Button>
							</div>
						</div>
						<div className="relative">
							<LiveMapCanvas focusToken={focusToken} trucks={trucks} />
							{withPosition === 0 ? (
								<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 p-6">
									<div className="max-w-xs rounded-lg border bg-card/95 px-4 py-3 text-center shadow-sm">
										<p className="font-medium text-sm">Sin posiciones GPS para el {formatLongDate(day)}</p>
										<p className="mt-1 text-muted-foreground text-xs">
											{trucks.length === 0
												? `No hay rutas para el ${formatLongDate(day)}.`
												: "Los camiones aparecerán aquí cuando la app del conductor envíe su ubicación."}
										</p>
									</div>
								</div>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-4 border-t px-4 py-2 text-muted-foreground text-xs">
							<span className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-full bg-[#16a34a]" />
								Menos de {FRESH_MINUTES} min
							</span>
							<span className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-full bg-[#2f7ef7]" />
								Posición anterior
							</span>
							<span className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-full bg-[#dc2626]" />
								GPS falso detectado
							</span>
						</div>
					</Card>
				</div>

				<Card className="flex max-h-[640px] min-h-0 flex-col gap-0 overflow-hidden py-0">
					<div className="border-b px-4 py-2.5 font-heading font-medium text-sm">
						Flota en ruta
					</div>
					<div className="flex-1 space-y-2 overflow-y-auto p-3">
						{trucks.length === 0 ? (
							<div className="py-10 text-center text-muted-foreground text-sm">
								No hay rutas para el {formatLongDate(day)}.
							</div>
						) : (
							trucks.map((truck) => (
								<TruckCard key={truck.route_id} truck={truck} />
							))
						)}
					</div>
				</Card>
			</div>
		</div>
	);
}
