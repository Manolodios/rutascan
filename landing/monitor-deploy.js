#!/usr/bin/env node
// monitor-deploy.js — Agente que verifica que rutascan.onrender.com sea idéntico a localhost:3000
// Ejecutar localmente: node landing/monitor-deploy.js

const http = require('http');
const https = require('https');
const fs = require('fs');

const PROD_URL = 'https://rutascan.onrender.com/';
const LOCAL_URL = 'http://localhost:3000/';
const CHECK_INTERVAL_MS = 30000; // 30 segundos

function fetch(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    }).on('error', reject);
  });
}

function normalize(html) {
  // Elimina timestamps, nonces, y IDs dinámicos para comparación justa
  return html
    .replace(/nonce="[^"]*"/g, 'nonce=""')
    .replace(/id="__NEXT_DATA__"/g, 'id="__NEXT_DATA__"')
    .replace(/buildId:"[^"]*"/g, 'buildId:"BUILD_ID"')
    .replace(/\.js\?[^"']*/g, '.js')
    .replace(/\.css\?[^"']*/g, '.css')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '<script>SCRIPT</script>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function check() {
  try {
    console.log(`\n[${new Date().toISOString()}] Verificando...`);
    
    const [prod, local] = await Promise.all([
      fetch(PROD_URL),
      fetch(LOCAL_URL).catch(() => ({ status: 0, html: 'LOCAL_NO_DISPONIBLE' }))
    ]);

    console.log(`  Producción: ${prod.status}`);
    console.log(`  Local:      ${local.status}`);

    if (prod.status !== 200) {
      console.log(`  ⚠️  Producción retornó ${prod.status}`);
      return;
    }

    const normProd = normalize(prod.html);
    const normLocal = normalize(local.html);

    if (normProd === normLocal) {
      console.log('  ✅ IDÉNTICO: producción === local');
    } else {
      console.log('  ❌ DIFERENTE:');
      // Encuentra primera diferencia
      for (let i = 0; i < Math.min(normProd.length, normLocal.length); i++) {
        if (normProd[i] !== normLocal[i]) {
          console.log(`     Diferencia en char ${i}:`);
          console.log(`       prod:  ...${normProd.slice(Math.max(0,i-50), i+50)}...`);
          console.log(`       local: ...${normLocal.slice(Math.max(0,i-50), i+50)}...`);
          break;
        }
      }
      if (normProd.length !== normLocal.length) {
        console.log(`     Longitud: prod=${normProd.length} local=${normLocal.length}`);
      }
    }

    // Verifica chunks específicos
    const chunkMatches = prod.html.match(/_next\/static\/chunks\/[^"']+/g) || [];
    console.log(`  📦 Chunks en producción: ${chunkMatches.length}`);
    chunkMatches.forEach(c => console.log(`     - ${c}`));

  } catch (e) {
    console.error('  Error:', e.message);
  }
}

// Ejecución inicial
check();

// Repite cada CHECK_INTERVAL_MS
setInterval(check, CHECK_INTERVAL_MS);

console.log(`\nMonitor iniciado. Verifica cada ${CHECK_INTERVAL_MS/1000}s.`);
console.log(`Producción: ${PROD_URL}`);
console.log(`Local:      ${LOCAL_URL}`);
console.log('Presiona Ctrl+C para detener.\n');