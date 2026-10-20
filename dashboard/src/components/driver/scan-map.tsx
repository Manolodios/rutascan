import { useEffect, useMemo, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DriverScan } from "@/lib/api";
import { ACTION_LABEL, formatDateTime } from "@/lib/format";

/** Cabimas (Zulia), used while there is no GPS point to fit. */
const DEFAULT_CENTER: L.LatLngExpression = [10.399, -71.436];
const DEFAULT_ZOOM = 12;

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function actionColor(action: string): string {
	if (action === "DELIVER") return "#16a34a";
	if (action === "REJECT") return "#dc2626";
	return "#2f7ef7";
}

/** Today's scan trail of the signed-in driver. */
export function DriverScanMap({ scans }: { scans: DriverScan[] }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<L.Map | null>(null);
	const layerRef = useRef<L.LayerGroup | null>(null);

	const points = useMemo(
		() =>
			scans
				.filter(
					(scan): scan is DriverScan & { latitude: number; longitude: number } =>
						scan.latitude !== null && scan.longitude !== null,
				)
				.sort((a, b) => a.at.localeCompare(b.at)),
		[scans],
	);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || mapRef.current) return;

		const map = L.map(container, {
			center: DEFAULT_CENTER,
			zoom: DEFAULT_ZOOM,
			zoomControl: true,
		});
		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 19,
		}).addTo(map);

		mapRef.current = map;
		layerRef.current = L.layerGroup().addTo(map);

		// The card sometimes mounts before the grid has its final size.
		const timer = window.setTimeout(() => map.invalidateSize(), 150);

		return () => {
			window.clearTimeout(timer);
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
		if (points.length === 0) {
			map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
			return;
		}

		const latlngs = points.map(
			(point) => [point.latitude, point.longitude] as [number, number],
		);

		if (latlngs.length > 1) {
			L.polyline(latlngs, { color: "#2f7ef7", weight: 4, opacity: 0.65 }).addTo(layer);
		}

		for (const point of points) {
			L.circleMarker([point.latitude, point.longitude], {
				radius: 7,
				color: "#fff",
				weight: 2,
				fillColor: actionColor(point.action),
				fillOpacity: 1,
			})
				.bindPopup(
					`<strong>${escapeHtml(ACTION_LABEL[point.action] ?? point.action)}</strong><br/>` +
						`${escapeHtml(point.product)}<br/>` +
						`<span style="font-size:11px;color:#64748b">${escapeHtml(
							formatDateTime(point.at),
						)}</span>`,
				)
				.addTo(layer);
		}

		map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30], maxZoom: 15 });
	}, [points]);

	return (
		<div className="relative">
			<div ref={containerRef} className="h-72 w-full" />
			{points.length === 0 ? (
				<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 px-6 text-center">
					<p className="font-medium text-sm">Todavía no hay ubicaciones hoy</p>
					<p className="text-muted-foreground text-xs">
						El mapa se dibuja con los escaneos que hagas desde la app del celular.
					</p>
				</div>
			) : null}
		</div>
	);
}
