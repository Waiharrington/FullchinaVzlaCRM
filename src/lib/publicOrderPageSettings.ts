import { publishDataChange, supabase } from './supabase'

const DEFAULT_CONTACT_WHATSAPP = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')

export interface PublicOrderPageSettings {
  mobileHeading: string
  searchPlaceholder: string
  desktopEyebrow: string
  desktopTitlePrefix: string
  desktopTitleAccent: string
  desktopDescription: string
  desktopBannerImage: string
  carouselSelectionConfigured: boolean
  contactPhone: string
  contactWhatsapp: string
  contactAddress: string
  contactDirectionsUrl: string
  contactInstagramUrl: string
  contactFacebookUrl: string
  contactDays: string
  contactOpenTime: string
  contactCloseTime: string
  contactReels: PublicOrderReel[]
}

export interface PublicOrderReel {
  src: string
  poster: string
  videoPath?: string
  posterPath?: string
}

export const PUBLIC_ORDER_REEL_BUCKET = 'fullchina-public-media'
export const PUBLIC_ORDER_REEL_MAX_BYTES = 25 * 1024 * 1024

/**
 * Builds an embeddable Google Maps URL from the same directions link customers
 * use. Google short links cannot be expanded in the browser because of CORS,
 * so the store's configured short link is mapped to its verified coordinates.
 */
export function getPublicOrderMapEmbedUrl(directionsUrl: string, address: string) {
  const shortLinkLocations: Record<string, string> = {
    sh8sdnhhdd6is87y8: '10.2547567,-67.5926267',
  }
  const shortCode = directionsUrl.match(/maps\.app\.goo\.gl\/([\w-]+)/i)?.[1]?.toLowerCase()
  let query = shortCode ? shortLinkLocations[shortCode] : undefined

  if (!query && directionsUrl) {
    try {
      const url = new URL(directionsUrl)
      const coordinates = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
      const queryCoordinates = `${url.searchParams.get('query') ?? ''} ${url.searchParams.get('q') ?? ''}`.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
      const placeId = url.searchParams.get('query_place_id')
        ?? url.searchParams.get('query_placeid')
        ?? url.searchParams.get('place_id')
        ?? url.href.match(/!1s([^!/?&]+)/)?.[1]
      if (coordinates) query = `${coordinates[1]},${coordinates[2]}`
      else if (queryCoordinates) query = `${queryCoordinates[1]},${queryCoordinates[2]}`
      else if (placeId) query = url.searchParams.get('query_place_id') || url.searchParams.get('place_id') || placeId
      else {
        const placeOrQuery = url.searchParams.get('q') ?? url.searchParams.get('query')
        if (placeOrQuery) query = placeOrQuery
      }
    } catch {
      // Keep the address fallback for a malformed or non-Google directions URL.
    }
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(query || address || 'Full China')}&output=embed`
}

export const DEFAULT_PUBLIC_ORDER_REELS: PublicOrderReel[] = [
  { src: '/videos/instagram/reel-1.mp4?v=20261024-new', poster: '/optimized/instagram/reel-1.webp?v=20261024-new' },
  { src: '/videos/instagram/reel-2.mp4?v=20260922-audio', poster: '/optimized/instagram/reel-2.webp' },
  { src: '/videos/instagram/reel-3.mp4?v=20260922-audio', poster: '/optimized/instagram/reel-3.webp' },
  { src: '/videos/instagram/reel-4.mp4?v=20261024-reel4', poster: '/optimized/instagram/reel-4.webp?v=20261024-reel4' },
  { src: '/videos/instagram/reel-5.mp4?v=20260922-audio', poster: '/optimized/instagram/reel-5.webp' },
  { src: '/videos/instagram/reel-6.mp4?v=20260922-audio', poster: '/optimized/instagram/reel-6.webp' },
]

export const DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS: PublicOrderPageSettings = {
  mobileHeading: '¿Qué provoca hoy?',
  searchPlaceholder: 'Busca Arroz, combos, pollo...',
  desktopEyebrow: 'AUTÉNTICO SABOR AL WOK',
  desktopTitlePrefix: 'HOY TOCA',
  desktopTitleAccent: 'FULL CHINA',
  desktopDescription: 'Sabor real, recién salido del wok. Arroces, tallarines y más, con tradición y porciones generosas.',
  desktopBannerImage: '/optimized/fondos/hero-banner-food.webp',
  carouselSelectionConfigured: false,
  contactPhone: '',
  contactWhatsapp: DEFAULT_CONTACT_WHATSAPP,
  contactAddress: 'Maracay · Estado Aragua',
  contactDirectionsUrl: 'https://maps.app.goo.gl/sh8SDNhhdD6is87y8',
  contactInstagramUrl: 'https://www.instagram.com/_u/fullchinavzla/',
  contactFacebookUrl: '',
  contactDays: 'Martes a Domingo',
  contactOpenTime: '11:30',
  contactCloseTime: '22:00',
  contactReels: DEFAULT_PUBLIC_ORDER_REELS,
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
  const rawBanner = typeof row.desktopBannerImage === 'string' ? row.desktopBannerImage : ''
  const isUploadedImage = /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+=*$/i.test(rawBanner) && rawBanner.length <= 1_500_000
  const banner = PUBLIC_ORDER_BANNER_OPTIONS.some(option => option.value === rawBanner) || isUploadedImage
    ? rawBanner
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
    contactPhone: typeof row.contactPhone === 'string' ? row.contactPhone.slice(0, 30) : DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactPhone,
    contactWhatsapp: typeof row.contactWhatsapp === 'string' && row.contactWhatsapp.trim() ? row.contactWhatsapp.slice(0, 30) : DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactWhatsapp,
    contactAddress: text(row.contactAddress, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactAddress, 180),
    contactDirectionsUrl: safeUrl(row.contactDirectionsUrl, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactDirectionsUrl),
    contactInstagramUrl: safeUrl(row.contactInstagramUrl, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactInstagramUrl),
    contactFacebookUrl: safeOptionalUrl(row.contactFacebookUrl),
    contactDays: text(row.contactDays, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactDays, 80),
    contactOpenTime: validTime(row.contactOpenTime, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactOpenTime),
    contactCloseTime: validTime(row.contactCloseTime, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS.contactCloseTime),
    contactReels: normalizePublicOrderReels(row.contactReels),
  }
}

function normalizePublicOrderReels(value: unknown): PublicOrderReel[] {
  if (!Array.isArray(value) || value.length !== DEFAULT_PUBLIC_ORDER_REELS.length) return DEFAULT_PUBLIC_ORDER_REELS
  return value.map((entry, index) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
    const videoPath = typeof item.videoPath === 'string' ? item.videoPath : ''
    const posterPath = typeof item.posterPath === 'string' ? item.posterPath : ''
    const pathPattern = new RegExp(`^instagram/${index + 1}/[0-9a-f-]{36}\\.(mp4|jpg)$`, 'i')
    if (pathPattern.test(videoPath) && videoPath.endsWith('.mp4') && pathPattern.test(posterPath) && posterPath.endsWith('.jpg') && supabase) {
      return {
        src: supabase.storage.from(PUBLIC_ORDER_REEL_BUCKET).getPublicUrl(videoPath).data.publicUrl,
        poster: supabase.storage.from(PUBLIC_ORDER_REEL_BUCKET).getPublicUrl(posterPath).data.publicUrl,
        videoPath,
        posterPath,
      }
    }
    const src = typeof item.src === 'string' ? item.src : ''
    const poster = typeof item.poster === 'string' ? item.poster : ''
    return DEFAULT_PUBLIC_ORDER_REELS.find(reel => reel.src === src && reel.poster === poster) ?? DEFAULT_PUBLIC_ORDER_REELS[index]
  })
}

function safeUrl(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  try { return /^https?:$/.test(new URL(value).protocol) ? value.slice(0, 400) : fallback }
  catch { return fallback }
}

function safeOptionalUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  return safeUrl(value.trim(), '')
}

function validTime(value: unknown, fallback: string) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback
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

export async function updatePublicOrderContactSettings(settings: PublicOrderPageSettings): Promise<void> {
  if (!supabase) throw new Error('No hay conexión con el catálogo público')
  const { error } = await supabase.rpc('fn_admin_update_public_order_contact', {
    p_contact_phone: settings.contactPhone.trim(),
    p_contact_whatsapp: settings.contactWhatsapp.trim(),
    p_contact_address: settings.contactAddress.trim(),
    p_contact_directions_url: settings.contactDirectionsUrl.trim(),
    p_contact_instagram_url: settings.contactInstagramUrl.trim(),
    p_contact_facebook_url: settings.contactFacebookUrl.trim(),
    p_contact_days: settings.contactDays.trim(),
    p_contact_open_time: settings.contactOpenTime,
    p_contact_close_time: settings.contactCloseTime,
  })
  if (error) throw error
  publishDataChange('public_order_page_settings')
}

export async function updatePublicOrderReels(reels: PublicOrderReel[]): Promise<void> {
  if (!supabase) throw new Error('No hay conexión con los videos de la tienda')
  const { error } = await supabase.rpc('fn_admin_update_public_order_reels', {
    p_reels: reels.map(reel => reel.videoPath && reel.posterPath
      ? { videoPath: reel.videoPath, posterPath: reel.posterPath }
      : { src: reel.src, poster: reel.poster }),
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
