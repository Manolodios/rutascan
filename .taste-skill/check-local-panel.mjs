import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const LOCAL_URL = 'http://127.0.0.1:8081/';
const CREDENTIALS = { cedula: '13598742', pin: '1234' };

const browser = await Browser.launch({ width: 1576, height: 908 });
const page = await browser.newPage({ width: 1576, height: 908, dsf: 1 });

await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});

await page.goto(LOCAL_URL, { timeoutMs: 30000, settleMs: 2000 });

// Wait much longer for React to hydrate
await sleep(20000);
await page.eval(() => document.fonts.ready).catch(() => {});
await sleep(5000);

// Check initial state
let info = await page.eval(() => ({
  title: document.title,
  url: window.location.href,
  rootHTML: document.querySelector('#root')?.innerHTML?.slice(0, 2000) || 'EMPTY',
  scripts: [...document.querySelectorAll('script')].map(s => s.src).filter(Boolean),
  bodyHTML: document.body.innerHTML.slice(0, 3000)
}));
console.log('Initial:', info.title);
console.log('Scripts:', info.scripts);
console.log('#root:', info.rootHTML.slice(0, 500));
console.log('Body:', info.bodyHTML.slice(0, 1000));

// Fill and submit
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

await sleep(15000);

// Check after login
info = await page.eval(() => ({
  title: document.title,
  url: window.location.href,
  hash: window.location.hash,
  rootHTML: document.querySelector('#root')?.innerHTML?.slice(0, 5000) || 'EMPTY',
  bodyHTML: document.body.innerHTML.slice(0, 5000)
}));
console.log('\nAfter login:', info.title, info.url, info.hash);
console.log('#root:', info.rootHTML.slice(0, 1000));
console.log('Body:', info.bodyHTML.slice(0, 1000));

await browser.close();