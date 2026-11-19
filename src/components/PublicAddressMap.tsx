import { useEffect, useRef, useState } from 'react'
import {
  googleMapsAuthFailureEvent,
  importGoogleMapsLibrary,
  isGoogleMapsConfigured,
  type GoogleMapCircle,
  type GoogleMapInstance,
  type GoogleMapMarker,
  type GoogleMapPolyline,
  type MapCoordinates,
} from '../lib/googleMaps'
import type { DeliveryRoute, DeliveryZone } from '../lib/delivery'

const DEFAULT_CENTER: MapCoordinates = { lat: 10.2447, lng: -67.5958 }
const FULL_CHINA_MAP_STYLES: Array<Record<string, unknown>> = [
  { elementType: 'geometry', stylers: [{ color: '#f4f1eb' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#514b45' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fffdf9' }, { weight: 4 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e7c8c5' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a82b35' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e9eee4' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#fff8e8' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#766344' }] },
  { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e1ebdc' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#625a53' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fff0bd' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8a7a3' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d9981b' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#dfbd62' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d9e8ed' }] },
]

type Props = {
  coordinates: MapCoordinates | null
  isGpsLocation?: boolean
  origin?: MapCoordinates | null
  zones?: DeliveryZone[]
  roadFactor?: number
  route?: DeliveryRoute | null
  onPick: (coordinates: MapCoordinates) => void
}

type MarkerKind = 'store' | 'delivery' | 'current-location'

function markerSvg(kind: MarkerKind, logoDataUrl: string) {
  if (kind === 'current-location') {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="#4285f4" fill-opacity=".2"/><circle cx="15" cy="15" r="7" fill="#4285f4" stroke="#fff" stroke-width="3"/></svg>'
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  }
  const fill = kind === 'store' ? '#e31b2b' : '#ffc83d'
  const center = kind === 'store' ? '#101114' : '#e31b2b'
  const badge = kind === 'store' && logoDataUrl
    ? `<image href="${logoDataUrl}" x="14" y="20" width="28" height="13" preserveAspectRatio="xMidYMid meet"/>`
    : '<path d="M22 23h12M28 17v12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="66" viewBox="0 0 56 66"><path d="M28 2C14.2 2 3 13.2 3 27c0 17.1 25 37 25 37s25-19.9 25-37C53 13.2 41.8 2 28 2Z" fill="${fill}" stroke="#fff" stroke-width="2.5"/><circle cx="28" cy="26" r="17" fill="${center}" stroke="${kind === 'store' ? '#ffc83d' : '#fff'}" stroke-width="2"/>${badge}</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

async function loadBrandLogoDataUrl() {
  try {
    const response = await fetch('/optimized/root/logo.webp', { cache: 'force-cache' })
    if (!response.ok) return ''
    const logo = await response.blob()
    return await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => resolve('')
      reader.readAsDataURL(logo)
    })
  } catch {
    return ''
  }
}

function coverageRadii(zones: DeliveryZone[], roadFactor: number) {
  const factor = Math.max(1, roadFactor || 1.3)
  return [...new Set(zones
    .filter(zone => zone.maxKm != null && Number.isFinite(zone.maxKm) && zone.maxKm > 0)
    .map(zone => Math.round((zone.maxKm as number) / factor * 1000)))].sort((a, b) => a - b)
}

function routeBounds(origin: MapCoordinates, destination: MapCoordinates | null, route: DeliveryRoute | null) {
  const points = [origin, ...(destination ? [destination] : []), ...(route?.coordinates ?? [])]
  const latitudes = points.map(point => point.lat)
  const longitudes = points.map(point => point.lng)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const latPadding = Math.max(0.0025, (north - south) * 0.18)
  const lngPadding = Math.max(0.003, (east - west) * 0.18)
  return {
    north: north + latPadding,
    south: south - latPadding,
    east: east + lngPadding,
    west: west - lngPadding,
  }
}

export function PublicAddressMap({ coordinates, isGpsLocation = false, origin, zones = [], roadFactor = 1.3, route, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<GoogleMapInstance | null>(null)
  const destinationMarkerRef = useRef<GoogleMapMarker | null>(null)
  const originMarkerRef = useRef<GoogleMapMarker | null>(null)
  const coverageCirclesRef = useRef<GoogleMapCircle[]>([])
  const routePolylineRef = useRef<GoogleMapPolyline | null>(null)
  const routeHaloPolylineRef = useRef<GoogleMapPolyline | null>(null)
  const coordinatesRef = useRef(coordinates)
  const isGpsLocationRef = useRef(isGpsLocation)
  const originRef = useRef(origin)
  const markerSizingRef = useRef<{ size: unknown; dotSize: unknown; pinAnchor: unknown; dotAnchor: unknown } | null>(null)
  const brandLogoRef = useRef('')
  const onPickRef = useRef(onPick)
  const [mapError, setMapError] = useState('')
  const [mapLoading, setMapLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const coordinateLat = coordinates?.lat
  const coordinateLng = coordinates?.lng
  const originLat = origin?.lat
  const originLng = origin?.lng
  coordinatesRef.current = coordinates
  isGpsLocationRef.current = isGpsLocation
  originRef.current = origin
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current) return
    let live = true
    let clickListener: { remove: () => void } | null = null
    const handleAuthFailure = () => {
      if (live) setMapError('Google Maps no pudo validar la conexión. Revisa la API key de Maps o usa la búsqueda de dirección.')
    }
    window.addEventListener(googleMapsAuthFailureEvent, handleAuthFailure)

    const initializeMap = async () => {
      try {
        if (!isGoogleMapsConfigured()) throw new Error('Falta configurar VITE_GOOGLE_MAPS_API_KEY para mostrar Google Maps en esta versión local.')
        const [maps, core, markerLibrary] = await Promise.all([
          importGoogleMapsLibrary('maps'),
          importGoogleMapsLibrary('core'),
          importGoogleMapsLibrary('marker'),
        ])
        const brandLogo = await loadBrandLogoDataUrl()
        if (!live || !containerRef.current) return
        brandLogoRef.current = brandLogo
        markerSizingRef.current = {
          size: new core.Size(56, 66),
          dotSize: new core.Size(30, 30),
          pinAnchor: new core.Point(28, 64),
          dotAnchor: new core.Point(15, 15),
        }
        const selectedPoint = coordinatesRef.current
        const store = originRef.current
        const center = selectedPoint || store || DEFAULT_CENTER
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: selectedPoint ? 16 : store ? 14 : 13,
          styles: FULL_CHINA_MAP_STYLES,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          scrollwheel: false,
          gestureHandling: 'greedy',
          zoomControl: true,
          zoomControlOptions: { position: core.ControlPosition.RIGHT_BOTTOM },
        })
        const destinationMarker = new markerLibrary.Marker({
          map: selectedPoint ? map : null,
          position: selectedPoint || center,
          title: isGpsLocationRef.current ? 'Tu ubicación actual' : 'Ubicación de entrega seleccionada',
          icon: isGpsLocationRef.current
            ? { url: markerSvg('current-location', brandLogo), scaledSize: new core.Size(30, 30), anchor: new core.Point(15, 15) }
            : { url: markerSvg('delivery', brandLogo), scaledSize: new core.Size(56, 66), anchor: new core.Point(28, 64) },
        })
        const originMarker = new markerLibrary.Marker({
          map: store ? map : null,
          position: store || center,
          title: 'Origen: Full China',
          icon: { url: markerSvg('store', brandLogo), scaledSize: new core.Size(56, 66), anchor: new core.Point(28, 64) },
        })
        clickListener = map.addListener('click', event => {
          if (!event.latLng) return
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() }
          destinationMarker.setPosition(point)
          destinationMarker.setMap(map)
          onPickRef.current(point)
        })
        googleMapRef.current = map
        destinationMarkerRef.current = destinationMarker
        originMarkerRef.current = originMarker
        setMapLoading(false)
        setMapReady(true)
      } catch (error) {
        if (live) {
          setMapLoading(false)
          setMapError(error instanceof Error ? error.message : 'No se pudo cargar Google Maps.')
        }
      }
    }

    void initializeMap()
    return () => {
      live = false
      window.removeEventListener(googleMapsAuthFailureEvent, handleAuthFailure)
      clickListener?.remove()
      destinationMarkerRef.current?.setMap(null)
      originMarkerRef.current?.setMap(null)
      coverageCirclesRef.current.forEach(circle => circle.setMap(null))
      routePolylineRef.current?.setMap(null)
      routeHaloPolylineRef.current?.setMap(null)
      googleMapRef.current = null
      destinationMarkerRef.current = null
      originMarkerRef.current = null
      coverageCirclesRef.current = []
      routePolylineRef.current = null
      routeHaloPolylineRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = googleMapRef.current
    const destinationMarker = destinationMarkerRef.current
    const originMarker = originMarkerRef.current
    if (!mapReady || !map || !destinationMarker || !originMarker) return
    const store = originLat != null && originLng != null ? { lat: originLat, lng: originLng } : null
    const destination = coordinateLat != null && coordinateLng != null ? { lat: coordinateLat, lng: coordinateLng } : null
    const radii = coverageRadii(zones, roadFactor)

    if (destination) {
      destinationMarker.setPosition(destination)
      destinationMarker.setTitle(isGpsLocation ? 'Tu ubicación actual' : 'Ubicación de entrega seleccionada')
      const sizing = markerSizingRef.current
      if (sizing) {
        destinationMarker.setIcon({
          url: markerSvg(isGpsLocation ? 'current-location' : 'delivery', brandLogoRef.current),
          scaledSize: isGpsLocation ? sizing.dotSize : sizing.size,
          anchor: isGpsLocation ? sizing.dotAnchor : sizing.pinAnchor,
        })
      }
      destinationMarker.setMap(map)
    } else destinationMarker.setMap(null)
    if (store) {
      originMarker.setPosition(store)
      originMarker.setMap(map)
    } else originMarker.setMap(null)

    coverageCirclesRef.current.forEach(circle => circle.setMap(null))
    coverageCirclesRef.current = []
    const CircleConstructor = window.google?.maps?.Circle
    radii.forEach((radius, index) => {
      if (!store || !CircleConstructor) return
      coverageCirclesRef.current.push(new CircleConstructor({
        map,
        center: store,
        radius,
        strokeColor: index % 2 === 0 ? '#ffc83d' : '#e31b2b',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: index % 2 === 0 ? '#ffc83d' : '#e31b2b',
        fillOpacity: 0.035,
        clickable: false,
      }))
    })

    routePolylineRef.current?.setMap(null)
    routeHaloPolylineRef.current?.setMap(null)
    routePolylineRef.current = null
    routeHaloPolylineRef.current = null
    const PolylineConstructor = window.google?.maps?.Polyline
    if (route?.coordinates && route.coordinates.length > 1 && PolylineConstructor) {
      routeHaloPolylineRef.current = new PolylineConstructor({
        map,
        path: route.coordinates,
        geodesic: true,
        strokeColor: '#ffc83d',
        strokeOpacity: 0.94,
        strokeWeight: 9,
        clickable: false,
      })
      routePolylineRef.current = new PolylineConstructor({
        map,
        path: route.coordinates,
        geodesic: true,
        strokeColor: '#e31b2b',
        strokeOpacity: 0.98,
        strokeWeight: 4,
        clickable: false,
      })
    }

    if (store) {
      map.fitBounds(routeBounds(store, destination, route ?? null), 34)
    } else if (destination) {
      map.setCenter(destination)
      map.setZoom(15)
    }
  }, [mapReady, coordinateLat, coordinateLng, isGpsLocation, originLat, originLng, zones, roadFactor, route])

  return (
    <div className="public-address-map public-address-map-brand">
      <div ref={containerRef} className="public-address-map-canvas" role="application" aria-label="Google Maps interactivo. Toca para elegir tu ubicación" />
      {mapError && <div className="public-address-map-error" role="status">{mapError}</div>}
      {!mapError && mapLoading && <div className="public-address-map-loading" role="status">Cargando Google Maps…</div>}
      <div className="public-address-map-legend"><span><i className="is-origin" /> Full China</span><span><i className={isGpsLocation ? 'is-current-location' : 'is-destination'} /> {isGpsLocation ? 'Tu ubicación' : 'Entrega'}</span><span><i className="is-coverage" /> Cobertura aprox.</span></div>
    </div>
  )
}
