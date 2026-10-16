import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = process.env.RUTASCAN_BACKEND ?? 'http://127.0.0.1:8000'

// `vite build --mode deploy` targets the RutaScan backend, which serves this
// app at http://127.0.0.1:8000/app/ (see scripts/copy-to-web.mjs).
export default defineConfig(({ mode }) => ({
  base: mode === 'deploy' ? '/app/' : '/',
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
}))
