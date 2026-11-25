/* Iconos vivos de la barra del teléfono. Cada pieza que se mueve es un grupo
   propio; las animaciones están en nav.css y solo usan transform y opacity. */

/** Wok que saltea. */
export function NavWok() {
  return (
    <svg className="pd-ni pd-ni-wok" viewBox="0 0 48 48" aria-hidden="true">
      <g className="pd-ni-food">
        <path className="pd-ni-noodle" d="M11 25c0-8 10-8 10 0M19 25c0-11 13-11 13 0" />
        <circle className="pd-ni-pea" cx="14" cy="17" r="2.4" />
        <circle className="pd-ni-shrimp" cx="27" cy="13" r="2.8" />
      </g>
      <path className="pd-ni-line" d="m36 24 8-6" />
      <path className="pd-ni-body" d="M5 25h33c-.6 9-7 14.5-16.500 14.500S5.600 34 5 25Z" />
    </svg>
  )
}

/** El food truck. */
export function NavTruck() {
  return (
    <svg className="pd-ni pd-ni-truck" viewBox="0 0 48 48" aria-hidden="true">
      <g className="pd-ni-drive">
        <path className="pd-ni-body" d="M3 14a2 2 0 0 1 2-2h25v22H5a2 2 0 0 1-2-2V14Z" />
        <path className="pd-ni-body" d="M30 18h7.500a3 3 0 0 1 2.600 1.500l4.400 7.600c.3.500.5 1 .5 1.600V32a2 2 0 0 1-2 2H30V18Z" />
        <path className="pd-ni-window" d="M8 19h17v6H8z" />
        <path className="pd-ni-awning" d="M6.500 15h20l1.500 5H5l1.500-5Z" />
        <path className="pd-ni-window" d="M33.500 21.500h3.600l3 5.500h-6.600z" />
        <path className="pd-ni-beam" d="m45 30 9-3v8l-9-2Z" />
        <g className="pd-ni-wheel" style={{ transformOrigin: '13px 35px' }}><circle cx="13" cy="35" r="4.600" /><path d="M13 31v8M9 35h8" /></g>
        <g className="pd-ni-wheel" style={{ transformOrigin: '36px 35px' }}><circle cx="36" cy="35" r="4.600" /><path d="M36 31v8M32 35h8" /></g>
      </g>
    </svg>
  )
}

/** El cliente feliz, comiendo tallarines. */
export function NavEater() {
  return (
    <svg className="pd-ni pd-ni-eater" viewBox="0 0 48 48" aria-hidden="true">
      <g className="pd-ni-head">
        <circle className="pd-ni-face" cx="24" cy="16" r="12.500" />
        <path className="pd-ni-hair" d="M11.800 13.500C12.800 6.500 18 3.500 24 3.500s11.200 3 12.200 10c-4-.4-6.800-2-8.800-4.500-3.200 3-9 4.600-15.600 4.500Z" />
        <g className="pd-ni-eyes"><circle cx="19" cy="17" r="1.900" /><circle cx="29" cy="17" r="1.900" /></g>
      </g>
      <g className="pd-ni-slurp"><path d="M21 23.500c0 3-1.500 4-1.500 7s1.500 4 1.500 7M24 23.500v14M27 23.500c0 3 1.500 4 1.500 7s-1.500 4-1.500 7" /></g>
      <path className="pd-ni-body" d="M7 33.500h34c-.8 7.500-8 12-17 12s-16.200-4.500-17-12Z" />
    </svg>
  )
}

const TONGUES = Array.from({ length: 9 }, (_, i) => i)

/** Hornilla: disco rojo con corona de fuego que se enciende al llegar. */
export function Burner() {
  return (
    <span className="pd-burner" aria-hidden="true">
      <span className="pd-burner-fire">{TONGUES.map(i => <i key={i} style={{ rotate: `${-72 + i * 18}deg` }}><b /></i>)}</span>
      <span className="pd-burner-disc" />
      <span className="pd-burner-sparks"><i /><i /><i /><i /><i /><i /></span>
    </span>
  )
}
