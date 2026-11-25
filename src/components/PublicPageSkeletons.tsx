import './PublicPageSkeletons.css'

// Esqueletos de la página pública (/pedir). Cada uno copia la forma de la
// sección que va a aparecer, para que al cargar el contenido no "salte".
// El brillo lo da la clase global .fc-skeleton (index.css).

/** Tarjetas de "Date un banquete" (inicio de escritorio). */
export function PublicHomeProductSkeletons({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <article className="public-home-product-card pps-home-product" key={index} aria-hidden="true">
          <span className="pps-media fc-skeleton" />
          <span className="pps-body">
            <span className="pps-line pps-w70 fc-skeleton" />
            <span className="pps-line pps-w40 pps-tall fc-skeleton" />
            <span className="pps-line pps-w30 fc-skeleton" />
            <span className="pps-actions">
              <span className="pps-stepper fc-skeleton" />
              <span className="pps-button fc-skeleton" />
            </span>
          </span>
        </article>
      ))}
    </>
  )
}

/** Tarjetas de "Nuestras promociones" (inicio de escritorio). */
export function PublicHomePromoSkeletons({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <article className="public-home-promo-card pps-home-promo" key={index} aria-hidden="true">
          <span className="pps-line pps-w70 fc-skeleton" />
          <span className="pps-line pps-w40 pps-tall fc-skeleton" />
          <span className="pps-promo-media fc-skeleton" />
          <span className="pps-button pps-full fc-skeleton" />
        </article>
      ))}
    </>
  )
}

/** Filas de "Platos favoritos": misma forma que las tarjetas reales. */
export function ProfileFavoritesSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="pps-favorites" role="status" aria-label="Cargando favoritos">
      {Array.from({ length: count }, (_, index) => (
        <span className="pps-favorite" key={index} aria-hidden="true">
          <span className="pps-thumb fc-skeleton" />
          <span className="pps-row-copy">
            <span className="pps-line pps-w60 fc-skeleton" />
            <span className="pps-line pps-w30 fc-skeleton" />
          </span>
        </span>
      ))}
    </div>
  )
}

/** Productos de una comanda dentro del historial: foto, nombre y cantidad. */
export function ProfileOrderItemsSkeleton() {
  return (
    <div className="pps-order-items" role="status" aria-label="Cargando productos del pedido">
      {Array.from({ length: 2 }, (_, index) => (
        <span className="pps-order-dish" key={index} aria-hidden="true">
          <span className="pps-thumb fc-skeleton" />
          <span className="pps-row-copy">
            <span className="pps-line pps-w60 fc-skeleton" />
            <span className="pps-line pps-w40 fc-skeleton" />
          </span>
        </span>
      ))}
    </div>
  )
}

/** Tarjetas de "Pedidos recientes": modalidad, plato y botón de repetir. */
export function ProfileRecentOrdersSkeleton() {
  return (
    <div className="pps-orders" role="status" aria-label="Cargando tus últimos pedidos">
      {Array.from({ length: 2 }, (_, index) => (
        <span className="pps-order" key={index} aria-hidden="true">
          <span className="pps-line pps-w30 fc-skeleton" />
          <span className="pps-order-dish">
            <span className="pps-thumb fc-skeleton" />
            <span className="pps-row-copy">
              <span className="pps-line pps-w70 pps-tall fc-skeleton" />
              <span className="pps-line pps-w50 fc-skeleton" />
            </span>
          </span>
          <span className="pps-button pps-full fc-skeleton" />
        </span>
      ))}
    </div>
  )
}

/** "Mi perfil" mientras se comprueba la sesión o llega el perfil.
 *  En computadora repite las tres columnas: tarjeta, favoritos y pedidos, historial. */
export function PublicProfileSkeleton() {
  return (
    <section className="pps-profile" role="status" aria-label="Cargando tu perfil">
      <span className="pps-profile-heading" aria-hidden="true">
        <span className="pps-line pps-title fc-skeleton" />
        <span className="pps-line pps-subtitle fc-skeleton" />
      </span>
      <span className="pps-panel pps-loyalty" aria-hidden="true">
        <span className="pps-line pps-w40 fc-skeleton" />
        <span className="pps-line pps-w70 pps-tall fc-skeleton" />
        <span className="pps-stamps">
          {Array.from({ length: 10 }, (_, index) => <span className="fc-skeleton" key={index} />)}
        </span>
        <span className="pps-line pps-full-line fc-skeleton" />
      </span>
      <span className="pps-column" aria-hidden="true">
        {Array.from({ length: 2 }, (_, panel) => (
          <span className="pps-panel" key={panel}>
            <span className="pps-line pps-w40 fc-skeleton" />
            <span className="pps-line pps-w60 pps-tall fc-skeleton" />
            <span className="pps-block fc-skeleton" />
          </span>
        ))}
      </span>
      <span className="pps-panel pps-history" aria-hidden="true">
        <span className="pps-line pps-w60 pps-tall fc-skeleton" />
        {Array.from({ length: 4 }, (_, index) => <span className="pps-history-row fc-skeleton" key={index} />)}
      </span>
    </section>
  )
}

/** "Contacto" mientras se descarga su sección. */
export function PublicContactSkeleton() {
  return (
    <section className="public-contact-view public-contact-page pps-contact" aria-busy="true" aria-label="Cargando contacto">
      <span className="pps-contact-hero fc-skeleton" aria-hidden="true" />
      <span className="pps-line pps-w50 pps-tall fc-skeleton" aria-hidden="true" />
      {Array.from({ length: 3 }, (_, index) => (
        <span className="pps-row" key={index} aria-hidden="true">
          <span className="pps-icon fc-skeleton" />
          <span className="pps-row-copy">
            <span className="pps-line pps-w40 fc-skeleton" />
            <span className="pps-line pps-w70 fc-skeleton" />
          </span>
        </span>
      ))}
    </section>
  )
}
