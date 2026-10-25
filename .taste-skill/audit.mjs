// Audit runner with the same measurements as inspect.mjs, but one fresh page per screenshot.
// The stock runner takes ~12 screenshots in one page; this machine's headless Edge wedges the
// renderer after ~10 captures in a single page (reproduced on a blank page too), so each capture
// gets its own page. Same rules, same probes, same findings.
import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { probe, frame, layout } from '../.agents/skills/design-taste-frontend/scripts/lib/probe.mjs';
import { judge, judgeLayout } from '../.agents/skills/design-taste-frontend/scripts/lib/rules.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:8021/';
const outDir = process.argv[3] || '.taste-skill/shots';
const widths = (process.argv[4] || '1440,768,390').split(',').map(Number);
const HEIGHT = { 1440: 900, 1280: 800, 1024: 768, 768: 1024, 390: 844, 375: 812 };
const allow = (() => {
  try {
    const d = JSON.parse(readFileSync('.taste-skill/direction.json', 'utf8'));
    return d.allow || [];
  } catch { return []; }
})();

mkdirSync(outDir, { recursive: true });

const MOTION_RECORDER = `(() => {
  const seen = new WeakSet(); const c = { elements: 0, css: 0, transitions: 0, scripted: 0 };
  const note = (t, k) => { if (!(t instanceof Element) || seen.has(t)) return; seen.add(t); c.elements++; c[k]++; };
  addEventListener('animationstart', (e) => note(e.target, 'css'), true);
  addEventListener('transitionrun', (e) => note(e.target, 'transitions'), true);
  const watch = () => new MutationObserver((list) => { for (const m of list) { const s = m.target.getAttribute && m.target.getAttribute('style') || ''; if (/transform|translate|opacity|scale|rotate|clip-path/.test(s)) note(m.target, 'scripted'); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['style'], subtree: true });
  if (document.documentElement) watch(); else addEventListener('DOMContentLoaded', watch);
  window.__motionSample = () => { for (const a of document.getAnimations ? document.getAnimations() : []) { const t = a.effect && a.effect.target; if (t) note(t, a.constructor && a.constructor.name === 'CSSTransition' ? 'transitions' : 'css'); } };
  window.__motion = () => { window.__motionSample(); const v = [...document.querySelectorAll('video')]; return { ...c, videos: v.length, playingVideos: v.filter((x) => x.autoplay || !x.paused).length }; };
})();`;

const TITLE_SEEN = `(() => {
  const h = document.querySelector('h1'); if (!h) return { found: false };
  const r = h.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { found: true, visible: false, why: 'it has no size yet' };
  if (r.bottom < 0 || r.top > innerHeight) return { found: false };
  let o = 1; for (let p = h; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none') return { found: true, visible: false, why: 'it is hidden' }; o *= +cs.opacity; }
  if (o < 0.5) return { found: true, visible: false, why: 'it is at ' + Math.round(o * 100) + '% opacity' };
  const range = document.createRange(); range.selectNodeContents(h); const rr = range.getBoundingClientRect();
  const x = Math.min(innerWidth - 1, Math.max(0, rr.left + rr.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, rr.top + Math.min(rr.height, 80) / 2));
  const hit = document.elementFromPoint(x, y);
  if (hit && !h.contains(hit) && !hit.contains(h)) { const cs = getComputedStyle(hit); if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || /^(IMG|VIDEO|CANVAS)$/.test(hit.tagName)) return { found: true, visible: false, why: 'something lies over it' }; }
  return { found: true, visible: true };
})()`;

const findings = [];
const viewports = [];

async function fresh(browser, w, h, opts = {}) {
  const page = await browser.newPage({ width: w, height: h, dsf: 1, mobile: w < 600, ...opts });
  // This machine's Windows animation setting makes headless Edge report prefers-reduced-motion: reduce,
  // which would switch the page's motion layer off and make the motion gate unreadable. Ask for the
  // normal case explicitly; the reduced case is checked separately at the end.
  if (!opts.reducedMotion) {
    await page.send('Emulation.setEmulatedMedia', { 
      features: [
        { name: 'prefers-reduced-motion', value: 'no-preference' },
        { name: 'prefers-color-scheme', value: 'light' }
      ] 
    }).catch(() => {});
  }
  // Windows auto dark mode randomly inverts page colours in headless Edge, corrupting contrast probes.
  // Disable via CDP.
  await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
  await page.goto(url, { timeoutMs: 30000, settleMs: 600 });
  // Re-apply after navigation in case the page triggers auto dark mode on load.
  await page.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
  await page.send('Emulation.setEmulatedMedia', { 
    features: [
      { name: 'prefers-reduced-motion', value: 'no-preference' },
      { name: 'prefers-color-scheme', value: 'light' }
    ] 
  }).catch(() => {});
  // Force color-scheme on the document element as a last resort.
  await page.eval(() => { document.documentElement.style.colorScheme = 'light'; document.documentElement.setAttribute('data-color-scheme', 'light'); }).catch(() => {});
  // Wait for styles to recompute.
  await new Promise(r => setTimeout(r, 500));
  return page;
}

async function withBrowser(w, h, fn) {
  // Launch a fresh browser for each viewport to avoid auto dark mode state bleeding between runs.
  const browser = await Browser.launch({ width: w, height: h });
  try {
    return await fn(browser, w, h);
  } finally {
    await browser.close();
  }
}

for (const w of widths) {
  const h = HEIGHT[w] || Math.round(w * 0.625);
  const tag = w === 1440 ? 'desktop' : w === 768 ? 'tablet' : 'mobile';

  await withBrowser(w, h, async (browser, w, h) => {
    // fold
    const p1 = await fresh(browser, w, h);
    await sleep(600);
    const early = await p1.eval(TITLE_SEEN).catch(() => null);
    await p1.eval('document.fonts.ready.then(() => true)').catch(() => {});
    await sleep(800);
    // Re-apply auto dark mode override after fonts load, then wait for styles to settle.
    await p1.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
    await sleep(800);
    // The layout probe counts only what is painted, so entrance states (opacity 0 until scrolled into
    // view) would read as blank page. Settle them first: this measures the page a visitor ends up with.
    await p1.eval(() => { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')); return true; }).catch(() => {});
    await sleep(1600);
    // Force light color-scheme right before probe to counter Windows auto dark mode.
    await p1.eval(() => { document.documentElement.style.colorScheme = 'light'; document.documentElement.setAttribute('data-color-scheme', 'light'); }).catch(() => {});
    await sleep(500);
    const fold = join(outDir, `${tag}-fold.jpg`);
    await p1.screenshot({ path: fold, quality: 82 });
    const metrics = await p1.eval(probe);
    const lay = await p1.eval(layout).catch(() => null);
    await p1.close();

    // motion pass, no screenshots
    const pm = await fresh(browser, w, h);
    const screens = Math.min(11, Math.max(0, Math.ceil(metrics.page.height / h) - 1));
    for (let i = 1; i <= screens; i++) {
      await pm.eval(`window.scrollTo({ top: ${i * h}, behavior: 'instant' })`).catch(() => {});
      await pm.wheel(2);
      await sleep(450);
      await pm.eval('window.__motionSample && window.__motionSample()').catch(() => {});
    }
    const motion = await pm.eval('window.__motion ? window.__motion() : null').catch(() => null);
    await pm.close();

    // scroll shots + per-screen frame checks, fresh page each
    const frameChecks = [];
    const shots = [fold];
    for (let i = 0; i <= screens; i++) {
      const p = await fresh(browser, w, h);
      if (i > 0) await p.eval(`window.scrollTo({ top: ${i * h}, behavior: 'instant' })`).catch(() => {});
      await p.wheel(2);
      await sleep(700);
      frameChecks.push(await p.eval(frame).catch(() => null));
      const shot = join(outDir, `${tag}-screen-${String(i).padStart(2, '0')}.jpg`);
      await p.screenshot({ path: shot, quality: 78 });
      shots.push(shot);
      await p.close();
    }

    const list = [...judge(metrics, { width: w, allow })];
    if (lay) list.push(...judgeLayout(lay, { width: w, allow }));
    if (early && early.found && !early.visible && !allow.includes('late-title')) {
      list.push({ level: 'FAIL', id: 'late-title', width: w, message: `The title is not readable 1.2s after the page loaded (${early.why}).`, fix: 'Put the headline in the HTML, painted on the first frame.' });
    }
    const covered = [...new Map(frameChecks.filter(Boolean).flatMap((f, i) => f.covered.map((c) => [c.text, { ...c, screen: i + 1 }]))).values()];
    if (covered.length && !allow.includes('covered-text')) list.push({ level: 'FAIL', id: 'covered-text', width: w, message: 'Large text lies under another element at some scroll position: ' + covered.slice(0, 4).map((c) => `"${c.text}" (screen ${c.screen}, ${Math.round(c.share * 100)}% hidden)`).join('; '), fix: 'Nothing may sit on top of a headline or statement.' });
    const clipped = [...new Map(frameChecks.filter(Boolean).flatMap((f, i) => (f.clipped || []).map((c) => [c.text, { ...c, screen: i + 1 }]))).values()];
    if (clipped.length && !allow.includes('clipped-text')) list.push({ level: 'FAIL', id: 'clipped-text', width: w, message: 'Large text is cut off along its top: ' + clipped.slice(0, 3).map((c) => `"${c.text}" (screen ${c.screen})`).join('; '), fix: 'Give the box room for the ascenders.' });
    const overPictures = [...new Map(frameChecks.filter(Boolean).flatMap((f, i) => (f.pinnedOver || []).map((c) => [c.text, { ...c, screen: i + 1 }]))).values()];
    if (overPictures.length && !allow.includes('pinned-over-picture')) list.push({ level: 'WARN', id: 'pinned-over-picture', width: w, message: 'Pinned large text slides across pictures: ' + overPictures.slice(0, 3).map((c) => `"${c.text}" (screen ${c.screen})`).join('; '), fix: 'Keep pictures out of the title column, or unpin it.' });
    const empty = frameChecks.map((f, i) => ({ f, i })).filter(({ f }) => f && f.filled < 0.2);
    if (w >= 1100 && empty.length >= 2 && !allow.includes('empty-screens')) list.push({ level: 'FAIL', id: 'empty-screens', width: w, message: `${empty.length} of ${frameChecks.length} desktop screens are almost empty ground: screens ${empty.map(({ i }) => i + 1).join(', ')}.`, fix: 'Underbuilt section: set its content larger, give it the full information, or cut it.' });
    const runs = new Map();
    frameChecks.forEach((f, i) => { for (const t of f?.big || []) { const r = runs.get(t) || { start: i, last: i - 1, best: 0 }; if (r.last === i - 1) r.last = i; else { r.start = i; r.last = i; } r.best = Math.max(r.best, r.last - r.start + 1); runs.set(t, r); } });
    const longPins = [...runs.entries()].filter(([, r]) => r.best >= 3);
    if (w >= 1100 && longPins.length && !allow.includes('long-pin')) list.push({ level: 'WARN', id: 'long-pin', width: w, message: `The same large text stays on screen for ${Math.max(...longPins.map(([, r]) => r.best))} screens in a row: ` + longPins.slice(0, 2).map(([t]) => `"${t}"`).join('; '), fix: 'A pinned element earns two screens.' });
    if (w >= 1100 && motion && !allow.includes('still-page')) {
      const moving = motion.elements + motion.playingVideos * 4;
      if (moving < 8) list.push({ level: 'FAIL', id: 'still-page', width: w, message: `Only ${motion.elements} element(s) moved while the page loaded and scrolled.`, fix: 'Build the motion layer.' });
      else if (moving < 16) list.push({ level: 'WARN', id: 'still-page', width: w, message: `Little motion: ${motion.elements} element(s) moved.`, fix: 'Give every section an entrance and add one moving picture.' });
    }
    findings.push(...list);
    viewports.push({ width: w, height: h, screens: frameChecks.length, filled: frameChecks.map((f) => f?.filled ?? null), motion, hero: metrics.hero, type: metrics.type, page: metrics.page, colour: metrics.color, headings: metrics.headingSummary, fold, shots });
  });
}

// reduced motion: nothing may stay hidden
{
  const rpBrowser = await Browser.launch({ width: 1440, height: 900 });
  const rp = await rpBrowser.newPage({ width: 1440, height: 900, dsf: 1, reducedMotion: true });
  await rp.send('Emulation.setAutoDarkModeOverride', { enabled: false }).catch(() => {});
  await rp.goto(url, { timeoutMs: 30000, settleMs: 1500 });
  const hidden = await rp.eval(`(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const rg = document.createRange();
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue.trim(); const el = n.parentElement; if (t.length < 3 || !el || el.closest('script, style, noscript, [aria-hidden="true"]')) continue;
      rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width < 2 || r.top > innerHeight || r.bottom < 0) continue;
      let o = 1, gone = false; for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.visibility === 'hidden') { gone = true; break; } o *= +cs.opacity; }
      if (gone || o < 0.1) out.push(t.slice(0, 40));
    }
    return out;
  })()`).catch(() => []);
  if (hidden.length >= 2) findings.push({ level: 'FAIL', id: 'reduced-hidden', width: 1440, message: `With reduced motion requested, ${hidden.length} text block(s) on the first screen stay invisible: ` + hidden.slice(0, 4).map((t) => `"${t}"`).join(', '), fix: 'Put hidden starting states inside @media (prefers-reduced-motion: no-preference).' });
  await rp.close();
  await rpBrowser.close();
}

const merged = [];
for (const f of findings) {
  const same = merged.find((x) => x.id === f.id && x.level === f.level);
  if (same && f.id !== 'headline-lines' && f.id !== 'overflow') { same.alsoAt = [...(same.alsoAt || []), f.width]; continue; }
  merged.push(f);
}

writeFileSync(join(outDir, 'audit.json'), JSON.stringify({ url, at: new Date().toISOString(), allow, viewports, findings: merged }, null, 1));

const d = viewports[0];
console.log(`AUDIT  ${url}`);
console.log(`  hero      "${d.hero.text.slice(0, 60)}" ${d.hero.words}w ${d.hero.lines} line(s) ${d.hero.size}px (${d.hero.vw}vw) ${d.hero.font} ${d.hero.weight} tracking ${d.hero.tracking}em leading ${d.hero.leading}`);
for (const v of viewports.slice(1)) console.log(`  @${v.width}px   ${v.hero?.lines} line(s) ${v.hero?.size}px`);
console.log(`  type      ${d.type.families.filter((f) => f.share >= 0.02).map((f) => `${f.family} ${Math.round(f.share * 100)}%`).join(', ')}`);
console.log(`  sizes     ${d.type.sizes.join(' / ')} px  body ${d.type.body?.size}px / ${d.type.body?.leading}`);
console.log(`  colour    page ${d.colour.bodyBg} · sections ${(d.colour.sectionBgs || []).map((s) => s.color).slice(0, 8).join(' ')}`);
console.log(`  page      ${d.page.screens} screens · ${d.page.words} words · ${d.page.img} images`);
console.log(`  headings  ${d.headings.count} · longest ${d.headings.maxLines} line(s)`);
console.log(`  filled    ${viewports.map((v) => v.width + ': ' + v.filled.join(',')).join('  ')}`);
console.log(`  motion    ${JSON.stringify(viewports.map((v) => [v.width, v.motion && v.motion.elements]))}`);
const fails = merged.filter((f) => f.level === 'FAIL');
const warns = merged.filter((f) => f.level === 'WARN');
console.log('');
for (const [title, list] of [['FAIL', fails], ['WARN', warns]]) {
  if (!list.length) continue;
  console.log(title);
  for (const f of list) console.log(`  [${f.id}] @${f.width}px${f.alsoAt ? ' (+' + f.alsoAt.join(', ') + ')' : ''}  ${f.message}`);
}
console.log(fails.length ? `\nRESULT: ${fails.length} FAIL, ${warns.length} WARN` : `\nRESULT: 0 FAIL, ${warns.length} WARN`);
