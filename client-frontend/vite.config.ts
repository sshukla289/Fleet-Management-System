import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
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
    watch: {
      usePolling: true,
    },
  },
})
