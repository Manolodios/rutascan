/* Live map: Leaflet with the last GPS waypoint captured per truck. */

import { api } from '../api.js';
import { badge, esc, fmtDateTime, toast } from '../ui.js';

let timer = null;
let map = null;
let markers = [];

export async function renderMap(root) {
  root.innerHTML = `
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      <div class="doc-card xl:col-span-2 p-2">
        <div id="leaflet-map"></div>
      </div>
      <div class="doc-card flex flex-col min-h-0">
        <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 class="font-bold text-slate-700">Flota en ruta</h2>
          <span class="text-[11px] text-slate-400" id="map-updated">—</span>
        </div>
        <div id="truck-list" class="p-3 space-y-2 overflow-y-auto scroll-thin flex-1"></div>
      </div>
    </div>`;

  // Leaflet needs the container in the DOM before init.
  map = L.map('leaflet-map', { zoomControl: true }).setView([4.6533, -74.0836], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  async function refresh() {
    const data = await api('/api/v1/admin/dashboard/live-map');
    paint(root, data);
  }

  try {
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
  document.getElementById('map-updated').textContent = `Actualizado ${new Date().toLocaleTimeString('es-CO')}`;

  clearInterval(timer);
  timer = setInterval(() => {
    refresh()
      .then(() => { document.getElementById('map-updated').textContent = `Actualizado ${new Date().toLocaleTimeString('es-CO')}`; })
      .catch(() => {});
  }, 10000);

  return () => {
    clearInterval(timer);
    if (map) { map.remove(); map = null; }
    markers = [];
  };
}

function paint(root, data) {
  markers.forEach((m) => m.remove());
  markers = [];
  const bounds = [];

  data.trucks.forEach((truck) => {
    if (truck.last_position) {
      const { latitude, longitude } = truck.last_position;
      const isNew = truck.last_position.minutes_ago <= 10;
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${isNew ? '#16a34a' : '#1a5fe4'};width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker([latitude, longitude], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:190px">
            <strong>${esc(truck.truck.license_plate)}</strong> · ${esc(truck.truck.model || '')}<br/>
            <span style="color:#475569">${esc(truck.driver?.full_name || 'Sin conductor')}</span><br/>
            <span style="font-size:11px;color:#64748b">Último escaneo: ${fmtDateTime(truck.last_position.at)} (${truck.last_position.minutes_ago} min)</span><br/>
            <span style="font-size:12px">✅ ${truck.counts.delivered} · ❌ ${truck.counts.rejected} · 📦 ${truck.counts.in_truck} · <b>${truck.completion_pct}%</b></span>
            ${truck.last_position.mock_gps ? '<br/><span style="color:#dc2626;font-size:11px">⚠ GPS FALSO DETECTADO</span>' : ''}
          </div>`);
      markers.push(marker);
      bounds.push([latitude, longitude]);
    }
  });

  if (bounds.length && map) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  const list = document.getElementById('truck-list');
  list.innerHTML = data.trucks.map((truck) => `
    <div class="rounded-lg border border-slate-200 p-3">
      <div class="flex items-center justify-between">
        <div class="font-semibold text-sm">${esc(truck.truck.license_plate)} <span class="text-slate-400 font-normal">${esc(truck.truck.model || '')}</span></div>
        ${badge(truck.route_status)}
      </div>
      <div class="text-xs text-slate-500 mt-0.5">${esc(truck.driver?.full_name || 'Sin conductor asignado')}</div>
      <div class="mt-2 h-1.5 bg-slate-100 rounded overflow-hidden">
        <div class="h-full bg-emerald-500" style="width:${truck.completion_pct}%"></div>
      </div>
      <div class="flex justify-between text-[11px] text-slate-500 mt-1">
        <span>✅ ${truck.counts.delivered} · ❌ ${truck.counts.rejected} · 📦 ${truck.counts.in_truck}</span>
        <span>${truck.completion_pct}%</span>
      </div>
      <div class="text-[11px] mt-1 ${truck.last_position ? 'text-slate-400' : 'text-amber-600'}">
        ${truck.last_position ? `📍 Último punto: ${fmtDateTime(truck.last_position.at)}` : 'Sin posiciones capturadas hoy'}
      </div>
    </div>`).join('') || '<div class="text-sm text-slate-400 text-center py-8">No hay rutas para hoy</div>';
}
