import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const OUT_DIR = 'landing/img';
const VIEWPORT_W = 1576;
const VIEWPORT_H = 908;
const BASE_URL = 'https://rutascan.onrender.com/app/';
const CREDENTIALS = { cedula: '13598742', pin: '1234' };

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
  console.log('🔐 Logging in for reportes...');
  await page.goto(BASE_URL, { timeoutMs: 30000, settleMs: 2000 });
  await sleep(8000);
  await page.eval(() => document.fonts.ready).catch(() => {});
  await sleep(3000);
  
  await page.eval((creds) => {
    const cedulaInput = document.querySelector('#cedula');
    const pinInput = document.querySelector('#pin');
    if (cedulaInput) cedulaInput.value = creds.cedula;
    if (pinInput) pinInput.value = creds.pin;
    const form = document.querySelector('form');
    if (form) form.submit();
  }, CREDENTIALS);
  
  await sleep(5000);
  
  // Navigate to reportes
  console.log('📍 Navigating to reportes...');
  const clicked = await page.eval(() => {
    const allElements = [...document.querySelectorAll('a, button, [role="tab"], [data-tab], nav *, .sidebar *, aside *, [href]')];
    for (const el of allElements) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('reporte') && text.length < 30) {
        el.click();
        return true;
      }
    }
    return false;
  });
  
  if (!clicked) {
    await page.goto(`${BASE_URL}#/reportes`, { timeoutMs: 30000, settleMs: 1500 }).catch(() => {});
  }
  await sleep(4000);
  
  await page.eval(() => {
    const style = document.createElement('style');
    style.textContent = '::-webkit-scrollbar { display: none !important; } * { scrollbar-width: none !important; }';
    document.head.appendChild(style);
  });
  
  await page.eval(() => new Promise(r => setTimeout(r, 2000)));
  
  console.log('📸 Capturing 05-reportes.png...');
  await page.screenshot({ 
    path: `${OUT_DIR}/05-reportes.png`, 
    quality: 95,
    fullPage: false 
  });
  console.log('✅ 05-reportes.png saved');
  
} finally {
  await browser.close();
}