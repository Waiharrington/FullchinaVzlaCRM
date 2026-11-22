import { useRef, useEffect, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { estimateDelivery, getDeliveryRoute, type DeliveryEstimate, type DeliverySettings, type DeliveryRoute } from '../../lib/delivery'
import { getPublicDeliverySettings } from '../../lib/publicOrders'
import { reverseGoogleAddress, searchGoogleAddresses } from '../../lib/googleMaps'
import { MapCoordinates, type CheckoutStep } from '../../lib/publicMenuTypes'

interface UseDeliveryAddressArgs {
  address: string
  addressActionRef: RefObject<number>
  addressRef: RefObject<HTMLInputElement | null>
  deliveryEstimate: DeliveryEstimate | null
  deliveryQuoteStatus: "error" | "idle" | "loading" | "ready"
  deliveryRetryVersion: number
  deliverySettings: DeliverySettings | null
  deliverySettingsRetryVersion: number
  deliverySettingsStatus: "error" | "idle" | "loading" | "ready"
  geoCoords: { lat: number; lng: number; } | null
  locationError: string
  locationErrorRef: RefObject<HTMLDivElement | null>
  orderType: "takeaway" | "delivery"
  serverDeliveryFeeOverride: { lat: number; lng: number; fee: number; } | null
  setAddress: Dispatch<SetStateAction<string>>
  setAddressFieldError: Dispatch<SetStateAction<"" | "address" | "geo" | "reference">>
  setAddressMethod: Dispatch<SetStateAction<"map" | "gps" | "search" | null>>
  setAddressSuggestions: Dispatch<SetStateAction<{ display_name: string; lat: string; lon: string; }[]>>
  setDeliveryEstimate: Dispatch<SetStateAction<DeliveryEstimate | null>>
  setDeliveryQuoteStatus: Dispatch<SetStateAction<"error" | "idle" | "loading" | "ready">>
  setDeliveryRoute: Dispatch<SetStateAction<DeliveryRoute | null>>
  setDeliverySettings: Dispatch<SetStateAction<DeliverySettings | null>>
  setDeliverySettingsStatus: Dispatch<SetStateAction<"error" | "idle" | "loading" | "ready">>
  setError: Dispatch<SetStateAction<string>>
  setGeoCoords: Dispatch<SetStateAction<{ lat: number; lng: number; } | null>>
  setLocating: Dispatch<SetStateAction<boolean>>
  setLocationError: Dispatch<SetStateAction<string>>
  setOrderType: Dispatch<SetStateAction<"takeaway" | "delivery">>
  setSearchingAddress: Dispatch<SetStateAction<boolean>>
  setShowSuggestions: Dispatch<SetStateAction<boolean>>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
}

export function useDeliveryAddress({ address, addressActionRef, addressRef, deliveryEstimate, deliveryQuoteStatus, deliveryRetryVersion, deliverySettings, deliverySettingsRetryVersion, deliverySettingsStatus, geoCoords, locationError, locationErrorRef, orderType, serverDeliveryFeeOverride, setAddress, setAddressFieldError, setAddressMethod, setAddressSuggestions, setDeliveryEstimate, setDeliveryQuoteStatus, setDeliveryRoute, setDeliverySettings, setDeliverySettingsStatus, setError, setGeoCoords, setLocating, setLocationError, setOrderType, setSearchingAddress, setShowSuggestions, setStep }: UseDeliveryAddressArgs) {
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!locationError) return
    const timeout = window.setTimeout(() => {
      if (typeof locationErrorRef.current?.scrollIntoView === 'function') {
        locationErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [locationError, locationErrorRef])
  const deliveryDestinationLat = geoCoords?.lat
  const deliveryDestinationLng = geoCoords?.lng
  useEffect(() => {
    if (orderType !== 'delivery' || deliveryDestinationLat == null || deliveryDestinationLng == null || !deliverySettings) {
      setDeliveryEstimate(null)
      setDeliveryQuoteStatus('idle')
      setDeliveryRoute(null)
      return
    }
    const destination = { lat: deliveryDestinationLat, lng: deliveryDestinationLng }
    const origin = deliverySettings.originLat != null && deliverySettings.originLng != null
      ? { lat: deliverySettings.originLat, lng: deliverySettings.originLng }
      : null
    let active = true
    setDeliveryEstimate(null)
    setDeliveryQuoteStatus('loading')
    setDeliveryRoute(null)
    // La tarifa usa la misma regla que fn_create_web_order (distancia en línea
    // recta × factor de carretera) para que el total mostrado sea el que se
    // cobra. La ruta OSRM solo se dibuja en el mapa como referencia.
    const estimate = estimateDelivery(deliverySettings, destination.lat, destination.lng)
    setDeliveryEstimate(estimate)
    setDeliveryQuoteStatus(estimate ? 'ready' : 'error')
    if (origin) {
      void getDeliveryRoute(origin, destination)
        .then(route => {
          if (!active) return
          setDeliveryRoute(route)
        })
        .catch(() => { if (active) setDeliveryRoute(null) })
    }
    return () => { active = false }
  }, [orderType, deliveryDestinationLat, deliveryDestinationLng, deliverySettings, deliveryRetryVersion, setDeliveryEstimate, setDeliveryQuoteStatus, setDeliveryRoute])
  const deliveryCoverageUnavailable = orderType === 'delivery'
    && Boolean(geoCoords)
    && deliverySettingsStatus === 'ready'
    && deliveryQuoteStatus === 'ready'
    && (!deliverySettings?.enabled || deliveryEstimate?.fee == null)
  const readableAddress = address.replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3},\s*/i, '').trim() || (address ? 'Ubicación marcada en el mapa' : '')

  // Delivery solo se necesita cuando el cliente escoge esa modalidad. No
  // descargues zonas y coordenadas en cada visita al menú: en conexiones
  // móviles esa RPC competía con el catálogo aunque el cliente fuera a
  // retirar el pedido en el local.
  useEffect(() => {
    if (orderType !== 'delivery' || deliverySettings) return
    let active = true
    setDeliverySettingsStatus('loading')
    getPublicDeliverySettings()
      .then(settings => { if (active) { setDeliverySettings(settings); setDeliverySettingsStatus('ready') } })
      .catch(() => { if (active) { setDeliverySettings(null); setDeliverySettingsStatus('error') } })
    return () => { active = false }
  }, [orderType, deliverySettings, deliverySettingsRetryVersion, setDeliverySettings, setDeliverySettingsStatus])

  // El delivery se desactiva si la configuración pública lo tiene apagado.
  const deliveryDisabled = deliverySettingsStatus === 'ready' && deliverySettings?.enabled === false
  useEffect(() => {
    if (!deliveryDisabled || orderType !== 'delivery') return
    addressActionRef.current += 1
    setLocating(false)
    setOrderType('takeaway')
    setStep(current => current === 'address' ? 'delivery' : current)
  }, [deliveryDisabled, orderType, addressActionRef, setLocating, setOrderType, setStep])
  const deliveryFee = orderType === 'delivery' && deliveryEstimate?.fee != null
    ? serverDeliveryFeeOverride && serverDeliveryFeeOverride.lat === geoCoords?.lat && serverDeliveryFeeOverride.lng === geoCoords?.lng
      ? serverDeliveryFeeOverride.fee
      : deliveryEstimate.fee
    : 0
  const deliveryFeeText = orderType !== 'delivery'
    ? 'No aplica'
    : deliveryQuoteStatus === 'loading' || deliverySettingsStatus === 'loading'
      ? 'Calculando tarifa…'
      : deliveryQuoteStatus === 'error' || deliverySettingsStatus === 'error'
        ? 'No disponible'
        : deliveryCoverageUnavailable
          ? 'Fuera de cobertura'
          : deliveryEstimate && deliveryEstimate.fee != null
      ? `$${deliveryFee.toFixed(2)}${serverDeliveryFeeOverride && serverDeliveryFeeOverride.lat === geoCoords?.lat && serverDeliveryFeeOverride.lng === geoCoords?.lng ? ' (actualizado)' : ''}`
      : 'Por confirmar'

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Este navegador no permite obtener tu ubicación automáticamente. Puedes buscar tu dirección o elegir el punto en el mapa.')
      return
    }
    setError('')
    setLocationError('')
    const requestId = ++addressActionRef.current
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (addressActionRef.current !== requestId) return
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoCoords({ lat, lng })
        setAddressMethod('gps')
        setLocationError('')
        setAddressFieldError('')
        try {
          const formattedAddress = await reverseGoogleAddress({ lat, lng })
          if (addressActionRef.current !== requestId) return
          if (formattedAddress) {
            setAddress(formattedAddress.length > 120 ? `${formattedAddress.substring(0, 120)}…` : formattedAddress)
            setShowSuggestions(false)
          } else setAddress(`Ubicación seleccionada (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        } catch { if (addressActionRef.current === requestId) { setAddress(`Ubicación actual (${lat.toFixed(5)}, ${lng.toFixed(5)})`); setShowSuggestions(false) } }
        if (addressActionRef.current === requestId) setLocating(false)
      },
      (positionError) => {
        if (addressActionRef.current !== requestId) return
        setLocating(false)
        const message = positionError.code === positionError.PERMISSION_DENIED
          ? 'No diste permiso para compartir tu ubicación. Puedes buscar tu dirección o elegir el punto en el mapa.'
          : positionError.code === positionError.POSITION_UNAVAILABLE
            ? 'El dispositivo no pudo determinar tu ubicación. Puedes buscar tu dirección o elegir el punto en el mapa.'
            : 'La ubicación tardó demasiado en responder. Puedes buscar tu dirección o elegir el punto en el mapa.'
        setLocationError(message)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchAddress = (query: string) => {
    setError('')
    setLocationError('')
    const requestId = ++addressActionRef.current
    setLocating(false)
    setAddress(query)
    setShowSuggestions(true)
    setGeoCoords(null)
    setAddressMethod(null)
    setAddressFieldError(value => value === 'reference' ? value : '')
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current)
    if (query.trim().length < 4) { setAddressSuggestions([]); setSearchingAddress(false); return }
    addressSearchTimer.current = setTimeout(async () => {
      if (addressActionRef.current !== requestId) return
      setSearchingAddress(true)
      try {
        const origin = deliverySettings?.originLat != null && deliverySettings.originLng != null
          ? { lat: deliverySettings.originLat, lng: deliverySettings.originLng }
          : undefined
        const suggestions = await searchGoogleAddresses(query, origin)
        if (addressActionRef.current === requestId) setAddressSuggestions(suggestions)
      } catch (searchError) {
        if (addressActionRef.current === requestId) {
          setAddressSuggestions([])
          setLocationError(searchError instanceof Error ? searchError.message : 'No se pudo buscar la dirección en Google Maps.')
        }
      }
      finally { if (addressActionRef.current === requestId) setSearchingAddress(false) }
    }, 350)
  }

  const clearAddress = () => {
    searchAddress('')
    setShowSuggestions(false)
    setAddressSuggestions([])
    setAddressFieldError('')
    addressRef.current?.focus()
  }

  useEffect(() => () => { if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current) }, [])

  const selectSuggestion = (s: { display_name: string; lat: string; lon: string }) => {
    setError('')
    setLocationError('')
    addressActionRef.current += 1
    setLocating(false)
    setAddress(s.display_name.length > 120 ? s.display_name.substring(0, 120) + '…' : s.display_name)
    setGeoCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
    setAddressMethod('search')
    setAddressFieldError(value => value === 'reference' ? value : '')
    setShowSuggestions(false)
    setAddressSuggestions([])
  }

  const selectMapLocation = async (coordinates: MapCoordinates) => {
    setError('')
    setLocationError('')
    const requestId = ++addressActionRef.current
    setLocating(false)
    setGeoCoords(coordinates)
    setAddressMethod('map')
    setAddressFieldError(value => value === 'reference' ? value : '')
    setShowSuggestions(false)
    try {
      const formattedAddress = await reverseGoogleAddress(coordinates)
      if (addressActionRef.current !== requestId) return
      if (formattedAddress) setAddress(formattedAddress.length > 120 ? `${formattedAddress.substring(0, 120)}…` : formattedAddress)
    } catch {
      if (addressActionRef.current !== requestId) return
      setAddress(`Ubicación seleccionada (${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)})`)
    }
  }
  return { deliveryFee, deliveryCoverageUnavailable, deliveryFeeText, deliveryDisabled, requestCurrentLocation, clearAddress, readableAddress, searchAddress, selectMapLocation, selectSuggestion }
}
