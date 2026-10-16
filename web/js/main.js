/* RutaScan dashboard shell: login, hash router, sidebar navigation. */

import { api, state, setSession, isLogged, currentUser, isAdmin, logout, ApiError } from './api.js';
import { toast, esc } from './ui.js';

import { renderDashboard } from './views/dashboard.js';
import { renderMap } from './views/map.js';
import { renderRoutes } from './views/routes.js';
import { renderProducts } from './views/products.js';
import { renderTrucks } from './views/trucks.js';
import { renderUsers } from './views/users.js';
import { renderReports } from './views/reports.js';
import { renderLicense } from './views/license.js';
import { renderSecurity } from './views/security.js';

const NAV = [
  { id: 'dashboard', label: 'Panel', icon: '📊', render: renderDashboard, adminOnly: false },
  { id: 'map', label: 'Mapa en vivo', icon: '📍', render: renderMap, adminOnly: false },
  { id: 'routes', label: 'Rutas y asignación', icon: '🗺️', render: renderRoutes, adminOnly: false },
  { id: 'products', label: 'Productos', icon: '📦', render: renderProducts, adminOnly: false },
  { id: 'trucks', label: 'Camiones', icon: '🚚', render: renderTrucks, adminOnly: false },
  { id: 'users', label: 'Usuarios', icon: '👥', render: renderUsers, adminOnly: true },
  { id: 'reports', label: 'Reportes', icon: '📄', render: renderReports, adminOnly: false },
  { id: 'license', label: 'Licencia', icon: '🔑', render: renderLicense, adminOnly: true },
  { id: 'security', label: 'Auditoría', icon: '🛡️', render: renderSecurity, adminOnly: false },
];

let currentCleanup = null;

function renderLogin(message = '') {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="min-h-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="text-5xl">🚚</div>
          <h1 class="text-3xl font-extrabold text-white mt-2 tracking-tight">RutaScan</h1>
          <p class="text-slate-300 text-sm mt-1">Trazabilidad de carga en tiempo real</p>
        </div>
        <form id="login-form" class="doc-card p-6 space-y-4">
          ${message ? `<div class="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">${esc(message)}</div>` : ''}
          <div>
            <label class="field" for="cedula">Cédula</label>
            <input id="cedula" name="cedula" class="input" autocomplete="username" required placeholder="1000000001" />
          </div>
          <div>
            <label class="field" for="pin">PIN (4 dígitos)</label>
            <input id="pin" name="pin" class="input tracking-[0.6em] text-center text-lg font-bold" inputmode="numeric"
                   pattern="\\d{4}" maxlength="4" autocomplete="current-password" required placeholder="••••" />
          </div>
          <button type="submit" id="login-btn" class="btn-primary w-full justify-center py-2.5 text-sm">Iniciar sesión</button>
          <p class="text-xs text-slate-400 text-center">Panel de administración y bodega. Conductores: use la app móvil RutaScan.</p>
        </form>
      </div>
    </div>`;

  const form = document.getElementById('login-form');
  const pinInput = document.getElementById('pin');
  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('login-btn');
    const cedula = document.getElementById('cedula').value.trim();
    const pin = pinInput.value;
    if (pin.length !== 4) {
      toast('El PIN debe tener 4 dígitos.', 'warn');
      return;
    }
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Validando…';
    try {
      const data = await api('/auth/login', { method: 'POST', body: { cedula, pin } });
      if (data.user.role === 'DRIVER') {
        toast('Los conductores operan desde la app móvil RutaScan.', 'warn', 6000);
      }
      setSession(data);
      navigate();
      toast(`Bienvenido, ${data.user.full_name}`, 'success');
    } catch (err) {
      const extra = err.code === 'PIN_LOCKOUT' ? ' Cuenta bloqueada temporalmente.' : '';
      renderLogin(`${err.message}${extra}`);
    }
  });
}

function shellHTML(activeId) {
  const user = currentUser();
  const items = NAV.filter((item) => !item.adminOnly || isAdmin())
    .map((item) => `
      <a href="#/${item.id}" data-nav="${item.id}"
         class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${item.id === activeId ? 'bg-brand-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}">
        <span class="text-base">${item.icon}</span> ${item.label}
      </a>`)
    .join('');

  return `
    <div class="h-full flex">
      <aside class="w-60 shrink-0 bg-slate-900 text-white flex flex-col">
        <div class="px-4 py-5 flex items-center gap-2 border-b border-slate-800">
          <span class="text-2xl">🚚</span>
          <div>
            <div class="font-extrabold tracking-tight leading-none">RutaScan</div>
            <div class="text-[11px] text-slate-400">Panel de control</div>
          </div>
        </div>
        <nav class="flex-1 p-3 space-y-1 overflow-y-auto scroll-thin">${items}</nav>
        <div class="p-3 border-t border-slate-800">
          <div class="px-2 pb-2">
            <div class="text-sm font-semibold truncate">${esc(user?.full_name || '')}</div>
            <div class="text-[11px] text-slate-400">${esc(user?.role || '')} · ${esc(state.session?.company?.name || '')}</div>
          </div>
          <button id="logout-btn" class="w-full btn-secondary justify-center text-xs">Cerrar sesión</button>
        </div>
      </aside>
      <main class="flex-1 min-w-0 flex flex-col">
        <header class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <h1 id="page-title" class="text-lg font-bold text-slate-800"></h1>
          <div id="license-chip" class="text-xs text-slate-500"></div>
        </header>
        <section id="view" class="flex-1 overflow-y-auto scroll-thin p-6"></section>
      </main>
    </div>`;
}

function licenseChip() {
  const lic = state.session?.license;
  const chip = document.getElementById('license-chip');
  if (!chip || !lic) return;
  const color = lic.subscription_status !== 'ACTIVE' || lic.expired
    ? 'text-rose-600'
    : lic.expiring_soon
      ? 'text-amber-600'
      : 'text-slate-500';
  chip.className = `text-xs ${color}`;
  chip.textContent = `${lic.company_name} · Licencia hasta ${lic.expiration_date} (${lic.days_remaining} días)`;
}

async function navigate() {
  if (!isLogged()) {
    renderLogin();
    return;
  }
  const hash = (location.hash || '#/dashboard').replace('#/', '');
  const item = NAV.find((entry) => entry.id === hash) || NAV[0];
  if (item.adminOnly && !isAdmin()) {
    toast('No tiene permisos para ese módulo.', 'warn');
    location.hash = '#/dashboard';
    return;
  }

  const root = document.getElementById('root');
  if (!root.querySelector('#view')) {
    root.innerHTML = shellHTML(item.id);
    document.getElementById('logout-btn').addEventListener('click', logout);
    licenseChip();
  } else {
    root.querySelectorAll('[data-nav]').forEach((link) => {
      const active = link.dataset.nav === item.id;
      link.className = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
        active ? 'bg-brand-600 text-white shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`;
    });
  }
  document.getElementById('page-title').textContent = item.label;

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch { /* noop */ }
    currentCleanup = null;
  }
  const view = document.getElementById('view');
  view.innerHTML = '<div class="text-sm text-slate-400">Cargando…</div>';
  try {
    const cleanup = await item.render(view);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return; // logout already dispatched
    view.innerHTML = `<div class="doc-card p-6 text-sm text-rose-600">Error cargando el módulo: ${esc(err.message)}</div>`;
  }
}

window.addEventListener('hashchange', navigate);
window.addEventListener('rutascan:logout', () => {
  if (typeof currentCleanup === 'function') { try { currentCleanup(); } catch { /* noop */ } currentCleanup = null; }
  renderLogin();
});
window.addEventListener('rutascan:refresh-session', async () => {
  try {
    const data = await api('/auth/me');
    setSession({ user: data.user, company: data.company, license: data.license });
    licenseChip();
  } catch { /* handled globally */ }
});

navigate();
