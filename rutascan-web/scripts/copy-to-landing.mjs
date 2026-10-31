/**
 * Copies the Next.js production build into <project>/landing, which the
 * RutaScan backend serves at http://127.0.0.1:8000/.
 *
 * Next emits the page at .next/server/app/index.html and the browser assets
 * under .next/static. The HTML references them as /_next/static/..., so the
 * static folder must land in landing/_next/static (not landing/_next).
 *
 * <project>/landing/_next is a generated folder: this script owns it and
 * rewrites it completely on every run.
 */
import { access, copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const nextDir = resolve(root, ".next");
const landing = resolve(root, "..", "landing");

const htmlSrc = resolve(nextDir, "server/app/index.html");
const staticSrc = resolve(nextDir, "static");

try {
  await access(htmlSrc);
  await access(staticSrc);
} catch {
  console.error(
    '[rutascan] falta el build de Next - ejecute primero "npm run build"',
  );
  process.exit(1);
}

await rm(resolve(landing, "_next"), { recursive: true, force: true });
await mkdir(resolve(landing, "_next"), { recursive: true });
await cp(staticSrc, resolve(landing, "_next/static"), { recursive: true });

await copyFile(htmlSrc, resolve(landing, "index.html"));
await copyFile(htmlSrc, resolve(landing, "index-editorial.html"));

try {
  await copyFile(
    resolve(nextDir, "server/app/favicon.ico.body"),
    resolve(landing, "favicon.ico"),
  );
} catch {
  // favicon is optional
}

console.log(`[rutascan] landing copiada a ${landing}`);
