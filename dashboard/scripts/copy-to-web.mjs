/**
 * Copies the production build into <project>/web/app so the RutaScan backend
 * (WEB_DIR=<project>/web) serves it at http://127.0.0.1:8000/app/.
 */
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '..', 'dist')
const target = resolve(here, '..', '..', 'web', 'app')

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(dist, target, { recursive: true })

console.log(`[rutascan] panel nuevo copiado a ${target}`)
