import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const browser = await Browser.launch({ width: 1440, height: 900 });
const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });

await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
await page.send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-reduced-motion', value: 'no-preference' },
    { name: 'prefers-color-scheme', value: 'light' }
  ]
}).catch(() => {});

await page.goto('https://rutascan.onrender.com/', { timeoutMs: 30000, settleMs: 2000 });
await sleep(10000);
await page.eval(() => document.fonts.ready).catch(() => {});
await sleep(5000);

await page.eval(() => {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  return true;
}).catch(() => {});
await sleep(1600);

await page.screenshot({
  path: 'landing/img/desktop-check.png',
  quality: 90,
  fullPage: false
});
console.log('Captura escritorio guardada: landing/img/desktop-check.png');

await browser.close();
