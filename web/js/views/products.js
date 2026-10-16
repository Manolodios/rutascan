/* Products: catalog CRUD, CSV/Excel import, QR label sheet export. */

import { api, downloadFile } from '../api.js';
import { badge, esc, emptyState, fmtDateTime, openModal, toast } from '../ui.js';

let selected = new Set();

export async function renderProducts(root) {
  let query = '';

  root.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[220px]">
          <label class="field">Buscar</label>
          <input id="p-search" class="input" placeholder="Código o descripción…" />
        </div>
        <button id="p-new" class="btn-primary">＋ Nuevo producto</button>
        <label class="btn-secondary cursor-pointer">⬆ Importar CSV/Excel
          <input id="p-import" type="file" accept=".csv,.xlsx,.xlsm" class="hidden" />
        </label>
        <button id="p-template" class="btn-secondary">📥 Plantilla CSV</button>
        <div class="flex items-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div>
            <label class="field">Copias por etiqueta</label>
            <input id="p-copies" type="number" min="1" max="20" value="1" class="input w-20" />
          </div>
          <button id="p-qr" class="btn-success">🖨 PDF etiquetas QR</button>
        </div>
      </div>
      <div class="doc-card">
        <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 class="font-bold text-slate-700">Catálogo</h2>
          <span class="text-xs text-slate-400" id="p-count"></span>
        </div>
        <div class="overflow-x-auto">
          <table class="data w-full">
            <thead>
              <tr>
                <th class="w-8"><input id="p-all" type="checkbox" /></th>
                <th>Código</th><th>Descripción</th><th>Unidad</th><th>Peso</th><th>Estado</th><th>Creado</th><th></th>
              </tr>
            </thead>
            <tbody id="p-rows"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const rowsEl = document.getElementById('p-rows');

  async function load() {
    rowsEl.innerHTML = '<tr><td colspan="8" class="text-center text-slate-400 py-8 text-sm">Cargando…</td></tr>';
    const products = await api(`/api/v1/admin/products?limit=2000${query ? `&q=${encodeURIComponent(query)}` : ''}`);
    document.getElementById('p-count').textContent = `${products.length} producto(s)`;
    rowsEl.innerHTML = products.map((p) => `
      <tr>
        <td><input type="checkbox" data-check="${p.id}" ${selected.has(p.id) ? 'checked' : ''} /></td>
        <td class="font-mono text-xs">${esc(p.barcode_qr)}</td>
        <td class="font-medium">${esc(p.description)}</td>
        <td>${esc(p.unit)}</td>
        <td>${p.weight} kg</td>
        <td>${p.is_active ? '<span class="text-emerald-600 text-xs font-semibold">ACTIVO</span>' : '<span class="text-slate-400 text-xs font-semibold">INACTIVO</span>'}</td>
        <td class="text-xs text-slate-500">${fmtDateTime(p.created_at)}</td>
        <td class="whitespace-nowrap">
          <button data-edit="${p.id}" class="text-brand-600 hover:underline text-xs font-semibold mr-2">Editar</button>
          <button data-qr="${p.id}" class="text-slate-500 hover:underline text-xs font-semibold">QR</button>
        </td>
      </tr>`).join('') || emptyState('Sin productos en el catálogo', 8);

    rowsEl.querySelectorAll('[data-check]').forEach((box) =>
      box.addEventListener('change', () => {
        if (box.checked) selected.add(box.dataset.check); else selected.delete(box.dataset.check);
      }));
    rowsEl.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openEditor(products.find((p) => p.id === btn.dataset.edit), load)));
    rowsEl.querySelectorAll('[data-qr]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        try {
          const { blob } = await api(`/api/v1/admin/products/${btn.dataset.qr}/qr.png`, { expect: 'blob' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
          toast(err.message, 'error');
        }
      }));
  }

  let searchTimer = null;
  document.getElementById('p-search').addEventListener('input', (event) => {
    query = event.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 280);
  });

  document.getElementById('p-all').addEventListener('change', (event) => {
    rowsEl.querySelectorAll('[data-check]').forEach((box) => { box.checked = event.target.checked; });
    if (event.target.checked) {
      rowsEl.querySelectorAll('[data-check]').forEach((box) => selected.add(box.dataset.check));
    } else {
      selected.clear();
    }
  });

  document.getElementById('p-new').addEventListener('click', () => openEditor(null, load));

  document.getElementById('p-template').addEventListener('click', async () => {
    try { await downloadFile('/api/v1/admin/products/template.csv', 'rutascan_productos_plantilla.csv'); }
    catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('p-import').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api('/api/v1/admin/products/import', { method: 'POST', form });
      toast(`Importados: ${result.created} nuevos, ${result.updated} actualizados (${result.total_rows} filas).`, 'success', 6000);
      await load();
    } catch (err) {
      toast(err.message, 'error', 8000);
    } finally {
      event.target.value = '';
    }
  });

  document.getElementById('p-qr').addEventListener('click', async () => {
    const copies = Math.max(1, Math.min(20, parseInt(document.getElementById('p-copies').value || '1', 10)));
    const ids = Array.from(selected);
    const params = new URLSearchParams({ copies: String(copies) });
    if (ids.length) params.set('ids', ids.join(','));
    try {
      toast('Generando PDF de etiquetas…', 'info');
      const name = await downloadFile(`/api/v1/admin/products/qr-sheet.pdf?${params}`, 'rutascan_etiquetas_qr.pdf');
      toast(`Descargado: ${name}`, 'success');
    } catch (err) {
      toast(err.message, 'error', 7000);
    }
  });

  await load();
}

function openEditor(product, onSaved) {
  const isNew = !product;
  openModal({
    title: isNew ? 'Nuevo producto' : 'Editar producto',
    body: `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="field">Código / QR *</label>
          <input id="f-barcode" class="input font-mono" value="${esc(product?.barcode_qr || '')}" placeholder="PRD-0001" />
        </div>
        <div>
          <label class="field">Unidad</label>
          <input id="f-unit" class="input" value="${esc(product?.unit || 'UNIT')}" placeholder="BOX / UNIT / PACK" />
        </div>
        <div class="md:col-span-2">
          <label class="field">Descripción *</label>
          <input id="f-desc" class="input" value="${esc(product?.description || '')}" placeholder="Caja de leche 1L x12" />
        </div>
        <div>
          <label class="field">Peso (kg)</label>
          <input id="f-weight" type="number" step="0.001" min="0" class="input" value="${product?.weight ?? 0}" />
        </div>
        ${isNew ? '' : `
        <div class="flex items-end">
          <label class="inline-flex items-center gap-2 text-sm">
            <input id="f-active" type="checkbox" ${product.is_active ? 'checked' : ''} /> Activo
          </label>
        </div>`}
      </div>`,
    confirmText: isNew ? 'Crear producto' : 'Guardar cambios',
    onConfirm: async (wrap) => {
      const payload = {
        barcode_qr: wrap.querySelector('#f-barcode').value.trim(),
        description: wrap.querySelector('#f-desc').value.trim(),
        unit: wrap.querySelector('#f-unit').value.trim() || 'UNIT',
        weight: parseFloat(wrap.querySelector('#f-weight').value || '0'),
      };
      if (!payload.barcode_qr || !payload.description) throw new Error('Código y descripción son obligatorios');
      if (isNew) {
        await api('/api/v1/admin/products', { method: 'POST', body: payload });
        toast('Producto creado', 'success');
      } else {
        payload.is_active = wrap.querySelector('#f-active').checked;
        await api(`/api/v1/admin/products/${product.id}`, { method: 'PATCH', body: payload });
        toast('Producto actualizado', 'success');
      }
      await onSaved();
    },
  });
}
