/*
 * RutaScan - Aplicacion de escritorio (Electron)
 * -------------------------------------------------
 * Abre una ventana propia (sin navegador), arranca el backend
 * automaticamente y lo apaga al cerrar la ventana.
 *
 * La carpeta del proyecto se detecta sola (ver findProject): no hay
 * ninguna ruta escrita a mano en este archivo.
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 8000;
const ORIGIN = `http://127.0.0.1:${PORT}`;
/**
 * Bind on every interface so the Android app can reach the backend over the
 * local network. Set RUTASCAN_BIND=127.0.0.1 to keep it PC-only.
 */
const BIND = process.env.RUTASCAN_BIND || '0.0.0.0';
/** The React panel is served under /app by the RutaScan backend (the root is the public landing). */
const HOME = `${ORIGIN}/app/`;

/**
 * Localiza la carpeta del proyecto RutaScan (la que contiene `backend/` y `.venv/`).
 *
 * Orden de busqueda:
 *   1. variable de entorno RUTASCAN_PROJECT
 *   2. %LOCALAPPDATA%\RutaScan\project.txt  (lo escribe tools/instalar_escritorio.ps1)
 *   3. carpetas superiores a la app (modo desarrollo o dist/ dentro del proyecto)
 *   4. carpeta de trabajo actual
 */
function findProject() {
  const candidates = [];
  if (process.env.RUTASCAN_PROJECT) candidates.push(process.env.RUTASCAN_PROJECT);
  try {
    const cfg = path.join(
      process.env.LOCALAPPDATA || process.env.HOME || '',
      'RutaScan',
      'project.txt'
    );
    const saved = fs.readFileSync(cfg, 'utf8').trim();
    if (saved) candidates.push(saved);
  } catch (e) {}
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    candidates.push(dir);
    dir = path.dirname(dir);
  }
  candidates.push(process.cwd());
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(path.join(c, 'backend', 'app', 'main.py'))) return c;
    } catch (e) {}
  }
  return candidates[0] || process.cwd();
}

const PROJECT = findProject();
const PYTHON = path.join(PROJECT, '.venv', 'Scripts', 'python.exe');

let server = null;
let win = null;

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

const MISSING = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif}
.box{max-width:640px;padding:32px;line-height:1.55}
h1{font-size:22px;margin:0 0 6px}
h1 span{color:#59a1ff}
p{color:#cbd5e1;font-size:14px}
code{background:#1e293b;padding:2px 6px;border-radius:6px;font-size:13px}
ul{color:#cbd5e1;font-size:14px}
</style></head><body><div class="box">
<h1>Ruta<span>Scan</span> - no encontre el proyecto</h1>
<p>La aplicacion necesita la carpeta del proyecto (la que tiene <code>backend</code> y <code>.venv</code>).</p>
<ul>
  <li>Ejecute <code>INSTALAR RutaScan.bat</code> desde la carpeta del proyecto y vuelva a abrir la app.</li>
  <li>O indique la carpeta a mano: variable de entorno <code>RUTASCAN_PROJECT</code>.</li>
</ul>
<p>Buscado en:<br><code>${PROJECT}</code></p>
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
  const backend = path.join(PROJECT, 'backend');
  server = spawn(
    PYTHON,
    ['-m', 'uvicorn', 'app.main:app', '--host', BIND, '--port', String(PORT)],
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
    icon: path.join(__dirname, 'build', 'icon.png'),
  });
  win.setMenuBarVisibility(false);
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(LOADING));
  win.on('closed', () => {
    win = null;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Internal links (panel sections) stay inside the window.
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
}

function poll(tries) {
  healthCheck((ok) => {
    if (ok || tries <= 0) {
      if (win) win.loadURL(HOME);
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
    if (process.platform === 'win32') app.setAppUserModelId('RutaScan');
    Menu.setApplicationMenu(null);
    healthCheck((ok) => {
      if (!ok) startServer();
      createWindow();
      // Sin entorno de Python no hay backend: mostrar la ayuda y no insistir.
      if (!ok && !fs.existsSync(PYTHON)) {
        if (win) {
          win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(MISSING));
        }
        return;
      }
      poll(150);
    });
  });

  app.on('window-all-closed', () => {
    shutdown();
    app.quit();
  });
  app.on('before-quit', shutdown);
}
