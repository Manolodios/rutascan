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
await page.goto('http://127.0.0.1:8021/', { timeoutMs: 30000, settleMs: 600 });
await sleep(600);
await page.eval('document.fonts.ready.then(() => true)').catch(() => {});
await sleep(800);
await page.eval(() => { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')); return true; }).catch(() => {});
await sleep(1600);
await page.eval(() => { document.documentElement.style.colorScheme = 'light'; document.documentElement.setAttribute('data-color-scheme', 'light'); }).catch(() => {});
await sleep(500);

const result = await page.eval(() => {
  const imgs = [...document.images];
  return imgs.map(i => ({
    src: (i.currentSrc || i.src).slice(0, 100),
    complete: i.complete,
    naturalWidth: i.naturalWidth,
    naturalHeight: i.naturalHeight,
    width: i.width,
    height: i.height,
    rect: i.getBoundingClientRect()
  }));
});

console.log('Images:', JSON.stringify(result, null, 2));

await browser.close();