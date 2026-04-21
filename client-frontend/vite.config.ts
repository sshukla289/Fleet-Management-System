import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const frontendPort = Number.parseInt(env.FRONTEND_PORT ?? '5173', 10)

  return {
    envDir: '..',
    plugins: [tailwindcss(), react()],
    optimizeDeps: {
      include: [
        '@tanstack/react-query',
        '@tanstack/query-core',
        'leaflet',
        'leaflet.markercluster',
        'recharts',
      ],
    },
    define: {
      global: 'window',
    },
    resolve: {
      alias: {
        'sockjs-client': 'sockjs-client/dist/sockjs.js',
      },
    },
    server: {
      host: '127.0.0.1',
      port: Number.isFinite(frontendPort) ? frontendPort : 5173,
      strictPort: true,
      watch: {
        usePolling: true,
      },
    },
  }
})
