/* Dashboard: KPIs, weekly trend, alerts and recent activity. */

import { api } from '../api.js';
import { badge, esc, fmtDateTime, skeleton, toast } from '../ui.js';

let timer = null;

export async function renderDashboard(root) {
  root.innerHTML = skeleton(4);

  async function refresh() {
    const [summary, activity] = await Promise.all([
      api('/api/v1/admin/dashboard/summary'),
      api('/api/v1/admin/dashboard/activity?limit=12'),
    ]);
    paint(root, summary, activity);
  }

  try {
    await refresh();
  } catch (err) {
    root.innerHTML = `<div class="doc-card p-6 text-sm text-rose-600">${esc(err.message)}</div>`;
    return;
  }

  clearInterval(timer);
  timer = setInterval(() => refresh().catch(() => {}), 30000);
  return () => clearInterval(timer);
}

function paint(root, summary, activity) {
  const d = summary.deliveries;
  const max = Math.max(1, ...summary.weekly.map((w) => w.DELIVER + w.REJECT + w.LOAD));

  const kpis = [
    {
      label: 'Camiones en ruta',
      value: `${summary.trucks.active_on_route}/${summary.trucks.total}`,
      hint: `Rutas hoy: ${summary.routes.total} (${summary.routes.completed} completadas)`,
      color: 'text-brand-700',
    },
    {
      label: 'Cumplimiento de entregas',
      value: `${d.completion_pct}%`,
      hint: `${d.delivered} de ${d.assigned} unidades entregadas`,
      color: 'text-emerald-700',
    },
    {
      label: 'Ítems por entregar',
      value: d.in_truck,
      hint: `Rechazados hoy: ${d.rejected} · Devoluciones pendientes: ${d.returns_pending}`,
      color: 'text-amber-700',
    },
    {
      label: 'Alertas (24h)',
      value: summary.alerts.security_events_24h,
      hint: Object.entries(summary.alerts.by_type).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Sin novedades',
      color: summary.alerts.security_events_24h ? 'text-rose-700' : 'text-slate-700',
    },
  ];

  root.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${kpis.map((kpi) => `
          <div class="doc-card p-5">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">${esc(kpi.label)}</div>
            <div class="kpi-value mt-1 ${kpi.color}">${kpi.value}</div>
            <div class="text-xs text-slate-500 mt-1">${esc(kpi.hint)}</div>
          </div>`).join('')}
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="doc-card p-5 xl:col-span-1">
          <h2 class="font-bold text-slate-700 mb-4">Últimos 7 días</h2>
          <div class="flex items-end gap-2 h-40">
            ${summary.weekly.map((day) => {
              const total = day.DELIVER + day.REJECT + day.LOAD;
              const h = Math.round((total / max) * 100);
              return `
                <div class="flex-1 flex flex-col items-center gap-1">
                  <div class="w-full flex flex-col justify-end" style="height:130px">
                    <div class="w-full bg-emerald-500 rounded-t" style="height:${Math.round((day.DELIVER / max) * 100)}%"></div>
                    <div class="w-full bg-rose-400" style="height:${Math.round((day.REJECT / max) * 100)}%"></div>
                    <div class="w-full bg-slate-300 rounded-b" style="height:${Math.round((day.LOAD / max) * 100)}%"></div>
                  </div>
                  <div class="text-[10px] text-slate-500">${day.date.slice(5)}</div>
                  <div class="text-[10px] font-semibold text-slate-700">${total}</div>
                </div>`;
            }).join('')}
          </div>
          <div class="flex gap-4 mt-3 text-[11px] text-slate-500">
            <span><span class="pulse-dot bg-emerald-500"></span> Entregas</span>
            <span><span class="pulse-dot bg-rose-400"></span> Rechazos</span>
            <span><span class="pulse-dot bg-slate-300"></span> Cargas</span>
          </div>
        </div>

        <div class="doc-card xl:col-span-2">
          <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h2 class="font-bold text-slate-700">Actividad reciente</h2>
            <span class="text-[11px] text-slate-400">Actualiza cada 30 s</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data w-full">
              <thead><tr><th>Hora</th><th>Evento</th><th>Producto</th><th>Conductor</th><th>Señales</th></tr></thead>
              <tbody>
                ${activity.map((row) => `
                  <tr>
                    <td class="whitespace-nowrap text-slate-500">${fmtDateTime(row.at)}</td>
                    <td>${badge(row.action)} ${row.offline ? '<span class="text-[10px] text-amber-600 font-semibold">OFFLINE</span>' : ''}</td>
                    <td>
                      <div class="font-medium text-slate-700">${esc(row.product)}</div>
                      <div class="text-[11px] text-slate-400 font-mono">${esc(row.barcode)}</div>
                    </td>
                    <td>${esc(row.driver)}</td>
                    <td>${Object.keys(row.flags || {}).length ? `<span class="text-[11px] text-rose-600 font-semibold">${esc(Object.keys(row.flags).join(', '))}</span>` : '<span class="text-slate-300">—</span>'}</td>
                  </tr>`).join('') || '<tr><td colspan="5" class="text-center text-slate-400 py-8 text-sm">Sin actividad todavía</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${summary.deliveries.returns_pending ? `
        <div class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>${summary.deliveries.returns_pending} devolución(es) pendiente(s):</strong>
          ítems rechazados que deben reingresar a bodega al finalizar la ruta.
        </div>` : ''}
    </div>`;
}
