/* Routes & assignment: create routes, load manifests (bulk/CSV), dispatch. */

import { api } from '../api.js';
import { badge, confirmDialog, esc, fmtDateTime, emptyState, openModal, toast, todayISO } from '../ui.js';

export async function renderRoutes(root) {
  let day = todayISO();
  root.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="field">Fecha</label>
          <input type="date" id="routes-day" class="input" value="${day}" />
        </div>
        <button id="new-route" class="btn-primary">＋ Nueva ruta</button>
        <div class="text-xs text-slate-500" id="routes-hint"></div>
      </div>
      <div id="routes-list" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"></div>
    </div>`;

  const listEl = document.getElementById('routes-list');

  async function load() {
    listEl.innerHTML = '<div class="doc-card p-6 text-sm text-slate-400">Cargando rutas…</div>';
    const routes = await api(`/api/v1/admin/routes?day=${day}`);
    document.getElementById('routes-hint').textContent =
      `${routes.length} ruta(s) · ${routes.reduce((acc, r) => acc + r.counts.assigned_units, 0)} unidades asignadas`;
    if (!routes.length) {
      listEl.innerHTML = '<div class="doc-card p-10 text-center text-slate-400 text-sm col-span-full">No hay rutas creadas para esta fecha.</div>';
      return;
    }
    listEl.innerHTML = routes.map((route) => routeCard(route)).join('');
    listEl.querySelectorAll('[data-manifest]').forEach((btn) =>
      btn.addEventListener('click', () => openManifest(btn.dataset.manifest, load)));
    listEl.querySelectorAll('[data-delete-route]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const card = btn.closest('[data-route-id]');
        confirmDialog('Eliminar ruta', 'Se eliminará la ruta y su manifiesto. Solo permitido si está PENDING.', async () => {
          await api(`/api/v1/admin/routes/${btn.dataset.deleteRoute}`, { method: 'DELETE' });
          toast('Ruta eliminada', 'success');
          load();
        });
      }));
  }

  function routeCard(route) {
    const c = route.counts;
    return `
      <div class="doc-card p-5 flex flex-col gap-3" data-route-id="${route.id}">
        <div class="flex items-start justify-between">
          <div>
            <div class="font-bold text-slate-800">${esc(route.truck?.license_plate || '—')} <span class="text-slate-400 font-normal text-sm">${esc(route.truck?.model || '')}</span></div>
            <div class="text-xs text-slate-500 mt-0.5">👤 ${esc(route.driver?.full_name || 'Sin conductor asignado')}</div>
          </div>
          ${badge(route.status)}
        </div>
        <div>
          <div class="h-1.5 bg-slate-100 rounded overflow-hidden">
            <div class="h-full bg-emerald-500" style="width:${c.completion_pct}%"></div>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>${c.lines} líneas · ${c.assigned_units} unidades</span>
            <span>${c.delivered_units} entregadas (${c.completion_pct}%)</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span>${c.rejected_lines} rechazos · ${c.in_truck_lines} por entregar</span>
          <span>${route.completed_at ? `✔ ${fmtDateTime(route.completed_at)}` : route.started_at ? `▶ ${fmtDateTime(route.started_at)}` : ''}</span>
        </div>
        <div class="flex gap-2 pt-1">
          <button data-manifest="${route.id}" class="btn-secondary flex-1 justify-center">📋 Manifiesto</button>
          ${route.status === 'PENDING' ? `<button data-delete-route="${route.id}" class="btn-danger">🗑</button>` : ''}
        </div>
      </div>`;
  }

  document.getElementById('routes-day').addEventListener('change', (event) => {
    day = event.target.value;
    load();
  });

  document.getElementById('new-route').addEventListener('click', async () => {
    const [trucks, drivers, products] = await Promise.all([
      api('/api/v1/admin/trucks'),
      api('/api/v1/admin/users/drivers'),
      api('/api/v1/admin/products?limit=1000'),
    ]);
    const activeTrucks = trucks.filter((t) => t.is_active);
    openModal({
      title: 'Nueva ruta',
      body: `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="field">Camión *</label>
            <select id="nr-truck" class="select">
              ${activeTrucks.map((t) => `<option value="${t.id}" ${t.has_route_today ? 'disabled' : ''}>${esc(t.license_plate)} · ${esc(t.model || '')} ${t.has_route_today ? '(ya tiene ruta hoy)' : ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="field">Conductor</label>
            <select id="nr-driver" class="select">
              <option value="">— usar el asignado del camión —</option>
              ${drivers.map((d) => `<option value="${d.id}">${esc(d.full_name)} (${esc(d.user_cedula)})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="field">Fecha *</label>
            <input id="nr-date" type="date" class="input" value="${day}" />
          </div>
          <div>
            <label class="field">Notas</label>
            <input id="nr-notes" class="input" placeholder="Opcional" />
          </div>
        </div>`,
      confirmText: 'Crear ruta',
      onConfirm: async (wrap) => {
        const payload = {
          truck_id: wrap.querySelector('#nr-truck').value,
          driver_id: wrap.querySelector('#nr-driver').value || null,
          route_date: wrap.querySelector('#nr-date').value,
          notes: wrap.querySelector('#nr-notes').value || null,
        };
        if (!payload.truck_id) throw new Error('Seleccione un camión');
        const created = await api('/api/v1/admin/routes', { method: 'POST', body: payload });
        toast(`Ruta ${created.truck.license_plate} creada`, 'success');
        day = payload.route_date;
        document.getElementById('routes-day').value = day;
        await load();
        setTimeout(() => openManifest(created.id, load), 300);
      },
    });
  });

  await load();
}

async function openManifest(routeId, onChange) {
  const modal = openModal({ title: 'Manifiesto de ruta', size: 'max-w-5xl', body: '<div class="text-sm text-slate-400">Cargando…</div>' });

  async function paint() {
    const [route, products] = await Promise.all([
      api(`/api/v1/admin/routes/${routeId}`),
      api('/api/v1/admin/products?limit=1000'),
    ]);
    const c = route.counts;
    modal.body.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div class="font-bold">${esc(route.truck?.license_plate || '—')} · ${esc(route.driver?.full_name || 'Sin conductor')}</div>
            <div class="text-xs text-slate-500">${route.route_date} · ${c.lines} líneas · ${c.assigned_units} unidades asignadas</div>
          </div>
          <div class="flex items-center gap-2">
            ${badge(route.status)}
            ${route.status === 'PENDING' ? `
              <label class="btn-secondary cursor-pointer">⬆ Importar CSV
                <input id="manifest-csv" type="file" accept=".csv" class="hidden" />
              </label>
              <button id="dispatch-btn" class="btn-success">🚀 Despachar</button>` : ''}
          </div>
        </div>

        ${route.status === 'PENDING' ? `
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <div class="text-xs font-semibold text-slate-500 mb-2">CARGAR PRODUCTOS (bodega)</div>
          <div class="flex flex-wrap gap-2 items-end">
            <div class="flex-1 min-w-[240px]">
              <select id="add-product" class="select">
                ${products.map((p) => `<option value="${p.id}">${esc(p.barcode_qr)} · ${esc(p.description)}</option>`).join('')}
              </select>
            </div>
            <div class="w-28"><input id="add-qty" type="number" min="1" value="1" class="input" /></div>
            <button id="add-line" class="btn-primary">＋ Agregar</button>
          </div>
          <p class="text-[11px] text-slate-400 mt-2">CSV de importación: columnas <code>barcode_qr, quantity</code>.</p>
        </div>` : ''}

        <div class="overflow-x-auto">
          <table class="data w-full">
            <thead><tr><th>Producto</th><th>Código</th><th>Asignado</th><th>Entregado</th><th>Estado</th><th>Último escaneo</th><th></th></tr></thead>
            <tbody>
              ${route.details.map((d) => `
                <tr>
                  <td>${esc(d.product.description)}</td>
                  <td class="font-mono text-xs">${esc(d.product.barcode_qr)}</td>
                  <td>${d.assigned_quantity}</td>
                  <td>${d.delivered_quantity}</td>
                  <td>${badge(d.status)} ${d.return_required ? '<span class="text-[10px] text-amber-600 font-semibold">REINGRESO</span>' : ''}</td>
                  <td class="text-xs text-slate-500">${fmtDateTime(d.last_scan_at)}</td>
                  <td>${route.status === 'PENDING' ? `<button data-remove="${d.id}" class="text-rose-500 hover:text-rose-700 text-sm">✕</button>` : ''}</td>
                </tr>`).join('') || emptyState('Manifiesto vacío: agregue productos o importe un CSV', 7)}
            </tbody>
          </table>
        </div>
      </div>`;

    modal.body.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        await api(`/api/v1/admin/routes/${routeId}/details/${btn.dataset.remove}`, { method: 'DELETE' });
        toast('Ítem removido', 'success');
        await paint();
        onChange?.();
      }));

    const addBtn = modal.body.querySelector('#add-line');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const productId = modal.body.querySelector('#add-product').value;
        const qty = parseInt(modal.body.querySelector('#add-qty').value, 10);
        if (!productId || !qty || qty < 1) { toast('Seleccione producto y cantidad', 'warn'); return; }
        await api(`/api/v1/admin/routes/${routeId}/details`, {
          method: 'POST',
          body: { items: [{ product_id: productId, assigned_quantity: qty }] },
        });
        toast('Producto agregado al manifiesto', 'success');
        await paint();
        onChange?.();
      });
    }

    const csvInput = modal.body.querySelector('#manifest-csv');
    if (csvInput) {
      csvInput.addEventListener('change', async () => {
        const file = csvInput.files[0];
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        const result = await api(`/api/v1/admin/routes/${routeId}/details/import`, { method: 'POST', form });
        toast(`Importado: ${result.created} nuevos, ${result.updated} actualizados${result.errors.length ? `, ${result.errors.length} errores` : ''}`, result.errors.length ? 'warn' : 'success', 6000);
        if (result.errors.length) console.warn('Errores de importación', result.errors);
        await paint();
        onChange?.();
      });
    }

    const dispatchBtn = modal.body.querySelector('#dispatch-btn');
    if (dispatchBtn) {
      dispatchBtn.addEventListener('click', async () => {
        await api(`/api/v1/admin/routes/${routeId}/dispatch`, { method: 'POST' });
        toast('Ruta despachada: el conductor ya puede operar.', 'success');
        await paint();
        onChange?.();
      });
    }
  }

  await paint();
}
