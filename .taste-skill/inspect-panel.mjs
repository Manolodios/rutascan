import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const BASE_URL = 'https://rutascan.onrender.com/app/';
const LOGIN_URL = 'https://rutascan.onrender.com/auth/login';
const CREDENTIALS = { cedula: '13598742', pin: '1234' };

const browser = await Browser.launch({ width: 1576, height: 908 });
const page = await browser.newPage({ width: 1576, height: 908, dsf: 1 });

await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});

// Navigate to login page first (not /app/)
console.log('📄 Loading login page...');
await page.goto(LOGIN_URL, { timeoutMs: 30000, settleMs: 2000 });
await sleep(8000);
await page.eval(() => document.fonts.ready).catch(() => {});
await sleep(3000);

// Check if we're on login page
let pageInfo = await page.eval(() => ({
  title: document.title,
  url: window.location.href,
  forms: [...document.querySelectorAll('form')].length,
  inputs: [...document.querySelectorAll('input')].map(i => ({ id: i.id, type: i.type, name: i.name }))
}));
console.log('Login page:', JSON.stringify(pageInfo, null, 2));

// Fill and submit form
console.log('🔐 Submitting login form...');
await page.eval((creds) => {
  const cedulaInput = document.querySelector('#cedula');
  const pinInput = document.querySelector('#pin');
  if (cedulaInput) cedulaInput.value = creds.cedula;
  if (pinInput) pinInput.value = creds.pin;
  const form = document.querySelector('form');
  if (form) {
    // Try to trigger React's onSubmit
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
    else form.submit();
  }
}, CREDENTIALS);

await sleep(5000);

// Check if we redirected
pageInfo = await page.eval(() => ({
  title: document.title,
  url: window.location.href,
  hash: window.location.hash
}));
console.log('After login:', JSON.stringify(pageInfo, null, 2));

// Now try to go to panel
console.log('📱 Loading panel...');
await page.goto(BASE_URL, { timeoutMs: 30000, settleMs: 2000 });
await sleep(8000);
await page.eval(() => document.fonts.ready).catch(() => {});
await sleep(3000);

const panelInfo = await page.eval(() => {
  return {
    title: document.title,
    url: window.location.href,
    hash: window.location.hash,
    bodyClass: document.body.className,
    allLinks: [...document.querySelectorAll('a[href], button')].map(el => ({
      tag: el.tagName,
      text: (el.textContent || '').trim().slice(0, 50),
      href: el.href || el.getAttribute('href'),
      className: el.className
    })).filter(x => x.text),
    navElements: [...document.querySelectorAll('nav, aside, .sidebar, [role="navigation"], header, [data-radix-navigation-menu], [data-radix-tabs]')].map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id,
      children: [...el.querySelectorAll('a, button, [role="tab"]')].map(c => ({
        tag: c.tagName,
        text: (c.textContent || '').trim().slice(0, 50),
        href: c.href || c.getAttribute('href'),
        className: c.className,
        role: c.getAttribute('role')
      }))
    }))
  };
});

console.log('Panel info:', JSON.stringify(panelInfo, null, 2));

await browser.close();