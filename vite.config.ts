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
          // Los módulos se guardan cuando realmente se usan. Precargar aquí
          // todo el panel administrativo hacía que el service worker bajara
          // varios MB y compitiera con el menú en conexiones móviles lentas.
          '**/assets/**',
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
            urlPattern: /\/assets\/.*\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-assets',
              expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /\/(?:optimized\/.*|productos\/.*)\.(?:png|jpg|jpeg|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'optimized-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            // Las fotos remotas del catálogo se reutilizan entre ventas. En
            // datos móviles, servirlas desde el dispositivo evita descargarlas
            // nuevamente en cada entrada a Caja.
            urlPattern: ({ url }: { url: any }) =>
              url.hostname === 'images.unsplash.com' ||
              /\/storage\/v1\/(?:object|render\/image)\/public\//i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'remote-product-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
          // Mantén el helper de imports dinámicos en un chunk diminuto. Si
          // Rollup lo agrupa con jsPDF, hasta la ruta pública termina
          // descargando toda la librería de reportes antes de necesitarla.
          if (id.includes('vite/preload-helper')) return 'vite-runtime'
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
