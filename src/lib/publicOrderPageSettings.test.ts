import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS,
  normalizePublicOrderPageSettings,
  PUBLIC_ORDER_BANNER_OPTIONS,
} from './publicOrderPageSettings'

describe('public order page settings', () => {
  it('uses current Full China content when the public settings are unavailable', () => {
    expect(normalizePublicOrderPageSettings(null)).toEqual(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS)
  })

  it('trims edited copy, bounds lengths and accepts only local banner choices', () => {
    const normalized = normalizePublicOrderPageSettings({
      mobileHeading: '  ¡Pide Full China!  ',
      searchPlaceholder: '  Busca tu plato  ',
      desktopDescription: 'x'.repeat(250),
      desktopBannerImage: 'https://tracking.example/banner.jpg',
    })
    expect(normalized.mobileHeading).toBe('¡Pide Full China!')
    expect(normalized.searchPlaceholder).toBe('Busca tu plato')
    expect(normalized.desktopDescription).toHaveLength(240)
    expect(normalized.desktopBannerImage).toBe(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.desktopBannerImage)
    expect(PUBLIC_ORDER_BANNER_OPTIONS.every(option => option.value.startsWith('/optimized/fondos/'))).toBe(true)
  })

  it('preserves whether the carousel has an explicit selection, including an intentional empty selection', () => {
    expect(normalizePublicOrderPageSettings({ carouselSelectionConfigured: true }).carouselSelectionConfigured).toBe(true)
    expect(normalizePublicOrderPageSettings({ carouselSelectionConfigured: false }).carouselSelectionConfigured).toBe(false)
  })
})
