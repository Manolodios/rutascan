import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { probe } from '../.agents/skills/design-taste-frontend/scripts/lib/probe.mjs';

const width = Number(process.argv[2] || 768);
const height = width === 768 ? 1024 : 844;
const c = await Browser.launch({ width, height });
const page = await c.newPage({ width, height, dsf: 1, mobile: width < 600 });
await page.send('Emulation.setEmulatedMedia', { 
  features: [
    { name: 'prefers-reduced-motion', value: 'no-preference' },
    { name: 'prefers-color-scheme', value: 'light' }
  ] 
}).catch(() => {});
await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
await page.goto('http://127.0.0.1:8021/', { timeoutMs: 30000, settleMs: 600 });
await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
await page.send('Emulation.setEmulatedMedia', { 
  features: [
    { name: 'prefers-reduced-motion', value: 'no-preference' },
    { name: 'prefers-color-scheme', value: 'light' }
  ] 
}).catch(() => {});
await page.eval(() => { document.documentElement.style.colorScheme = 'light'; document.documentElement.setAttribute('data-color-scheme', 'light'); }).catch(() => {});
await sleep(1000);
await page.eval(() => { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')); return true; }).catch(() => {});
await sleep(1600);
await page.eval(() => { document.documentElement.style.colorScheme = 'light'; document.documentElement.setAttribute('data-color-scheme', 'light'); }).catch(() => {});
await sleep(500);
const m = await page.eval(probe);
console.log('lowContrast', m.color.lowContrast);
console.log('sectionBgs', m.color.sectionBgs);
console.log('textColors', m.color.textColors);
await c.close();