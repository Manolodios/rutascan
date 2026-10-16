/* Audit: anti-fraud security events. */

import { api } from '../api.js';
import { badge, emptyState, esc, fmtDateTime, openModal } from '../ui.js';

const ALL_TYPES = ['MOCK_GPS', 'SPEED_ANOMALY', 'TIMESTAMP_SKEW', 'STALE_SCAN', 'PIN_LOCKOUT', 'DEVICE_LIMIT', 'CROSS_TENANT', 'MANIFEST_MISMATCH', 'DUPLICATE_SCAN', 'OTHER'];

export async function renderSecurity(root) {
  root.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="field">Tipo de evento</label>
          <select id="s-type" class="select">
            <option value="">Todos</option>
            ${ALL_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <button id="s-refresh" class="btn-secondary">↻ Actualizar</button>
        <div class="text-xs text-slate-500" id="s-hint"></div>
      </div>
      <div class="doc-card overflow-x-auto">
        <table class="data w-full">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Usuario</th><th>Dispositivo</th><th>Ubicación</th><th>Detalle</th></tr></thead>
          <tbody id="s-rows"></tbody>
        </table>
      </div>
      <p class="text-xs text-slate-400">
        Señales capturadas por el motor antifraude: GPS simulado, velocidad imposible, relojes desfasados, escaneos fuera del manifiesto y bloqueos de licencia.
      </p>
    </div>`;

  const rowsEl = document.getElementById('s-rows');

  async function load() {
    const type = document.getElementById('s-type').value;
    const events = await api(`/api/v1/admin/security-events?limit=200${type ? `&event_type=${type}` : ''}`);
    document.getElementById('s-hint').textContent = `${events.length} evento(s)`;
    rowsEl.innerHTML = events.map((e) => `
      <tr>
        <td class="text-xs text-slate-500 whitespace-nowrap">${fmtDateTime(e.created_at)}</td>
        <td>${badge(e.event_type)}</td>
        <td>${e.user ? esc(e.user.full_name) : '<span class="text-slate-300">—</span>'}</td>
        <td class="font-mono text-[11px] text-slate-500">${esc((e.device_uuid || '—').slice(0, 14))}</td>
        <td class="text-xs">${e.latitude != null ? `<button data-coords="${e.latitude},${e.longitude}" class="text-brand-600 hover:underline">📍 ver</button>` : '<span class="text-slate-300">—</span>'}</td>
        <td class="text-xs text-slate-500 max-w-[280px] truncate" title='${esc(JSON.stringify(e.detail || {}))}'>${esc(JSON.stringify(e.detail || {}).slice(0, 90))}</td>
      </tr>`).join('') || emptyState('Sin eventos de seguridad. Todo en orden ✔', 6);

    rowsEl.querySelectorAll('[data-coords]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const [lat, lon] = btn.dataset.coords.split(',');
        openModal({
          title: 'Ubicación del evento',
          size: 'max-w-2xl',
          body: `
            <div id="event-map" style="height:340px" class="rounded-lg border border-slate-200"></div>
            <p class="text-xs text-slate-500 mt-2">${esc(lat)}, ${esc(lon)}</p>`,
        });
        const map = L.map('event-map').setView([parseFloat(lat), parseFloat(lon)], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
        L.marker([parseFloat(lat), parseFloat(lon)]).addTo(map);
      }));
  }

  document.getElementById('s-type').addEventListener('change', load);
  document.getElementById('s-refresh').addEventListener('click', load);
  await load();
}
