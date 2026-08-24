/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Usamos dos manifests propios (cliente/admin) enlazados dinámicamente en
      // index.html, así que desactivamos el manifest que genera el plugin.
      manifest: false,
      includeAssets: ['favicon.ico', 'icons/*.png', 'manifest-cliente.webmanifest', 'manifest-admin.webmanifest'],
      workbox: {
        // Las fotos de productos NO van al precache (pesan ~5.5 MB); se cachean
        // en tiempo de ejecución la primera vez que se muestran.
        globIgnores: [
          '**/productos/**',
          '**/menu-icons/**',
          '**/fondos/**',
          '**/login-carousel/**',
          '**/onboarding-slides/**',
          '**/cargando-pedido/**',
          '**/optimized/**',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/(?:optimized\/.*|productos\/.*)\.(?:png|jpg|jpeg|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'optimized-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('jspdf')) return 'jspdf-vendor'
          if (id.includes('html2canvas')) return 'canvas-vendor'
          if (id.includes('dompurify')) return 'sanitize-vendor'
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts-vendor'
          if (id.includes('@supabase')) return 'supabase-vendor'
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('scheduler') || /node_modules[\\/]react[\\/]/.test(id)) return 'react-vendor'
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
})
