import { describe, expect, it } from 'vitest'
import publicMenuCss from '../pages/PublicMenu.css?raw'
import { MIN_TEXT_CONTRAST, contrastRatio } from '../lib/colorContrast'

// Toma el último bloque :root con los colores por superficie.
function readTokens(css: string): Record<string, string> {
  const blocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map(match => match[1])
  const tokens: Record<string, string> = {}
  for (const block of blocks) {
    for (const [, name, value] of block.matchAll(/(--public-[\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim()
  }
  return tokens
}

function resolve(value: string, tokens: Record<string, string>): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => tokens[name] ?? name).replace(/\s*!important\s*$/, '').trim()
}

const tokens = readTokens(publicMenuCss)

describe('Contraste del menú público', () => {
  it('define los colores por superficie', () => {
    for (const name of ['--public-surface-dark', '--public-surface-light', '--public-accent-on-light', '--public-accent-on-dark']) {
      expect(tokens[name], name).toBeTruthy()
    }
  })

  it.each([
    ['--public-accent-on-dark', '--public-surface-dark'],
    ['--public-red-on-dark', '--public-surface-dark'],
    ['--public-muted-on-dark', '--public-surface-dark'],
    ['--public-accent-on-light', '--public-surface-light'],
    ['--public-accent-on-light', '--public-accent-on-light-bg'],
    ['--public-red-on-light', '--public-surface-light'],
    ['--public-muted-on-light', '--public-surface-light'],
  ])('%s se lee sobre %s', (text, surface) => {
    expect(contrastRatio(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
  })

  // Cualquier color de texto declarado dentro del recibo blanco debe leerse
  // sobre blanco. Así un acento pensado para fondo oscuro no se cuela ahí.
  it('los textos del recibo blanco tienen contraste suficiente', () => {
    const failures: string[] = []
    for (const [, selector, body] of publicMenuCss.matchAll(/([^{}]*\.public-receipt[^{}]*)\{([^{}]*)\}/g)) {
      const background = body.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/)?.[1]
      const surface = background ? resolve(background, tokens) : tokens['--public-surface-light']
      for (const [, value] of body.matchAll(/(?:^|[;{\s])color\s*:\s*([^;]+)/g)) {
        const color = resolve(value, tokens)
        if (/^(inherit|currentcolor|transparent|initial|unset)$/i.test(color)) continue
        let ratio: number
        try { ratio = contrastRatio(color, /^(#|rgb)/i.test(surface) ? surface : tokens['--public-surface-light']) } catch { continue }
        if (ratio < MIN_TEXT_CONTRAST) failures.push(`${selector.trim().replace(/\s+/g, ' ')} → ${color} (${ratio.toFixed(2)}:1)`)
      }
    }
    expect(failures).toEqual([])
  })
})
