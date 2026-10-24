import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

type PerformanceSample = {
  route: string
  resource: string
  method: string
  status: number
  durationMs: number
  finishedAt: number
}

function localPerformanceProbe(): Plugin {
  const samples: PerformanceSample[] = []
  return {
    name: 'fullchina-local-performance-probe',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/performance', (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store')
        const request = req as unknown as {
          method?: string
          on: (event: 'data' | 'end', listener: (chunk?: Uint8Array) => void) => void
        }
        if (request.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(samples))
          return
        }
        if (request.method !== 'POST') {
          next()
          return
        }

        const chunks: Uint8Array[] = []
        let bytes = 0
        request.on('data', (chunk) => {
          if (!chunk) return
          bytes += chunk.length
          if (bytes <= 2048) chunks.push(chunk)
        })
        request.on('end', () => {
          if (bytes > 2048) {
            res.statusCode = 413
            res.end()
            return
          }
          try {
            const body = new Uint8Array(bytes)
            let offset = 0
            for (const chunk of chunks) {
              body.set(chunk, offset)
              offset += chunk.length
            }
            const value = JSON.parse(Array.from(body, byte => String.fromCharCode(byte)).join('')) as Partial<PerformanceSample>
            const durationMs = Number(value.durationMs)
            if (typeof value.route !== 'string' || !/^\/[\w/-]{1,120}$/.test(value.route) ||
                typeof value.resource !== 'string' || !/^[\w/:-]{1,100}$/.test(value.resource) ||
                !Number.isFinite(durationMs) || durationMs < 0) {
              res.statusCode = 400
              res.end()
              return
            }
            samples.push({
              route: value.route,
              resource: value.resource,
              method: typeof value.method === 'string' && /^[A-Z]{1,8}$/.test(value.method) ? value.method : 'OTHER',
              status: Number.isInteger(value.status) ? Number(value.status) : 0,
              durationMs: Math.round(durationMs * 10) / 10,
              finishedAt: Date.now(),
            })
            if (samples.length > 500) samples.splice(0, samples.length - 500)
            res.statusCode = 204
            res.end()
          } catch {
            res.statusCode = 400
            res.end()
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    localPerformanceProbe(),
    VitePWA({
      // No activar una versión nueva a mitad de una sesión: autoUpdate hace
      // que el cliente recargue la página en cuanto el SW nuevo toma control.
      // La app mostrará una acción explícita para aplicar la actualización.
      registerType: 'prompt',
      injectRegister: null,
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
            urlPattern: /(?:^https:\/\/images\.unsplash\.com\/|\/storage\/v1\/(?:object|render\/image)\/public\/)/i,
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
    css: true,
    exclude: [...configDefaults.exclude, 'whatsapp-bot/**']
  }
})
