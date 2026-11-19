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
  { elementType: 'geometry', stylers: [{ color: '#1b1b1c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#f4efe5' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#171718' }, { weight: 4 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#493032' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#ffd04b' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#292624' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#302a25' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d8c99e' }] },
  { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#26332b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#393637' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#e7ddd0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#514234' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#a52a32' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e4a927' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#806a38' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#202c32' }] },
]

type Props = {
  coordinates: MapCoordinates | null
  origin?: MapCoordinates | null
  zones?: DeliveryZone[]
  roadFactor?: number
  route?: DeliveryRoute | null
  onPick: (coordinates: MapCoordinates) => void
}

function markerSvg(isOrigin: boolean) {
  const fill = isOrigin ? '#e31b2b' : '#ffc83d'
  const center = isOrigin ? '#ffc83d' : '#111214'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52"><path d="M21 1C9.95 1 1 9.95 1 21c0 14 20 30 20 30s20-16 20-30C41 9.95 32.05 1 21 1Z" fill="${fill}" stroke="#fff" stroke-width="2"/><circle cx="21" cy="20" r="10" fill="${center}"/><text x="21" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="900" fill="#fff">FC</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function coverageRadii(zones: DeliveryZone[], roadFactor: number) {
  const factor = Math.max(1, roadFactor || 1.3)
  return [...new Set(zones
    .filter(zone => zone.maxKm != null && Number.isFinite(zone.maxKm) && zone.maxKm > 0)
    .map(zone => Math.round((zone.maxKm as number) / factor * 1000)))].sort((a, b) => a - b)
}

function mapBounds(origin: MapCoordinates, destination: MapCoordinates | null, maxRadiusMeters: number, roadFactor: number) {
  const radiusKm = maxRadiusMeters / 1000 / Math.max(1, roadFactor || 1.3)
  const latPadding = Math.max(0.004, radiusKm / 111 * 1.05)
  const lngPadding = Math.max(0.004, radiusKm / (111 * Math.cos(origin.lat * Math.PI / 180)) * 1.05)
  const points = [origin, ...(destination ? [destination] : [])]
  return {
    north: Math.max(...points.map(point => point.lat)) + latPadding,
    south: Math.min(...points.map(point => point.lat)) - latPadding,
    east: Math.max(...points.map(point => point.lng)) + lngPadding,
    west: Math.min(...points.map(point => point.lng)) - lngPadding,
  }
}

export function PublicAddressMap({ coordinates, origin, zones = [], roadFactor = 1.3, route, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<GoogleMapInstance | null>(null)
  const destinationMarkerRef = useRef<GoogleMapMarker | null>(null)
  const originMarkerRef = useRef<GoogleMapMarker | null>(null)
  const coverageCirclesRef = useRef<GoogleMapCircle[]>([])
  const routePolylineRef = useRef<GoogleMapPolyline | null>(null)
  const coordinatesRef = useRef(coordinates)
  const originRef = useRef(origin)
  const onPickRef = useRef(onPick)
  const [mapError, setMapError] = useState('')
  const [mapLoading, setMapLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const coordinateLat = coordinates?.lat
  const coordinateLng = coordinates?.lng
  const originLat = origin?.lat
  const originLng = origin?.lng
  coordinatesRef.current = coordinates
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
        const [maps, core] = await Promise.all([
          importGoogleMapsLibrary('maps'),
          importGoogleMapsLibrary('core'),
        ])
        if (!live || !containerRef.current) return
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
        const destinationMarker = new maps.Marker({
          map: selectedPoint ? map : null,
          position: selectedPoint || center,
          title: 'Ubicación de entrega seleccionada',
          icon: { url: markerSvg(false), scaledSize: new core.Size(42, 52), anchor: new core.Point(21, 50) },
        })
        const originMarker = new maps.Marker({
          map: store ? map : null,
          position: store || center,
          title: 'Origen: Full China',
          icon: { url: markerSvg(true), scaledSize: new core.Size(42, 52), anchor: new core.Point(21, 50) },
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
      googleMapRef.current = null
      destinationMarkerRef.current = null
      originMarkerRef.current = null
      coverageCirclesRef.current = []
      routePolylineRef.current = null
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
    routePolylineRef.current = null
    const PolylineConstructor = window.google?.maps?.Polyline
    if (route?.coordinates && route.coordinates.length > 1 && PolylineConstructor) {
      routePolylineRef.current = new PolylineConstructor({
        map,
        path: route.coordinates,
        geodesic: true,
        strokeColor: '#e31b2b',
        strokeOpacity: 0.96,
        strokeWeight: 5,
        clickable: false,
      })
    }

    if (store) {
      map.fitBounds(mapBounds(store, destination, radii.length ? radii[radii.length - 1] : 0, roadFactor), 28)
    } else if (destination) {
      map.setCenter(destination)
      map.setZoom(15)
    }
  }, [mapReady, coordinateLat, coordinateLng, originLat, originLng, zones, roadFactor, route])

  return (
    <div className="public-address-map public-address-map-brand">
      <div ref={containerRef} className="public-address-map-canvas" role="application" aria-label="Google Maps interactivo. Toca para elegir tu ubicación" />
      {mapError && <div className="public-address-map-error" role="status">{mapError}</div>}
      {!mapError && mapLoading && <div className="public-address-map-loading" role="status">Cargando Google Maps…</div>}
      <div className="public-address-map-legend"><span><i className="is-origin" /> Full China</span><span><i className="is-destination" /> Entrega</span><span><i className="is-coverage" /> Cobertura aprox.</span></div>
    </div>
  )
}
