import { describe, expect, it } from 'vitest'
import { formatProductTitle, formatSpanishText } from './textFormat'

describe('formatProductTitle', () => {
  it('aplica acentos y formato de título a nombres del menú', () => {
  expect(formatProductTitle('arroz con camaron y pollo')).toBe('Arroz con Camarón y Pollo')
  expect(formatProductTitle('arroz clasico')).toBe('Arroz Clásico')
  expect(formatProductTitle('duo')).toBe('Dúo')
  expect(formatProductTitle('trio')).toBe('Trío')
    expect(formatProductTitle('chop suey mixto')).toBe('Chop Suey Mixto')
    expect(formatProductTitle('proteinas salteadas')).toBe('Proteínas Salteadas')
    expect(formatProductTitle('cantonés mk')).toBe('Cantonés MK')
    expect(formatSpanishText('Arroz con jamon, pimenton, calabacin y brocoli')).toBe('Arroz con jamón, pimentón, calabacín y brócoli')
    expect(formatSpanishText('6 tequenos y cafe')).toBe('6 tequeños y café')
    expect(formatProductTitle('tequenos')).toBe('Tequeños')
  })

  it('normaliza las contracciones del menú con apóstrofe tipográfico', () => {
    expect(formatProductTitle('Pa Mi')).toBe('Pa’ Mí')
    expect(formatProductTitle("Pa' Ti")).toBe('Pa’ Ti')
    expect(formatProductTitle('Pa Todos')).toBe('Pa’ Todos')
    expect(formatProductTitle('Pa Dos Tallarines')).toBe('Pa’ Dos Tallarines')
  })
})
