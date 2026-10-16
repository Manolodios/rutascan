/* Reports: Excel + PDF exports over a date range. */

import { api, downloadFile } from '../api.js';
import { esc, toast, todayISO } from '../ui.js';

export async function renderReports(root) {
  const today = todayISO();
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  root.innerHTML = `
    <div class="space-y-6 max-w-3xl">
      <div class="doc-card p-6 space-y-4">
        <h2 class="font-bold text-slate-700">Exportar historial de entregas</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="field">Desde</label>
            <input id="r-from" type="date" class="input" value="${weekAgo}" />
          </div>
          <div>
            <label class="field">Hasta</label>
            <input id="r-to" type="date" class="input" value="${today}" />
          </div>
          <div>
            <label class="field">Ruta (opcional)</label>
            <select id="r-route" class="select"><option value="">Todas las rutas del rango</option></select>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button data-preset="today" class="btn-secondary text-xs">Hoy</button>
          <button data-preset="7" class="btn-secondary text-xs">Últimos 7 días</button>
          <button data-preset="30" class="btn-secondary text-xs">Últimos 30 días</button>
        </div>
        <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          <button id="r-xlsx" class="btn-success">📊 Descargar Excel (.xlsx)</button>
          <button id="r-pdf" class="btn-primary">📄 Descargar PDF</button>
        </div>
        <p class="text-xs text-slate-400">
          El Excel incluye 3 hojas: entregas detalladas (con GPS y señales antifraude), cumplimiento por ruta e info general.
        </p>
      </div>

      <div class="doc-card p-6">
        <h2 class="font-bold text-slate-700 mb-3">Vista previa del rango</h2>
        <div id="r-preview" class="text-sm text-slate-500">Cargando…</div>
      </div>
    </div>`;

  const fromEl = document.getElementById('r-from');
  const toEl = document.getElementById('r-to');
  const routeEl = document.getElementById('r-route');
  const previewEl = document.getElementById('r-preview');

  async function loadRoutesForRange() {
    try {
      // Preview routes of the "from" day is not enough; load today's + from-day options.
      const days = new Set([fromEl.value, toEl.value]);
      const options = [];
      for (const day of days) {
        const routes = await api(`/api/v1/admin/routes?day=${day}`);
        routes.forEach((route) => {
          options.push(`<option value="${route.id}">${day} · ${esc(route.truck?.license_plate || '')} · ${esc(route.driver?.full_name || '')}</option>`);
        });
      }
      routeEl.innerHTML = `<option value="">Todas las rutas del rango</option>${options.join('')}`;
    } catch { /* non-blocking */ }
  }

  async function loadPreview() {
    previewEl.innerHTML = 'Cargando…';
    try {
      const summary = await api('/api/v1/admin/dashboard/summary');
      previewEl.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><div class="text-xs text-slate-400 font-semibold">RUTAS HOY</div><div class="text-xl font-bold">${summary.routes.total}</div></div>
          <div><div class="text-xs text-slate-400 font-semibold">UNIDADES ENTREGADAS</div><div class="text-xl font-bold">${summary.deliveries.delivered}</div></div>
          <div><div class="text-xs text-slate-400 font-semibold">CUMPLIMIENTO</div><div class="text-xl font-bold">${summary.deliveries.completion_pct}%</div></div>
          <div><div class="text-xs text-slate-400 font-semibold">ALERTAS 24H</div><div class="text-xl font-bold ${summary.alerts.security_events_24h ? 'text-rose-600' : ''}">${summary.alerts.security_events_24h}</div></div>
        </div>
        <p class="text-xs text-slate-400 mt-3">Resumen del día actual. El export respeta el rango y la ruta seleccionada.</p>`;
    } catch (err) {
      previewEl.innerHTML = `<span class="text-rose-600">${esc(err.message)}</span>`;
    }
  }

  function params() {
    const p = new URLSearchParams({ date_from: fromEl.value, date_to: toEl.value });
    if (routeEl.value) p.set('route_id', routeEl.value);
    return p.toString();
  }

  document.querySelectorAll('[data-preset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset === 'today') {
        fromEl.value = today; toEl.value = today;
      } else {
        const days = parseInt(preset, 10);
        toEl.value = today;
        fromEl.value = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      }
      loadRoutesForRange();
    }));

  document.getElementById('r-xlsx').addEventListener('click', async () => {
    try { const name = await downloadFile(`/api/v1/admin/reports/deliveries.xlsx?${params()}`, 'rutascan_entregas.xlsx'); toast(`Descargado: ${name}`, 'success'); }
    catch (err) { toast(err.message, 'error', 7000); }
  });
  document.getElementById('r-pdf').addEventListener('click', async () => {
    try { const name = await downloadFile(`/api/v1/admin/reports/deliveries.pdf?${params()}`, 'rutascan_entregas.pdf'); toast(`Descargado: ${name}`, 'success'); }
    catch (err) { toast(err.message, 'error', 7000); }
  });

  fromEl.addEventListener('change', loadRoutesForRange);
  await Promise.all([loadRoutesForRange(), loadPreview()]);
}
