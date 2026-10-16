/* License: subscription status, expiration, device slot management (ADMIN). */

import { api, setSession, state } from '../api.js';
import { badge, confirmDialog, esc, emptyState, fmtDateTime, skeleton, toast } from '../ui.js';

export async function renderLicense(root) {
  root.innerHTML = skeleton(2);

  async function load() {
    const license = await api('/api/v1/admin/license');
    const usedPct = Math.min(100, Math.round((license.active_devices / license.max_trucks) * 100));
    const statusOk = license.subscription_status === 'ACTIVE' && !license.expired;

    root.innerHTML = `
      <div class="space-y-6 max-w-5xl">
        ${!statusOk ? `
          <div class="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
            <strong>Suscripción no operativa.</strong> ${license.expired ? 'La licencia está vencida: la app móvil rechazará toda operación (HTTP 402).' : 'La suscripción está suspendida.'}
            Contacte a su proveedor para renovar.
          </div>` : license.expiring_soon ? `
          <div class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <strong>Su licencia vence en ${license.days_remaining} día(s).</strong> Renueve para evitar interrupciones del servicio.
          </div>` : ''}

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="doc-card p-5 lg:col-span-2">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa</div>
                <div class="text-lg font-bold">${esc(license.company_name)}</div>
                <div class="text-xs text-slate-500">NIT/RUC: ${esc(license.tax_id)}</div>
              </div>
              ${badge(license.subscription_status)}
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div>
                <div class="text-xs text-slate-400 font-semibold">CLAVE DE LICENCIA</div>
                <div class="font-mono text-sm font-bold text-brand-700">${esc(license.license_key)}</div>
              </div>
              <div>
                <div class="text-xs text-slate-400 font-semibold">VENCE</div>
                <div class="font-bold">${esc(license.expiration_date)}</div>
                <div class="text-xs ${license.expired ? 'text-rose-600' : 'text-slate-500'}">${license.days_remaining} días restantes</div>
              </div>
              <div>
                <div class="text-xs text-slate-400 font-semibold">DÍAS SIN CONEXIÓN (GRACE)</div>
                <div class="font-bold">3 días</div>
                <div class="text-xs text-slate-500">Token offline de la app móvil</div>
              </div>
            </div>
          </div>

          <div class="doc-card p-5">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Dispositivos activos</div>
            <div class="kpi-value mt-1 ${usedPct >= 100 ? 'text-rose-600' : 'text-slate-800'}">${license.active_devices}/${license.max_trucks}</div>
            <div class="h-2 bg-slate-100 rounded overflow-hidden mt-2">
              <div class="h-full ${usedPct >= 100 ? 'bg-rose-500' : usedPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width:${usedPct}%"></div>
            </div>
            <p class="text-xs text-slate-500 mt-2">Un dispositivo que no se conecta en ${license.device_ttl_days} días libera su ranura automáticamente.</p>
          </div>
        </div>

        <div class="doc-card">
          <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h2 class="font-bold text-slate-700">Dispositivos registrados</h2>
            <span class="text-xs text-slate-400">${license.devices.length} en total (incluye inactivos)</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data w-full">
              <thead><tr><th>UUID</th><th>Usuario</th><th>Plataforma</th><th>Versión</th><th>Último latido</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                ${license.devices.map((d) => `
                  <tr class="${d.is_active ? '' : 'opacity-50'}">
                    <td class="font-mono text-xs">${esc(d.device_uuid.slice(0, 18))}…</td>
                    <td>${d.user ? esc(d.user.full_name) : '<span class="text-slate-400">—</span>'}</td>
                    <td>${esc(d.platform || '—')}</td>
                    <td>${esc(d.app_version || '—')}</td>
                    <td class="text-xs text-slate-500">${fmtDateTime(d.last_seen_at)}</td>
                    <td>${d.is_active ? '<span class="text-emerald-600 text-xs font-semibold">ACTIVO</span>' : '<span class="text-rose-500 text-xs font-semibold">BLOQUEADO</span>'}</td>
                    <td class="whitespace-nowrap">
                      <button data-release="${d.id}" class="text-brand-600 hover:underline text-xs font-semibold mr-2">Liberar</button>
                      ${d.is_active ? `<button data-block="${d.id}" class="text-rose-500 hover:underline text-xs font-semibold">Bloquear</button>` : ''}
                    </td>
                  </tr>`).join('') || emptyState('Sin dispositivos registrados', 7)}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    root.querySelectorAll('[data-release]').forEach((btn) =>
      btn.addEventListener('click', () =>
        confirmDialog(
          'Liberar ranura',
          'El dispositivo quedará desregistrado y podrá volver a activarse (o activar otro equipo). ¿Continuar?',
          async () => {
            await api(`/api/v1/admin/license/devices/${btn.dataset.release}`, { method: 'DELETE' });
            toast('Ranura liberada', 'success');
            await load();
          },
        )));

    root.querySelectorAll('[data-block]').forEach((btn) =>
      btn.addEventListener('click', () =>
        confirmDialog(
          'Bloquear dispositivo',
          'El UUID quedará en lista negra permanente (equipo perdido/robado). No podrá volver a registrarse.',
          async () => {
            await api(`/api/v1/admin/license/devices/${btn.dataset.block}/block`, { method: 'POST' });
            toast('Dispositivo bloqueado', 'success');
            await load();
          },
          { confirmText: 'Bloquear', danger: true },
        )));
  }

  try {
    await load();
    // Refresh session license chip
    if (state.session) {
      const license = await api('/api/v1/admin/license');
      setSession({ license: { ...license, devices: undefined } });
      window.dispatchEvent(new CustomEvent('rutascan:refresh-session'));
    }
  } catch (err) {
    root.innerHTML = `<div class="doc-card p-6 text-sm text-rose-600">${esc(err.message)}</div>`;
  }
}
