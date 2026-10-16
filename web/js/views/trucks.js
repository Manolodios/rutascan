/* Trucks: fleet CRUD + driver assignment. */

import { api } from '../api.js';
import { badge, esc, emptyState, openModal, toast } from '../ui.js';

export async function renderTrucks(root) {
  root.innerHTML = `
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <div class="text-sm text-slate-500" id="t-hint"></div>
        <button id="t-new" class="btn-primary">＋ Nuevo camión</button>
      </div>
      <div class="doc-card overflow-x-auto">
        <table class="data w-full">
          <thead><tr><th>Placa</th><th>Modelo</th><th>Conductor asignado</th><th>Estado</th><th>Ruta de hoy</th><th></th></tr></thead>
          <tbody id="t-rows"></tbody>
        </table>
      </div>
    </div>`;

  const rowsEl = document.getElementById('t-rows');

  async function load() {
    const [trucks, drivers] = await Promise.all([
      api('/api/v1/admin/trucks'),
      api('/api/v1/admin/users/drivers'),
    ]);
    document.getElementById('t-hint').textContent = `${trucks.length} camión(es) en la flota`;
    rowsEl.innerHTML = trucks.map((t) => `
      <tr class="${t.is_active ? '' : 'opacity-50'}">
        <td class="font-bold">${esc(t.license_plate)}</td>
        <td>${esc(t.model || '—')}</td>
        <td>${t.assigned_driver ? `${esc(t.assigned_driver.full_name)} <span class="text-xs text-slate-400">(${esc(t.assigned_driver.user_cedula)})</span>` : '<span class="text-amber-600 text-xs">Sin asignar</span>'}</td>
        <td>${t.is_active ? '<span class="text-emerald-600 text-xs font-semibold">ACTIVO</span>' : '<span class="text-slate-400 text-xs font-semibold">INACTIVO</span>'}</td>
        <td>${t.has_route_today ? badge(t.route_status_today) : '<span class="text-slate-300 text-xs">—</span>'}</td>
        <td class="whitespace-nowrap">
          <button data-edit="${t.id}" class="text-brand-600 hover:underline text-xs font-semibold mr-2">Editar</button>
          ${t.is_active ? `<button data-off="${t.id}" class="text-rose-500 hover:underline text-xs font-semibold">Desactivar</button>` : ''}
        </td>
      </tr>`).join('') || emptyState('No hay camiones registrados', 6);

    rowsEl.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openEditor(trucks.find((t) => t.id === btn.dataset.edit), drivers, load)));

    rowsEl.querySelectorAll('[data-off]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        await api(`/api/v1/admin/trucks/${btn.dataset.off}`, { method: 'DELETE' });
        toast('Camión desactivado', 'success');
        await load();
      }));
  }

  document.getElementById('t-new').addEventListener('click', async () => {
    const drivers = await api('/api/v1/admin/users/drivers');
    openEditor(null, drivers, load);
  });

  await load();
}

function openEditor(truck, drivers, onSaved) {
  const isNew = !truck;
  openModal({
    title: isNew ? 'Nuevo camión' : `Editar ${esc(truck.license_plate)}`,
    body: `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="field">Placa *</label>
          <input id="tr-plate" class="input uppercase" value="${esc(truck?.license_plate || '')}" placeholder="ABC-123" />
        </div>
        <div>
          <label class="field">Modelo</label>
          <input id="tr-model" class="input" value="${esc(truck?.model || '')}" placeholder="Chevrolet NHR" />
        </div>
        <div class="md:col-span-2">
          <label class="field">Conductor asignado</label>
          <select id="tr-driver" class="select">
            <option value="">— sin conductor —</option>
            ${drivers.map((d) => `<option value="${d.id}" ${truck?.assigned_driver?.id === d.id ? 'selected' : ''}>${esc(d.full_name)} (${esc(d.user_cedula)})</option>`).join('')}
          </select>
        </div>
      </div>`,
    confirmText: isNew ? 'Crear camión' : 'Guardar cambios',
    onConfirm: async (wrap) => {
      const payload = {
        license_plate: wrap.querySelector('#tr-plate').value.trim(),
        model: wrap.querySelector('#tr-model').value.trim() || null,
        assigned_driver_id: wrap.querySelector('#tr-driver').value || null,
      };
      if (!payload.license_plate) throw new Error('La placa es obligatoria');
      if (isNew) {
        await api('/api/v1/admin/trucks', { method: 'POST', body: payload });
        toast('Camión creado', 'success');
      } else {
        await api(`/api/v1/admin/trucks/${truck.id}`, { method: 'PATCH', body: payload });
        toast('Camión actualizado', 'success');
      }
      await onSaved();
    },
  });
}
