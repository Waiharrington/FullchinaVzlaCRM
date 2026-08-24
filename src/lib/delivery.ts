/**
 * Cálculo de delivery por distancia. Usa la fórmula de Haversine (distancia
 * geográfica en línea recta) multiplicada por un factor de ruta para aproximar
 * los kilómetros reales por calle, sin depender de APIs de pago.
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

/**
 * Estima el costo de delivery entre el origen y el destino del cliente.
 * Devuelve la distancia (ya ajustada por el factor de ruta), la zona aplicable
 * y el costo. Si no hay origen o el destino cae fuera de las zonas, fee = null.
 */
export function estimateDelivery(settings: DeliverySettings, destLat: number, destLng: number): DeliveryEstimate | null {
  if (settings.originLat == null || settings.originLng == null) return null
  const straight = haversineKm(settings.originLat, settings.originLng, destLat, destLng)
  const distanceKm = straight * (settings.roadFactor || 1)
  const zone = zoneForDistance(distanceKm, settings.zones)
  return { distanceKm, zone, fee: zone ? zone.price : null }
}
