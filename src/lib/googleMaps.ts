export type MapCoordinates = { lat: number; lng: number }

type GoogleLatLng = { lat: () => number; lng: () => number }
type GoogleMapClickEvent = { latLng: GoogleLatLng | null }
type GoogleMapListener = { remove: () => void }
type GoogleBounds = { north: number; south: number; east: number; west: number }
export type GoogleMapInstance = {
  addListener: (eventName: 'click', handler: (event: GoogleMapClickEvent) => void) => GoogleMapListener
  getZoom: () => number | null
  setCenter: (coordinates: MapCoordinates) => void
  setZoom: (zoom: number) => void
  fitBounds: (bounds: GoogleBounds, padding?: number) => void
}
export type GoogleMapMarker = {
  setMap: (map: GoogleMapInstance | null) => void
  setPosition: (coordinates: MapCoordinates) => void
  setIcon: (icon: GoogleMapIcon) => void
  setTitle: (title: string) => void
}
export type GoogleMapCircle = { setMap: (map: GoogleMapInstance | null) => void }
export type GoogleMapPolyline = { setMap: (map: GoogleMapInstance | null) => void }

type GoogleMapIcon = { url: string; scaledSize: unknown; anchor: unknown }
type GoogleMapsMapLibrary = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance
  Circle: new (options: Record<string, unknown>) => GoogleMapCircle
  Polyline: new (options: Record<string, unknown>) => GoogleMapPolyline
}
type GoogleMapsMarkerLibrary = {
  Marker: new (options: { map: GoogleMapInstance | null; position: MapCoordinates; title: string; icon: GoogleMapIcon }) => GoogleMapMarker
}
type GoogleMapsCoreLibrary = {
  ControlPosition: { RIGHT_BOTTOM: number }
  Size: new (width: number, height: number) => unknown
  Point: new (x: number, y: number) => unknown
}
type GoogleGeocoderRequest = {
  address?: string
  location?: MapCoordinates
  bounds?: { north: number; south: number; east: number; west: number }
  componentRestrictions?: { country: string }
  region?: string
  language?: string
}
type GoogleGeocoderResult = {
  formatted_address?: string
  geometry?: { location?: GoogleLatLng }
}
type GooglePlaceResult = {
  displayName?: string | { text?: string }
  formattedAddress?: string
  location?: GoogleLatLng
}
type GoogleMapsGeocodingLibrary = {
  Geocoder: new () => {
    geocode: (request: GoogleGeocoderRequest) => Promise<{ results?: GoogleGeocoderResult[] }>
  }
}
type GoogleMapsPlacesLibrary = {
  Place: {
    searchByText: (request: Record<string, unknown>) => Promise<{ places?: GooglePlaceResult[] }>
  }
}
type GoogleMapsGlobal = {
  importLibrary?: (name: 'maps' | 'marker' | 'geocoding' | 'core' | 'places') => Promise<unknown>
  Circle?: new (options: Record<string, unknown>) => GoogleMapCircle
  Polyline?: new (options: Record<string, unknown>) => GoogleMapPolyline
}

declare global {
  interface Window {
    google?: { maps?: GoogleMapsGlobal }
    gm_authFailure?: (...args: unknown[]) => void
    __fullChinaGoogleMapsAuthHandlerInstalled?: boolean
  }
}

const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
const readyCallback = '__fullChinaGoogleMapsReady'
export const googleMapsAuthFailureEvent = 'fullchina:google-maps-auth-failure'
const DEFAULT_SERVICE_CENTER: MapCoordinates = { lat: 10.2447, lng: -67.5958 }
let mapsApiPromise: Promise<GoogleMapsGlobal> | null = null
const scriptWindow = window as unknown as Record<string, unknown>

export function isGoogleMapsConfigured() {
  return Boolean(apiKey)
}

function installAuthFailureHandler() {
  if (window.__fullChinaGoogleMapsAuthHandlerInstalled) return
  window.__fullChinaGoogleMapsAuthHandlerInstalled = true
  const previousHandler = window.gm_authFailure
  window.gm_authFailure = (...args) => {
    window.dispatchEvent(new Event(googleMapsAuthFailureEvent))
    previousHandler?.(...args)
  }
}

function loadMapsApi(): Promise<GoogleMapsGlobal> {
  if (!apiKey) return Promise.reject(new Error('Google Maps todavía no está configurado.'))
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps)
  if (mapsApiPromise) return mapsApiPromise

  mapsApiPromise = new Promise((resolve, reject) => {
    installAuthFailureHandler()
    const script = document.createElement('script')
    const url = new URL('https://maps.googleapis.com/maps/api/js')
    url.search = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      language: 'es',
      region: 'VE',
      callback: readyCallback,
    }).toString()
    script.src = url.toString()
    script.async = true
    script.defer = true
    script.dataset.fullChinaGoogleMaps = 'true'
    script.onerror = () => {
      delete scriptWindow[readyCallback]
      script.remove()
      mapsApiPromise = null
      reject(new Error('No se pudo cargar Google Maps. Revisa tu conexión e inténtalo de nuevo.'))
    }
    scriptWindow[readyCallback] = () => {
      delete scriptWindow[readyCallback]
      const maps = window.google?.maps
      if (!maps?.importLibrary) {
        mapsApiPromise = null
        reject(new Error('Google Maps no terminó de inicializarse.'))
        return
      }
      resolve(maps)
    }
    document.head.append(script)
  })

  return mapsApiPromise
}

export function importGoogleMapsLibrary(name: 'maps'): Promise<GoogleMapsMapLibrary>
export function importGoogleMapsLibrary(name: 'marker'): Promise<GoogleMapsMarkerLibrary>
export function importGoogleMapsLibrary(name: 'geocoding'): Promise<GoogleMapsGeocodingLibrary>
export function importGoogleMapsLibrary(name: 'core'): Promise<GoogleMapsCoreLibrary>
export function importGoogleMapsLibrary(name: 'places'): Promise<GoogleMapsPlacesLibrary>
export async function importGoogleMapsLibrary(name: 'maps' | 'marker' | 'geocoding' | 'core' | 'places'): Promise<GoogleMapsMapLibrary | GoogleMapsMarkerLibrary | GoogleMapsGeocodingLibrary | GoogleMapsCoreLibrary | GoogleMapsPlacesLibrary> {
  const maps = await loadMapsApi()
  if (!maps.importLibrary) throw new Error('Google Maps no terminó de inicializarse.')
  return await maps.importLibrary(name) as GoogleMapsMapLibrary | GoogleMapsMarkerLibrary | GoogleMapsGeocodingLibrary | GoogleMapsCoreLibrary | GoogleMapsPlacesLibrary
}

function serviceBounds(origin?: MapCoordinates) {
  const center = origin || DEFAULT_SERVICE_CENTER
  return {
    north: center.lat + 0.25,
    south: center.lat - 0.25,
    east: center.lng + 0.25,
    west: center.lng - 0.25,
  }
}

export type GoogleAddressSuggestion = { display_name: string; lat: string; lon: string }
const addressSuggestionCache = new Map<string, GoogleAddressSuggestion[]>()

function normalizedSearchText(query: string) {
  return query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function isBusinessLikeQuery(query: string) {
  return !/\d/.test(query) && !/\b(calle|av(?:enida)?|carrera|transversal|callejon|sector|urbanizacion|urb\.?|km)\b/i.test(query)
}

export async function searchGoogleAddresses(query: string, origin?: MapCoordinates): Promise<GoogleAddressSuggestion[]> {
  const normalizedQuery = normalizedSearchText(query)
  const cacheKey = `${normalizedQuery}:${origin?.lat ?? ''}:${origin?.lng ?? ''}`
  const cached = addressSuggestionCache.get(cacheKey)
  if (cached) return cached
  const regionalQuery = /maracay|aragua|venezuela/.test(normalizedQuery)
    ? `${query}, Venezuela`
    : `${query}, Maracay, Aragua, Venezuela`

  if (isBusinessLikeQuery(query)) {
    try {
      const { Place } = await importGoogleMapsLibrary('places')
      const { places = [] } = await Place.searchByText({
        textQuery: regionalQuery,
        fields: ['displayName', 'formattedAddress', 'location'],
        locationRestriction: serviceBounds(origin),
        language: 'es',
        region: 've',
        maxResultCount: 5,
      })
      const placeResults = places.flatMap(place => {
        const location = place.location
        const name = typeof place.displayName === 'string' ? place.displayName : place.displayName?.text
        const label = String(place.formattedAddress || name || '').trim()
        if (!label || !location) return []
        return [{ display_name: label.slice(0, 280), lat: String(location.lat()), lon: String(location.lng()) }]
      }).slice(0, 5)
      if (placeResults.length) {
        addressSuggestionCache.set(cacheKey, placeResults)
        return placeResults
      }
    } catch { /* La búsqueda de direcciones sigue disponible con Geocoding. */ }
  }

  const { Geocoder } = await importGoogleMapsLibrary('geocoding')
  const geocoder = new Geocoder()
  const { results = [] } = await geocoder.geocode({
    address: regionalQuery,
    bounds: serviceBounds(origin),
    componentRestrictions: { country: 'VE' },
    region: 've',
    language: 'es',
  })
  const suggestions = results.flatMap(result => {
    const location = result.geometry?.location
    const label = String(result.formatted_address || '').trim()
    if (!label || !location) return []
    return [{ display_name: label.slice(0, 280), lat: String(location.lat()), lon: String(location.lng()) }]
  }).slice(0, 5)
  addressSuggestionCache.set(cacheKey, suggestions)
  return suggestions
}

export async function reverseGoogleAddress(coordinates: MapCoordinates): Promise<string> {
  const { Geocoder } = await importGoogleMapsLibrary('geocoding')
  const geocoder = new Geocoder()
  const { results = [] } = await geocoder.geocode({ location: coordinates, region: 've', language: 'es' })
  return String(results[0]?.formatted_address || '').slice(0, 280)
}
