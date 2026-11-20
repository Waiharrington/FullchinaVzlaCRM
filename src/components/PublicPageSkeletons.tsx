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

/** "Mi perfil" mientras se comprueba la sesión o llega el perfil. */
export function PublicProfileSkeleton() {
  return (
    <section className="pps-profile" role="status" aria-label="Cargando tu perfil">
      <span className="pps-profile-card fc-skeleton" aria-hidden="true" />
      <span className="pps-profile-stats" aria-hidden="true">
        <span className="fc-skeleton" />
        <span className="fc-skeleton" />
        <span className="fc-skeleton" />
      </span>
      <span className="pps-line pps-w40 pps-tall fc-skeleton" aria-hidden="true" />
      {Array.from({ length: 3 }, (_, index) => (
        <span className="pps-row" key={index} aria-hidden="true">
          <span className="pps-thumb fc-skeleton" />
          <span className="pps-row-copy">
            <span className="pps-line pps-w60 fc-skeleton" />
            <span className="pps-line pps-w40 fc-skeleton" />
          </span>
          <span className="pps-line pps-price fc-skeleton" />
        </span>
      ))}
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
