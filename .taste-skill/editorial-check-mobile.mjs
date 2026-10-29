import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const browser = await Browser.launch({ width: 390, height: 844 });
const page = await browser.newPage({ width: 390, height: 844, dsf: 2 });

await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
await page.send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-reduced-motion', value: 'no-preference' },
    { name: 'prefers-color-scheme', value: 'light' }
  ]
}).catch(() => {});

await page.goto('http://127.0.0.1:8080/index-editorial.html', { timeoutMs: 30000, settleMs: 2000 });
await sleep(8000);
await page.eval(() => document.fonts.ready).catch(() => {});
await sleep(3000);

await page.eval(() => {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  return true;
}).catch(() => {});
await sleep(1600);

await page.screenshot({
  path: 'landing/img/editorial-mobile.png',
  quality: 90,
  fullPage: false
});
console.log('Captura editorial mobile guardada: landing/img/editorial-mobile.png');

await browser.close();
