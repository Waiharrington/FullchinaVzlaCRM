/* Iconos de línea de la barra del teléfono: se dibujan al activarse. */
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Cuenco con palillos. */
export function NavBowl() {
  return (
    <svg className="pd-ni" viewBox="0 0 24 24" {...line} aria-hidden="true">
      <path pathLength="1" d="M3 11.500h18c0 4.400-2.600 7.400-6 8.600v.9H9v-.9c-3.400-1.200-6-4.200-6-8.600Z" />
      <path pathLength="1" d="m12.500 8.500 7-6" />
      <path pathLength="1" d="m16 8.500 5.500-3.800" />
      <path pathLength="1" d="M6.500 8.500c0-1.600 1.500-1.600 1.500-3.200M9.800 8.500c0-1.600 1.500-1.600 1.500-3.200" />
    </svg>
  )
}

/** Punto en el mapa. */
export function NavPlace() {
  return (
    <svg className="pd-ni" viewBox="0 0 24 24" {...line} aria-hidden="true">
      <path pathLength="1" d="M12 21.500s7.200-6.100 7.200-11.700A7.200 7.200 0 0 0 12 2.500a7.200 7.200 0 0 0-7.200 7.300c0 5.600 7.200 11.700 7.200 11.700Z" />
      <circle pathLength="1" cx="12" cy="9.800" r="2.600" />
    </svg>
  )
}

/** Perfil. */
export function NavPerson() {
  return (
    <svg className="pd-ni" viewBox="0 0 24 24" {...line} aria-hidden="true">
      <circle pathLength="1" cx="12" cy="8" r="4.300" />
      <path pathLength="1" d="M4 21c.6-4.300 3.900-6.800 8-6.800s7.400 2.500 8 6.800" />
    </svg>
  )
}
