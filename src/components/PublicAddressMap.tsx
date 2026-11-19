import { useEffect, useRef, useState } from 'react'
import {
  googleMapsAuthFailureEvent,
  importGoogleMapsLibrary,
  type GoogleMapInstance,
  type GoogleMapMarker,
  type MapCoordinates,
} from '../lib/googleMaps'

const DEFAULT_CENTER: MapCoordinates = { lat: 10.2447, lng: -67.5958 }
const FULL_CHINA_MAP_STYLES: Array<Record<string, unknown>> = [
  { elementType: 'geometry', stylers: [{ color: '#f4f1ea' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#625d55' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fffdf8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a71926' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e9ecdf' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f5ead9' }] },
  { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dfe8d7' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#fffdfa' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#746d63' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f3d9bd' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f2c35b' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e4a927' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#d9b967' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8dfe8' }] },
]
const pinSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 1C9.5 1 1 9.5 1 20c0 13.4 19 27 19 27s19-13.6 19-27C39 9.5 30.5 1 20 1Z" fill="#ed1b2f" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="6" fill="#ffd44f"/></svg>'
const pinIcon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg)}`

type Props = {
  coordinates: MapCoordinates | null
  origin?: MapCoordinates | null
  onPick: (coordinates: MapCoordinates) => void
}

export function PublicAddressMap({ coordinates, origin, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GoogleMapInstance | null>(null)
  const markerRef = useRef<GoogleMapMarker | null>(null)
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
    if (!containerRef.current || mapRef.current) return
    let live = true
    let clickListener: { remove: () => void } | null = null
    const handleAuthFailure = () => {
      if (live) setMapError('Google Maps no pudo validar la conexión. Actualiza la página o elige tu ubicación usando el GPS.')
    }
    window.addEventListener(googleMapsAuthFailureEvent, handleAuthFailure)

    const initializeMap = async () => {
      try {
        const [maps, core] = await Promise.all([
          importGoogleMapsLibrary('maps'),
          importGoogleMapsLibrary('core'),
        ])
        if (!live || !containerRef.current) return
        const selectedPoint = coordinatesRef.current
        const center = selectedPoint || originRef.current || DEFAULT_CENTER
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: selectedPoint ? 16 : originRef.current ? 14 : 13,
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
        const marker = new maps.Marker({
          map: selectedPoint ? map : null,
          position: selectedPoint || center,
          title: 'Ubicación de entrega seleccionada',
          icon: {
            url: pinIcon,
            scaledSize: new core.Size(40, 48),
            anchor: new core.Point(20, 46),
          },
        })
        clickListener = map.addListener('click', event => {
          if (!event.latLng) return
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() }
          marker.setPosition(point)
          marker.setMap(map)
          onPickRef.current(point)
        })
        mapRef.current = map
        markerRef.current = marker
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
      markerRef.current?.setMap(null)
      markerRef.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerRef.current) return
    if (coordinateLat != null && coordinateLng != null) {
      const point = { lat: coordinateLat, lng: coordinateLng }
      mapRef.current.setCenter(point)
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 13, 16))
      markerRef.current.setPosition(point)
      markerRef.current.setMap(mapRef.current)
      return
    }
    markerRef.current.setMap(null)
    if (originLat != null && originLng != null) {
      mapRef.current.setCenter({ lat: originLat, lng: originLng })
      mapRef.current.setZoom(14)
    }
  }, [mapReady, coordinateLat, coordinateLng, originLat, originLng])

  return (
    <div className="public-address-map">
      <div ref={containerRef} className="public-address-map-canvas" role="application" aria-label="Google Maps interactivo. Toca el mapa para elegir tu ubicación" />
      {mapError && <div className="public-address-map-error" role="status">{mapError}</div>}
      {!mapError && mapLoading && <div className="public-address-map-loading" role="status">Cargando Google Maps…</div>}
    </div>
  )
}
