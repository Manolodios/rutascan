import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = process.env.RUTASCAN_BACKEND ?? 'http://127.0.0.1:8000'

// `npm run build:web` copies the build into <project>/web, which is what the
// RutaScan backend (WEB_DIR=<project>/web) serves at http://127.0.0.1:8000/.
// The panel uses hash routing (#/rutas), so everything lives under "/".
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Dev: forward API calls to the RutaScan FastAPI backend (avoids CORS).
    proxy: {
      '/auth': BACKEND,
      '/api': BACKEND,
      '/uploads': BACKEND,
      '/health': BACKEND,
    },
  },
})
