/**
 * Copies the production build into <project>/web, which the RutaScan backend
 * (WEB_DIR=<project>/web) serves at http://127.0.0.1:8000/.
 *
 * <project>/web is a generated folder: this script owns it and rewrites it
 * completely on every run.
 */
import { access, cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '..', 'dist')
const target = resolve(here, '..', '..', 'web')

try {
  await access(resolve(dist, 'index.html'))
} catch {
  console.error('[rutascan] falta dist/index.html - ejecute primero "npm run build"')
  process.exit(1)
}

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(dist, target, { recursive: true })

console.log(`[rutascan] panel copiado a ${target}`)
