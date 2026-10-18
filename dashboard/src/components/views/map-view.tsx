import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPinIcon, RefreshCwIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RouteStatusBadge } from "@/components/views/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type LiveMap, type LiveMapTruck } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
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

function LiveMapCanvas({ trucks }: { trucks: LiveMapTruck[] }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<L.Map | null>(null);
	const layerRef = useRef<L.LayerGroup | null>(null);

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
			map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
		}
	}, [trucks]);

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
	const state = useAsyncData<LiveMap>(
		() => api<LiveMap>("/api/v1/admin/dashboard/live-map"),
		[],
	);
	const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

	const reload = state.reload;

	useEffect(() => {
		const timer = setInterval(reload, POLL_MS);
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
						Flota del {data?.date ?? "—"}
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
							<span className="text-muted-foreground text-xs">
								{withPosition} de {trucks.length} camiones con GPS
							</span>
						</div>
						<LiveMapCanvas trucks={trucks} />
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
								No hay rutas para hoy.
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
