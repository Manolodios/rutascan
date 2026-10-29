import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const browser = await Browser.launch({ width: 1576, height: 908 });
const page = await browser.newPage({ width: 1576, height: 908, dsf: 1 });
await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
await page.goto('https://rutascan.onrender.com/app/', { timeoutMs: 30000, settleMs: 2000 });
await sleep(8000);
await page.eval(() => document.fonts.ready).catch(() => {});
await sleep(3000);

const formInfo = await page.eval(() => {
  const forms = [...document.querySelectorAll('form')];
  return forms.map((f, i) => ({
    index: i,
    action: f.action,
    method: f.method,
    inputs: [...f.querySelectorAll('input')].map(inp => ({
      name: inp.name,
      type: inp.type,
      id: inp.id,
      placeholder: inp.placeholder,
      className: inp.className
    })),
    buttons: [...f.querySelectorAll('button, input[type="submit"]')].map(b => ({
      text: b.textContent?.trim(),
      type: b.type,
      className: b.className
    }))
  }));
});

console.log('Forms:', JSON.stringify(formInfo, null, 2));

// Also check the whole page structure
const pageStructure = await page.eval(() => {
  return {
    title: document.title,
    bodyClass: document.body.className,
    mainElements: [...document.querySelectorAll('main, .container, .login, form')].map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id
    }))
  };
});

console.log('\nPage structure:', JSON.stringify(pageStructure, null, 2));

await browser.close();