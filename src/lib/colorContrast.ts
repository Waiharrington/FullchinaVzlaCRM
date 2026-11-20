// Contraste de color según WCAG 2.x. Se usa en los tests para impedir textos
// que no se leen (p. ej. amarillo claro sobre blanco).

export interface Rgba { r: number; g: number; b: number; a: number }

/** Admite #rgb, #rrggbb, #rrggbbaa, rgb() y rgba(). Devuelve null si no lo reconoce. */
export function parseColor(value: string): Rgba | null {
  const color = value.trim().toLowerCase()
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map(d => d + d).join('') : hex[1]
    const channel = (index: number) => parseInt(digits.slice(index, index + 2), 16)
    return { r: channel(0), g: channel(2), b: channel(4), a: digits.length === 8 ? channel(6) / 255 : 1 }
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(part => part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part))
    if (parts.length < 3 || parts.some(Number.isNaN)) return null
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
  }
  return null
}

/** Mezcla un color semitransparente sobre un fondo opaco. */
export function blendOver(foreground: Rgba, background: Rgba): Rgba {
  const a = foreground.a
  return {
    r: foreground.r * a + background.r * (1 - a),
    g: foreground.g * a + background.g * (1 - a),
    b: foreground.b * a + background.b * (1 - a),
    a: 1,
  }
}

function relativeLuminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** Relación de contraste entre texto y fondo (1 a 21). */
export function contrastRatio(text: string | Rgba, background: string | Rgba): number {
  const bg = typeof background === 'string' ? parseColor(background) : background
  const fg = typeof text === 'string' ? parseColor(text) : text
  if (!bg || !fg) throw new Error(`Color no reconocido: ${String(text)} / ${String(background)}`)
  const opaqueBg = bg.a < 1 ? blendOver(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg
  const opaqueFg = fg.a < 1 ? blendOver(fg, opaqueBg) : fg
  const lighter = Math.max(relativeLuminance(opaqueFg), relativeLuminance(opaqueBg))
  const darker = Math.min(relativeLuminance(opaqueFg), relativeLuminance(opaqueBg))
  return (lighter + 0.05) / (darker + 0.05)
}

/** Mínimo WCAG AA para texto normal. */
export const MIN_TEXT_CONTRAST = 4.5
