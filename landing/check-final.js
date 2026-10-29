#!/usr/bin/env node
// check-final.js — Agente de verificación antes de entregar
// Revisa errores en landing, web, rutascan-web y MagnetLines

const fs = require('fs');
const path = require('path');

const errors = [];
const checks = [];

function pass(msg) { checks.push('✓ ' + msg); }
function fail(msg) { errors.push('✗ ' + msg); }

console.log('=== AGENTE DE REVISION FINAL ===');
console.log('');

// 1. landing/index-editorial.html existe y es funcional
if (fs.existsSync('landing/index-editorial.html')) {
  const content = fs.readFileSync('landing/index-editorial.html', 'utf8');
  if (content.includes('<!DOCTYPE html>')) pass('index-editorial.html es HTML válido');
  else fail('index-editorial.html NO es HTML válido');

  // Verifica que sea exactamente .next/server/app/index.html (Next.js build completo)
  if (fs.existsSync('rutascan-web/.next/server/app/index.html')) {
    const nextHtml = fs.readFileSync('rutascan-web/.next/server/app/index.html', 'utf8');
    if (content === nextHtml) pass('landing/index-editorial.html es exactamente .next/server/app/index.html (Next.js build completo)');
    else fail('landing/index-editorial.html NO es igual a .next/server/app/index.html');
  } else {
    fail('rutascan-web/.next/server/app/index.html NO existe');
  }

  // Verifica que los chunks estáticos existan localmente
  if (fs.existsSync('landing/_next/static/chunks/') || fs.existsSync('landing/static/chunks/')) {
    const chunksDir = fs.existsSync('landing/_next/static/chunks/') ? 'landing/_next/static/chunks/' : 'landing/static/chunks/';
    const chunks = fs.readdirSync(chunksDir);
    if (chunks.some(c => c.endsWith('.js'))) pass('landing tiene chunks .js (Next.js build completo)');
    else fail('landing NO tiene chunks .js');
  } else {
    fail('landing NO tiene chunks .js');
  }

  // Verifica que sea exactamente igual a index.html (página principal)
  if (fs.existsSync('landing/index.html')) {
    const indexContent = fs.readFileSync('landing/index.html', 'utf8');
    if (content === indexContent) pass('landing/index-editorial.html === landing/index.html (página principal)');
    else fail('landing/index-editorial.html NO es igual a landing/index.html');
  } else {
    fail('landing/index.html NO existe');
  }
} else {
  fail('landing/index-editorial.html NO existe');
}

// 2. Assets locales disponibles
['landing/img/bodega-real.jpg', 'landing/img/02-mapa-en-vivo.png', 'landing/fonts/roundo-400.woff2'].forEach(p => {
  if (fs.existsSync(p)) pass('Asset local: ' + p);
  else fail('Asset local NO existe: ' + p);
});

// 3. MagnetLines vanilla JS funcional
if (fs.existsSync('landing/js/magnet-lines.js')) {
  const js = fs.readFileSync('landing/js/magnet-lines.js', 'utf8');
  if (js.includes('VERTEX_SHADER') && js.includes('FRAGMENT_SHADER')) pass('magnet-lines.js tiene shaders WebGL2');
  else fail('magnet-lines.js NO tiene shaders WebGL2');

  if (js.includes('magnet-lines__canvas')) pass('magnet-lines.js crea canvas');
  else fail('magnet-lines.js NO crea canvas');

  if (js.includes('new MagnetLines')) pass('magnet-lines.js exporta componente');
  else fail('magnet-lines.js NO exporta componente');
} else {
  fail('landing/js/magnet-lines.js NO existe');
}

if (fs.existsSync('landing/js/magnet-lines.css')) pass('magnet-lines.css existe');
else fail('magnet-lines.css NO existe');

// 4. rutascan-web (Next.js) funciona
if (fs.existsSync('rutascan-web/src/components/hero.tsx')) pass('rutascan-web/hero.tsx existe');
else fail('rutascan-web/hero.tsx NO existe');

if (fs.existsSync('rutascan-web/src/components/magnet-lines.tsx')) pass('rutascan-web/magnet-lines.tsx existe');
else fail('rutascan-web/magnet-lines.tsx NO existe');

if (fs.existsSync('rutascan-web/src/app/page.tsx')) pass('rutascan-web/page.tsx existe');
else fail('rutascan-web/page.tsx NO existe');

if (fs.existsSync('rutascan-web/src/app/globals.css')) pass('rutascan-web/globals.css existe');
else fail('rutascan-web/globals.css NO existe');

// 5. web/index.html actualizado (página principal de Render)
if (fs.existsSync('web/index.html')) {
  const webContent = fs.readFileSync('web/index.html', 'utf8');
  // Next.js build no incluye magnet-lines.js ni styles-editorial.css directamente
  // usa chunks en _next/static/chunks/
  if (webContent.includes('_next/static/chunks/')) pass('web/index.html usa chunks de Next.js (_next/static/chunks/)');
  else fail('web/index.html NO usa chunks de Next.js');
} else {
  fail('web/index.html NO existe');
}

// 6. Verifica que los assets en web/ sean los locales (no referencias rotas)
['web/img/bodega-real.jpg', 'web/img/02-mapa-en-vivo.png', 'web/fonts/roundo-400.woff2', 'web/_next/static/chunks/'].forEach(p => {
  if (fs.existsSync(p)) pass('web/' + p.split('web/')[1] + ' copiado');
  else fail('web/' + p.split('web/')[1] + ' NO existe');
});

// Resumen
console.log('');
console.log('=== RESULTADO FINAL ===');
if (errors.length === 0) {
  console.log('✓ NINGUN ERROR ENCONTRADO. Todo listo para entregar.');
} else {
  console.log('✗ ' + errors.length + ' ERROR(ES) ENCONTRADO(S):');
  errors.forEach(e => console.log('  ' + e));
}
console.log('✓ ' + checks.length + ' verificaciones pasadas.');