import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { mkdirSync, existsSync } from 'node:fs';

const OUT_DIR = 'landing/img';
const VIEWPORT_W = 1576;
const VIEWPORT_H = 908;
const LOCAL_URL = 'http://127.0.0.1:8081/';
const CREDENTIALS = { cedula: '13598742', pin: '1234' };

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function loginAndNavigate(page, targetNav = null) {
  // Load local app (will redirect to login)
  await page.goto(LOCAL_URL, { timeoutMs: 30000, settleMs: 2000 });
  await sleep(8000);
  await page.eval(() => document.fonts.ready).catch(() => {});
  await sleep(3000);
  
  // Fill login form
  await page.eval((creds) => {
    const cedulaInput = document.querySelector('#cedula');
    const pinInput = document.querySelector('#pin');
    if (cedulaInput) cedulaInput.value = creds.cedula;
    if (pinInput) pinInput.value = creds.pin;
    const form = document.querySelector('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
      else form.submit();
    }
  }, CREDENTIALS);
  
  await sleep(5000);
  
  if (targetNav) {
    // Try to click nav element by text content
    const clicked = await page.eval((nav) => {
      const allElements = [...document.querySelectorAll('a, button, [role="tab"], [data-tab], nav *, .sidebar *, aside *, [href]')];
      for (const el of allElements) {
        const text = (el.textContent || '').toLowerCase();
        if (text.includes(nav.toLowerCase()) && text.length < 30) {
          el.click();
          return true;
        }
      }
      return false;
    }, targetNav);
    
    if (!clicked) {
      // Try direct URL navigation with hash
      await page.goto(`${LOCAL_URL}#/${targetNav}`, { timeoutMs: 30000, settleMs: 1500 }).catch(() => {});
    }
    await sleep(3000);
  }
  
  // Hide scrollbars
  await page.eval(() => {
    const style = document.createElement('style');
    style.textContent = '::-webkit-scrollbar { display: none !important; } * { scrollbar-width: none !important; }';
    document.head.appendChild(style);
  });
  
  await page.eval(() => new Promise(r => setTimeout(r, 1000)));
}

async function captureOne(name, desc, nav) {
  const browser = await Browser.launch({ width: VIEWPORT_W, height: VIEWPORT_H });
  const page = await browser.newPage({ width: VIEWPORT_W, height: VIEWPORT_H, dsf: 1 });
  
  await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
  await page.send('Emulation.setEmulatedMedia', { 
    features: [
      { name: 'prefers-reduced-motion', value: 'no-preference' },
      { name: 'prefers-color-scheme', value: 'light' }
    ] 
  }).catch(() => {});
  
  try {
    console.log(`🔐 ${desc}: logging in...`);
    await loginAndNavigate(page, nav);
    
    console.log(`📸 Capturing ${name}...`);
    await page.screenshot({ 
      path: `${OUT_DIR}/${name}`, 
      quality: 95,
      fullPage: false 
    });
    console.log(`✅ ${name} saved`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const shots = [
    { name: '01-panel.png', desc: 'Dashboard principal', nav: null },
    { name: '02-mapa-en-vivo.png', desc: 'Mapa en vivo', nav: 'mapa' },
    { name: '03-rutas.png', desc: 'Rutas y manifiestos', nav: 'rutas' },
    { name: '04-camiones.png', desc: 'Flota de camiones', nav: 'camiones' },
    { name: '05-reportes.png', desc: 'Reportes', nav: 'reportes' },
  ];
  
  for (const shot of shots) {
    await captureOne(shot.name, shot.desc, shot.nav);
    await sleep(2000);
  }
  
  console.log('\n🎉 All screenshots captured!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});