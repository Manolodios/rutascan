/*
 * RutaScan - Aplicacion de escritorio (Electron)
 * -------------------------------------------------
 * Abre una ventana propia (sin navegador), arranca el backend
 * automaticamente y lo apaga al cerrar la ventana.
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 8000;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CLASSIC_HOME = `${ORIGIN}/`;
/** New React panel (built into web/app by `npm run build:web`). */
const NEW_PANEL = `${ORIGIN}/app/`;
const PROJECT =
  process.env.RUTASCAN_PROJECT ||
  'C:\\Users\\Usuario\\Documents\\Default Project';

let server = null;
let win = null;

/**
 * Opens the new React panel when it has been built, and falls back to the
 * classic panel otherwise (so the desktop app never shows a blank screen).
 */
function resolveHome() {
  const index = path.join(PROJECT, 'web', 'app', 'index.html');
  try {
    if (fs.existsSync(index)) return NEW_PANEL;
  } catch (e) {}
  return CLASSIC_HOME;
}

const LOADING = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif}
.box{text-align:center}
.logo{font-size:48px;font-weight:800;letter-spacing:-1px}
.logo span{color:#59a1ff}
.sub{margin-top:12px;color:#94a3b8;font-size:14px}
.spin{margin:28px auto 0;width:40px;height:40px;border:4px solid #1e293b;border-top-color:#2f7ef7;border-radius:50%;animation:s 1s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
</style></head><body><div class="box">
<div class="logo">Ruta<span>Scan</span></div>
<div class="sub">Iniciando el sistema...</div>
<div class="spin"></div>
</div></body></html>`;

function healthCheck(cb) {
  const req = http.get(
    { host: '127.0.0.1', port: PORT, path: '/health', timeout: 1500 },
    (res) => {
      res.resume();
      cb(res.statusCode === 200);
    }
  );
  req.on('error', () => cb(false));
  req.on('timeout', () => {
    req.destroy();
    cb(false);
  });
}

function startServer() {
  const py = path.join(PROJECT, '.venv', 'Scripts', 'python.exe');
  const backend = path.join(PROJECT, 'backend');
  server = spawn(
    py,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(PORT)],
    {
      cwd: backend,
      env: Object.assign({}, process.env, {
        DATABASE_URL: 'sqlite+pysqlite:///./rutascan_demo.db',
        SEED_DEMO_DATA: 'true',
        WEB_DIR: path.join(PROJECT, 'web'),
        PYTHONPATH: backend,
      }),
      windowsHide: true,
      detached: false,
      stdio: 'ignore',
    }
  );
  server.on('error', () => {});
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    title: 'RutaScan',
    autoHideMenuBar: true,
  });
  win.setMenuBarVisibility(false);
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(LOADING));
  win.on('closed', () => {
    win = null;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Internal links (classic panel, /app/ sections) stay inside the window.
    if (url.startsWith(ORIGIN)) {
      win.loadURL(url);
      return { action: 'deny' };
    }
    // Generated binaries (QR labels) open in a small viewer window.
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const viewer = new BrowserWindow({
        width: 460,
        height: 560,
        parent: win,
        autoHideMenuBar: true,
        title: 'RutaScan - Etiqueta QR',
      });
      viewer.setMenuBarVisibility(false);
      viewer.loadURL(url);
      return { action: 'deny' };
    }
    // Anything else (maps, docs) opens in the default browser.
    shell.openExternal(url);
    return { action: 'deny' };
  });
  poll(150);
}

function poll(tries) {
  healthCheck((ok) => {
    if (ok || tries <= 0) {
      if (win) win.loadURL(resolveHome());
      return;
    }
    setTimeout(() => poll(tries - 1), 500);
  });
}

function shutdown() {
  if (server && server.pid) {
    try {
      spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], {
        windowsHide: true,
      });
    } catch (e) {}
    server = null;
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    healthCheck((ok) => {
      if (!ok) startServer();
      createWindow();
    });
  });

  app.on('window-all-closed', () => {
    shutdown();
    app.quit();
  });
  app.on('before-quit', shutdown);
}
