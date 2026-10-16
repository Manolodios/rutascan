/* Users: staff management (ADMIN only): create, edit, reset PIN. */

import { api } from '../api.js';
import { badge, esc, emptyState, fmtDateTime, openModal, toast } from '../ui.js';

export async function renderUsers(root) {
  root.innerHTML = `
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <div class="text-sm text-slate-500" id="u-hint"></div>
        <button id="u-new" class="btn-primary">＋ Nuevo usuario</button>
      </div>
      <div class="doc-card overflow-x-auto">
        <table class="data w-full">
          <thead><tr><th>Cédula</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead>
          <tbody id="u-rows"></tbody>
        </table>
      </div>
      <p class="text-xs text-slate-400">Los conductores inician sesión en la app móvil con su cédula y PIN de 4 dígitos.</p>
    </div>`;

  const rowsEl = document.getElementById('u-rows');

  async function load() {
    const users = await api('/api/v1/admin/users');
    document.getElementById('u-hint').textContent = `${users.length} usuario(s)`;
    rowsEl.innerHTML = users.map((u) => `
      <tr class="${u.is_active ? '' : 'opacity-50'}">
        <td class="font-mono text-xs">${esc(u.user_cedula)}</td>
        <td class="font-medium">${esc(u.full_name)}</td>
        <td>${badge(u.role)}</td>
        <td>${u.is_active ? '<span class="text-emerald-600 text-xs font-semibold">ACTIVO</span>' : '<span class="text-slate-400 text-xs font-semibold">INACTIVO</span>'}</td>
        <td class="text-xs text-slate-500">${fmtDateTime(u.last_login_at)}</td>
        <td class="whitespace-nowrap">
          <button data-edit="${u.id}" class="text-brand-600 hover:underline text-xs font-semibold mr-2">Editar</button>
          <button data-pin="${u.id}" class="text-amber-600 hover:underline text-xs font-semibold">PIN</button>
        </td>
      </tr>`).join('') || emptyState('Sin usuarios', 6);

    rowsEl.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openEditor(users.find((u) => u.id === btn.dataset.edit), load)));
    rowsEl.querySelectorAll('[data-pin]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const target = users.find((u) => u.id === btn.dataset.pin);
        openModal({
          title: `Resetear PIN de ${target.full_name}`,
          body: `
            <label class="field">Nuevo PIN (4 dígitos)</label>
            <input id="rp-pin" class="input tracking-[0.6em] text-center text-lg font-bold" maxlength="4" inputmode="numeric" placeholder="••••" />`,
          confirmText: 'Restablecer PIN',
          onConfirm: async (wrap) => {
            const pin = wrap.querySelector('#rp-pin').value;
            if (!/^\d{4}$/.test(pin)) throw new Error('El PIN debe tener exactamente 4 dígitos');
            await api(`/api/v1/admin/users/${target.id}/reset-pin`, { method: 'POST', body: { pin } });
            toast(`PIN de ${target.full_name} actualizado`, 'success');
          },
        });
      }));
  }

  document.getElementById('u-new').addEventListener('click', () => openEditor(null, load));
  await load();
}

function openEditor(user, onSaved) {
  const isNew = !user;
  openModal({
    title: isNew ? 'Nuevo usuario' : `Editar ${esc(user.full_name)}`,
    body: `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${isNew ? `
        <div>
          <label class="field">Cédula *</label>
          <input id="us-cedula" class="input" placeholder="1000000004" />
        </div>` : ''}
        <div class="${isNew ? '' : 'md:col-span-2'}">
          <label class="field">Nombre completo *</label>
          <input id="us-name" class="input" value="${esc(user?.full_name || '')}" />
        </div>
        <div>
          <label class="field">Rol *</label>
          <select id="us-role" class="select">
            ${['ADMIN', 'WAREHOUSE', 'DRIVER'].map((r) => `<option value="${r}" ${user?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        ${isNew ? `
        <div>
          <label class="field">PIN inicial (4 dígitos) *</label>
          <input id="us-pin" class="input tracking-[0.5em] text-center font-bold" maxlength="4" inputmode="numeric" placeholder="••••" />
        </div>` : `
        <div class="flex items-end">
          <label class="inline-flex items-center gap-2 text-sm">
            <input id="us-active" type="checkbox" ${user.is_active ? 'checked' : ''} /> Activo
          </label>
        </div>`}
      </div>`,
    confirmText: isNew ? 'Crear usuario' : 'Guardar cambios',
    onConfirm: async (wrap) => {
      const full_name = wrap.querySelector('#us-name').value.trim();
      const role = wrap.querySelector('#us-role').value;
      if (!full_name) throw new Error('El nombre es obligatorio');
      if (isNew) {
        const user_cedula = wrap.querySelector('#us-cedula').value.trim();
        const pin = wrap.querySelector('#us-pin').value;
        if (!user_cedula) throw new Error('La cédula es obligatoria');
        if (!/^\d{4}$/.test(pin)) throw new Error('El PIN debe tener 4 dígitos');
        await api('/api/v1/admin/users', { method: 'POST', body: { user_cedula, full_name, role, pin } });
        toast('Usuario creado', 'success');
      } else {
        await api(`/api/v1/admin/users/${user.id}`, {
          method: 'PATCH',
          body: { full_name, role, is_active: wrap.querySelector('#us-active').checked },
        });
        toast('Usuario actualizado', 'success');
      }
      await onSaved();
    },
  });
}
