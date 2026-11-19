const LEGACY_RUNTIME_CACHES = new Set([
  'app-assets',
  'optimized-images',
  'remote-product-images',
])

/** Removes the long-lived caches used by previous versions of the PWA. */
export async function clearLegacyPwaRuntimeCaches() {
  if (!('caches' in window)) return
  try {
    const names = await window.caches.keys()
    await Promise.all(names
      .filter(name => LEGACY_RUNTIME_CACHES.has(name))
      .map(name => window.caches.delete(name)))
  } catch {
    // Cache cleanup must not block the application update.
  }
}
