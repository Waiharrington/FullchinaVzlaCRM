/**
 * Cálculo de delivery por distancia. Usa OSRM (gratis) para obtener la
 * distancia real por carretera, con fallback a Haversine × roadFactor si
 * la API no responde.
 */

export interface DeliveryZone {
  id: string
  minKm: number
  maxKm: number | null // null = sin límite superior ("más de X km")
  price: number
  sortOrder: number
}

export interface DeliverySettings {
  originLat: number | null
  originLng: number | null
  roadFactor: number
  enabled: boolean
  zones: DeliveryZone[]
}

export interface DeliveryEstimate {
  distanceKm: number
  zone: DeliveryZone | null
  fee: number | null // null = fuera de las zonas configuradas
}

const EARTH_RADIUS_KM = 6371

function toRad(deg: number) { return (deg * Math.PI) / 180 }

/** Distancia en línea recta (km) entre dos coordenadas. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Encuentra la zona que cubre una distancia dada (minKm <= d, y d <= maxKm o sin tope). */
export function zoneForDistance(distanceKm: number, zones: DeliveryZone[]): DeliveryZone | null {
  const sorted = [...zones].sort((a, b) => a.sortOrder - b.sortOrder || a.minKm - b.minKm)
  for (const zone of sorted) {
    const aboveMin = distanceKm >= zone.minKm
    const belowMax = zone.maxKm === null || distanceKm <= zone.maxKm
    if (aboveMin && belowMax) return zone
  }
  return null
}

/** Distancia real por carretera vía OSRM (gratis, sin API key). */
async function osrmRouteKm(aLat: number, aLng: number, bLat: number, bLng: number): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${aLng},${aLat};${bLng},${bLat}?overview=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as { code?: string; routes?: Array<{ distance?: number }> }
    if (data.code !== 'Ok' || !data.routes?.[0]?.distance) return null
    return data.routes[0].distance / 1000
  } catch {
    return null
  }
}

/**
 * Estima el costo de delivery (síncrono, Haversine × roadFactor).
 * Usado como fallback y en el probador del admin.
 */
export function estimateDelivery(settings: DeliverySettings, destLat: number, destLng: number): DeliveryEstimate | null {
  if (settings.originLat == null || settings.originLng == null) return null
  const straight = haversineKm(settings.originLat, settings.originLng, destLat, destLng)
  const distanceKm = straight * (settings.roadFactor || 1)
  const zone = zoneForDistance(distanceKm, settings.zones)
  return { distanceKm, zone, fee: zone ? zone.price : null }
}

/**
 * Estima el costo de delivery usando la distancia real por carretera (OSRM).
 * Si OSRM no responde, usa Haversine × roadFactor como fallback.
 */
export async function estimateDeliveryAsync(settings: DeliverySettings, destLat: number, destLng: number): Promise<DeliveryEstimate | null> {
  if (settings.originLat == null || settings.originLng == null) return null
  const routeKm = await osrmRouteKm(settings.originLat, settings.originLng, destLat, destLng)
  if (routeKm != null) {
    const zone = zoneForDistance(routeKm, settings.zones)
    return { distanceKm: routeKm, zone, fee: zone ? zone.price : null }
  }
  return estimateDelivery(settings, destLat, destLng)
}
