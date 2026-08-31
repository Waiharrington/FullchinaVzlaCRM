import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type MapCoordinates = { lat: number; lng: number }

export function PublicAddressMap({ coordinates, onPick }: { coordinates: MapCoordinates | null; onPick: (coordinates: MapCoordinates) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const initialCoordinatesRef = useRef(coordinates)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const defaultCenter: L.LatLngExpression = [10.2447, -67.5958]
    const initialCoordinates = initialCoordinatesRef.current
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(initialCoordinates ? [initialCoordinates.lat, initialCoordinates.lng] : defaultCenter, initialCoordinates ? 16 : 13)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map)
    map.on('click', event => onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng }))
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 0)
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !coordinates) return
    const point: L.LatLngExpression = [coordinates.lat, coordinates.lng]
    mapRef.current.setView(point, Math.max(mapRef.current.getZoom(), 16), { animate: true })
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { title: 'Ubicación seleccionada', icon: L.divIcon({ className: 'public-leaflet-pin', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 38] }) }).addTo(mapRef.current)
    } else markerRef.current.setLatLng(point)
  }, [coordinates])

  return <div ref={containerRef} className="public-address-map" aria-label="Mapa interactivo. Toca para elegir tu ubicación" />
}
