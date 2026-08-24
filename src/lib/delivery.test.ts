import { describe, expect, it } from 'vitest'
import { haversineKm, zoneForDistance, estimateDelivery, type DeliveryZone, type DeliverySettings } from './delivery'

const zones: DeliveryZone[] = [
  { id: 'a', minKm: 0, maxKm: 3, price: 2, sortOrder: 10 },
  { id: 'b', minKm: 3, maxKm: 6, price: 3, sortOrder: 20 },
  { id: 'c', minKm: 6, maxKm: 10, price: 5, sortOrder: 30 },
  { id: 'd', minKm: 10, maxKm: null, price: 8, sortOrder: 40 },
]

describe('cálculo de delivery por distancia', () => {
  it('haversine ~0 para el mismo punto', () => {
    expect(haversineKm(10.25, -67.59, 10.25, -67.59)).toBeCloseTo(0, 5)
  })

  it('haversine da la distancia esperada (~1.11 km por 0.01° de latitud)', () => {
    expect(haversineKm(10.25, -67.59, 10.26, -67.59)).toBeCloseTo(1.11, 1)
  })

  it('elige la zona correcta por rango', () => {
    expect(zoneForDistance(1, zones)?.id).toBe('a')
    expect(zoneForDistance(5, zones)?.id).toBe('b')
    expect(zoneForDistance(9, zones)?.id).toBe('c')
    expect(zoneForDistance(25, zones)?.id).toBe('d') // sin tope superior
  })

  it('estima el costo aplicando el factor de ruta', () => {
    const settings: DeliverySettings = { originLat: 10.2547567, originLng: -67.5926267, roadFactor: 1.3, enabled: true, zones }
    const near = estimateDelivery(settings, 10.2647567, -67.5926267) // ~1.11km recto -> ~1.44km ruta
    expect(near?.fee).toBe(2)
    expect(near?.distanceKm).toBeGreaterThan(1.11)
  })

  it('devuelve null si no hay origen configurado', () => {
    const settings: DeliverySettings = { originLat: null, originLng: null, roadFactor: 1.3, enabled: true, zones }
    expect(estimateDelivery(settings, 10.25, -67.59)).toBeNull()
  })
})
