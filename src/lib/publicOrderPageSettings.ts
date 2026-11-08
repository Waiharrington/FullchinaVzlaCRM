import { publishDataChange, supabase } from './supabase'

export interface PublicOrderPageSettings {
  mobileHeading: string
  searchPlaceholder: string
  desktopEyebrow: string
  desktopTitlePrefix: string
  desktopTitleAccent: string
  desktopDescription: string
  desktopBannerImage: string
  carouselSelectionConfigured: boolean
}

export const DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS: PublicOrderPageSettings = {
  mobileHeading: '¿Qué provoca hoy?',
  searchPlaceholder: 'Busca Arroz, combos, pollo...',
  desktopEyebrow: 'AUTÉNTICO SABOR AL WOK',
  desktopTitlePrefix: 'HOY TOCA',
  desktopTitleAccent: 'FULL CHINA',
  desktopDescription: 'Sabor real, recién salido del wok. Arroces, tallarines y más, con tradición y porciones generosas.',
  desktopBannerImage: '/optimized/fondos/hero-banner-food.webp',
  carouselSelectionConfigured: false,
}

export const PUBLIC_ORDER_BANNER_OPTIONS = [
  { value: '/optimized/fondos/hero-banner-food.webp', label: 'Wok y arroz (actual)' },
  { value: '/optimized/fondos/combo-banner-bg.webp', label: 'Combos' },
  { value: '/optimized/fondos/public-flow-bg.webp', label: 'Fondo Full China' },
  { value: '/optimized/fondos/delivery-card-bg.webp', label: 'Delivery' },
] as const

type SettingsRow = Partial<Record<keyof PublicOrderPageSettings, unknown>>

function text(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().slice(0, maxLength)
  return normalized || fallback
}

export function normalizePublicOrderPageSettings(value: unknown): PublicOrderPageSettings {
  const row = value && typeof value === 'object' ? value as SettingsRow : {}
  const banner = PUBLIC_ORDER_BANNER_OPTIONS.some(option => option.value === row.desktopBannerImage)
    ? String(row.desktopBannerImage)
    : DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.desktopBannerImage
  return {
    mobileHeading: text(row.mobileHeading, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.mobileHeading, 70),
    searchPlaceholder: text(row.searchPlaceholder, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.searchPlaceholder, 90),
    desktopEyebrow: text(row.desktopEyebrow, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.desktopEyebrow, 70),
    desktopTitlePrefix: text(row.desktopTitlePrefix, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.desktopTitlePrefix, 50),
    desktopTitleAccent: text(row.desktopTitleAccent, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.desktopTitleAccent, 50),
    desktopDescription: text(row.desktopDescription, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.desktopDescription, 240),
    desktopBannerImage: banner,
    carouselSelectionConfigured: row.carouselSelectionConfigured === true,
  }
}

export async function getPublicOrderPageSettings(): Promise<PublicOrderPageSettings> {
  if (!supabase) return DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS
  const { data, error } = await supabase.rpc('fn_get_public_order_page_settings')
  if (error) throw error
  return normalizePublicOrderPageSettings(data)
}

export async function updatePublicOrderPageSettings(settings: PublicOrderPageSettings): Promise<void> {
  if (!supabase) throw new Error('No hay conexión con el catálogo público')
  const { error } = await supabase.rpc('fn_admin_update_public_order_page_settings', {
    p_mobile_heading: settings.mobileHeading.trim(),
    p_search_placeholder: settings.searchPlaceholder.trim(),
    p_desktop_eyebrow: settings.desktopEyebrow.trim(),
    p_desktop_title_prefix: settings.desktopTitlePrefix.trim(),
    p_desktop_title_accent: settings.desktopTitleAccent.trim(),
    p_desktop_description: settings.desktopDescription.trim(),
    p_desktop_banner_image: settings.desktopBannerImage,
  })
  if (error) throw error
  publishDataChange('public_order_page_settings')
}

export async function updatePublicOrderCarouselSelection(productIds: string[]): Promise<void> {
  if (!supabase) throw new Error('No hay conexión con el catálogo público')
  const { error } = await supabase.rpc('fn_admin_set_public_order_carousel', {
    p_product_ids: productIds,
  })
  if (error) throw error
  publishDataChange('public_order_page_settings')
}
