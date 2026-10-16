/* RutaScan API client: JWT session, automatic refresh-on-401, blob downloads. */

const STORAGE_KEY = 'rutascan.session.v1';

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export const state = {
  session: loadSession(),
  refreshing: null,
};

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message || 'Error inesperado');
    this.status = status;
    this.code = code || null;
  }
}

export function setSession(data) {
  state.session = { ...(state.session || {}), ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.session));
}

export function clearSession() {
  state.session = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function isLogged() {
  return Boolean(state.session && state.session.access_token && state.session.user);
}

export function currentUser() {
  return state.session?.user || null;
}

export function isAdmin() {
  return currentUser()?.role === 'ADMIN';
}

function broadcastLogout() {
  clearSession();
  window.dispatchEvent(new CustomEvent('rutascan:logout'));
}

async function refreshTokens() {
  const refresh = state.session?.refresh_token;
  if (!refresh) throw new ApiError(401, 'Sin sesión', 'NO_SESSION');
  const res = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) throw new ApiError(401, 'Sesión expirada', 'SESSION_EXPIRED');
  const data = await res.json();
  setSession({ ...data });
  return data.access_token;
}

/**
 * api('/api/v1/admin/trucks', {method:'POST', body:{...}})
 * expect: 'json' | 'blob' | 'none'
 */
export async function api(path, { method = 'GET', body = null, form = null, expect = 'json' } = {}) {
  const headers = {};
  if (state.session?.access_token) headers.Authorization = `Bearer ${state.session.access_token}`;

  let payload = null;
  if (form) {
    payload = form;
  } else if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res = await fetch(path, { method, headers, body: payload });

  if (res.status === 401 && state.session?.refresh_token && !path.startsWith('/auth/refresh')) {
    try {
      state.refreshing = state.refreshing || refreshTokens().finally(() => { state.refreshing = null; });
      await state.refreshing;
    } catch {
      broadcastLogout();
      throw new ApiError(401, 'Sesión expirada, vuelva a iniciar sesión.', 'SESSION_EXPIRED');
    }
    headers.Authorization = `Bearer ${state.session.access_token}`;
    res = await fetch(path, { method, headers, body: payload });
  }

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* not json */ }
    let message = `Error ${res.status}`;
    if (data) {
      if (typeof data.detail === 'string') message = data.detail;
      else if (data.detail && typeof data.detail === 'object' && data.detail.detail) message = data.detail.detail;
      else if (Array.isArray(data.errors) && data.errors[0]) message = data.errors[0].msg || message;
    }
    if (res.status === 401) broadcastLogout();
    throw new ApiError(res.status, message, data?.code);
  }

  if (expect === 'blob') return { blob: await res.blob(), headers: res.headers };
  if (expect === 'none' || res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function downloadFile(path, fallbackName) {
  const { blob, headers } = await api(path, { expect: 'blob' });
  const disposition = headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const name = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}

export async function logout() {
  const refresh = state.session?.refresh_token;
  try {
    await api('/auth/logout', { method: 'POST', body: { refresh_token: refresh }, expect: 'none' });
  } catch { /* ignore */ }
  broadcastLogout();
}
