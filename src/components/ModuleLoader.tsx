import './ModuleLoader.css'

/**
 * Fallback de Suspense para las rutas lazy. Reutiliza el fondo del splash para
 * que la carga de cada módulo se vea como una continuación de la pantalla de
 * carga, en vez de un flash de texto ("Cargando módulo…") sobre página vacía.
 */
export function ModuleLoader() {
  return (
    <div className="module-loader" role="status" aria-label="Cargando">
      <img src="/optimized/root/splash-logo.webp" alt="Full China" className="module-loader-logo" />
      <div className="module-loader-spinner" />
    </div>
  )
}
