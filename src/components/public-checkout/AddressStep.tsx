import type { CheckoutStep } from '../../lib/publicMenuTypes'
import { lazy, Suspense, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { Search, X, MapPin, ChevronRight, Navigation } from 'lucide-react'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { money } from '../../lib/publicMenuFormat'
import { type WebOrderCartItem } from '../../lib/publicOrders'
import { type DeliveryEstimate, type DeliveryRoute, type DeliverySettings } from '../../lib/delivery'
import { type MapCoordinates } from '../../lib/publicMenuTypes'

const AddressMap = lazy(() => import('../PublicAddressMap').then(module => ({ default: module.PublicAddressMap })))

interface AddressStepProps {
  address: string
  addressFieldError: "" | "address" | "geo" | "reference"
  addressMethod: "gps" | "map" | "search" | null
  addressRef: RefObject<HTMLInputElement | null>
  addressReference: string
  addressSelectedRef: RefObject<HTMLDivElement | null>
  addressSuggestions: { display_name: string; lat: string; lon: string; }[]
  cart: WebOrderCartItem[]
  clearAddress: () => void
  continueFromAddress: () => void
  deliveryCoverageUnavailable: boolean
  deliveryEstimate: DeliveryEstimate | null
  deliveryFee: number
  deliveryNotes: string
  deliveryQuoteStatus: "idle" | "loading" | "ready" | "error"
  deliveryRoute: DeliveryRoute | null
  deliverySettings: DeliverySettings | null
  deliverySettingsStatus: "idle" | "loading" | "ready" | "error"
  geoCoords: { lat: number; lng: number; } | null
  locating: boolean
  locationError: string
  locationErrorRef: RefObject<HTMLDivElement | null>
  readableAddress: string
  referenceRef: RefObject<HTMLInputElement | null>
  requestCurrentLocation: () => void
  searchAddress: (query: string) => void
  searchingAddress: boolean
  selectMapLocation: (coordinates: MapCoordinates) => Promise<void>
  selectSuggestion: (s: { display_name: string; lat: string; lon: string; }) => void
  setAddressFieldError: Dispatch<SetStateAction<"" | "address" | "geo" | "reference">>
  setAddressReference: Dispatch<SetStateAction<string>>
  setDeliveryChosen: Dispatch<SetStateAction<boolean>>
  setDeliveryNotes: Dispatch<SetStateAction<string>>
  setDeliveryRetryVersion: Dispatch<SetStateAction<number>>
  setDeliverySettingsRetryVersion: Dispatch<SetStateAction<number>>
  setOrderType: Dispatch<SetStateAction<"takeaway" | "delivery">>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
  showSuggestions: boolean
}

export function AddressStep({ address, addressFieldError, addressMethod, addressRef, addressReference, addressSelectedRef, addressSuggestions, cart, clearAddress, continueFromAddress, deliveryCoverageUnavailable, deliveryEstimate, deliveryFee, deliveryNotes, deliveryQuoteStatus, deliveryRoute, deliverySettings, deliverySettingsStatus, geoCoords, locating, locationError, locationErrorRef, readableAddress, referenceRef, requestCurrentLocation, searchAddress, searchingAddress, selectMapLocation, selectSuggestion, setAddressFieldError, setAddressReference, setDeliveryChosen, setDeliveryNotes, setDeliveryRetryVersion, setDeliverySettingsRetryVersion, setOrderType, setStep, showSuggestions }: AddressStepProps) {
  return (
<div className="public-address-step"><div className="public-address-search"><Search /><input ref={addressRef} value={readableAddress} onChange={event => searchAddress(event.target.value)} placeholder="Busca tu dirección o urbanización" />{address.trim() && <button type="button" className="public-address-search-clear" aria-label="Borrar dirección y ubicación" onClick={clearAddress}><X size={18} /></button>}</div>{showSuggestions && address.trim().length >= 4 && <div className="public-address-suggestions public-address-step-suggestions">{searchingAddress ? <LoadingSkeleton label="Buscando direcciones" count={3} /> : addressSuggestions.length > 0 ? <><div className="public-suggestion-heading">Direcciones encontradas</div>{addressSuggestions.map((s, i) => { const parts = s.display_name.split(','); const primary = parts.shift() || s.display_name; return <button key={i} type="button" className="public-suggestion-item" onMouseDown={() => selectSuggestion(s)}><span className="public-suggestion-icon"><MapPin size={14} /></span><span className="public-suggestion-copy"><strong>{primary}</strong><small>{parts.join(',').trim() || 'Ubicación en el mapa'}</small></span><ChevronRight size={14} className="public-suggestion-arrow" /></button> })}</> : <div className="public-suggestion-status">Google no encontró ese lugar.<small>Prueba otra búsqueda o marca el punto exacto en el mapa.</small></div>}{addressSuggestions.length > 0 && <div className="public-address-google-attribution" translate="no"><img src="/GoogleMaps_Logo_DarkGray.svg" alt="Google Maps" /></div>}</div>}{locating && <div className="public-location-pending" role="status" aria-live="polite"><Navigation size={15} /> Buscando tu ubicación para centrar el mapa…</div>}<Suspense fallback={<div className="public-address-map public-address-map-brand"><div className="public-address-map-loading" role="status">Cargando mapa…</div></div>}><AddressMap coordinates={geoCoords} isGpsLocation={addressMethod === 'gps'} origin={deliverySettings?.originLat != null && deliverySettings.originLng != null ? { lat: deliverySettings.originLat, lng: deliverySettings.originLng } : null} route={deliveryRoute} onPick={selectMapLocation} /></Suspense>{addressMethod !== 'gps' && <button type="button" className="public-location-row public-map-location-action" onClick={requestCurrentLocation} disabled={locating} aria-label={locating ? 'Obteniendo ubicación' : geoCoords ? 'Volver a mi ubicación' : 'Usar mi ubicación actual'}><Navigation />{locating ? <LoadingSkeleton label="Obteniendo ubicación" variant="inline" /> : <strong>{geoCoords ? 'Volver a mi ubicación' : 'Usar mi ubicación actual'}</strong>}<ChevronRight /></button>}<div className={`public-address-selected${addressFieldError === 'address' || addressFieldError === 'geo' ? ' invalid' : ''}`} ref={addressSelectedRef}><MapPin /><div><small>Dirección seleccionada</small><strong>{readableAddress || 'Toca el mapa o busca una dirección'}</strong><span>{addressMethod === 'gps' ? 'Ubicación actual por GPS' : addressMethod === 'map' ? 'Punto elegido en el mapa' : addressMethod === 'search' ? 'Dirección encontrada' : 'Pendiente de confirmar'}</span>{addressFieldError === 'address' && <em className="public-field-error" role="alert">Escribe una dirección o toca un punto del mapa para seleccionarla.</em>}{addressFieldError === 'geo' && <em className="public-field-error" role="alert">Confirma la ubicación tocando el mapa o eligiendo una sugerencia.</em>}</div><button type="button" onClick={() => addressRef.current?.focus()}>Editar</button></div>{deliveryCoverageUnavailable && <div className="public-address-coverage-alert" role="alert"><div><strong>Esta dirección está fuera de la cobertura disponible.</strong><p>No podemos cotizar el delivery para este punto. Elige otra ubicación o cambia a retiro en el local.</p></div><div className="public-address-coverage-actions"><button type="button" onClick={() => addressRef.current?.focus()}>Cambiar ubicación</button><button type="button" onClick={() => { setOrderType('takeaway'); setDeliveryChosen(true); setStep('delivery') }}>Cambiar a retiro</button></div></div>}{locationError && (
      <div className="public-location-feedback" role="alert" ref={locationErrorRef}>
        <p>{locationError}</p>
        <div>
          <button type="button" onClick={() => { addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); addressRef.current?.focus() }}>Buscar dirección</button>
          <button type="button" onClick={() => document.querySelector<HTMLElement>('.public-address-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Elegir en el mapa</button>
        </div>
      </div>
    )}<label className={`public-address-extra${addressFieldError === 'reference' ? ' invalid' : ''}`}><span>Referencia para encontrarte</span><input ref={referenceRef} maxLength={120} value={addressReference} onChange={event => { setAddressReference(event.target.value); if (addressFieldError === 'reference') setAddressFieldError('') }} placeholder="Ej. casa azul, torre, local o esquina cercana" />{addressFieldError === 'reference' && <em className="public-field-error" role="alert">Agrega una referencia para que el repartidor encuentre el lugar fácilmente.</em>}</label><label className="public-address-extra"><span>Instrucciones para el repartidor <small>(opcional)</small></span><textarea value={deliveryNotes} maxLength={250} onChange={event => setDeliveryNotes(event.target.value)} placeholder="Ej. tocar timbre 04B o dejar con el conserje" /></label><div className={`public-address-summary${deliveryCoverageUnavailable ? ' is-unavailable' : ''}`}><div><small>Tarifa de delivery</small><strong>{deliverySettingsStatus === 'idle' || deliverySettingsStatus === 'loading' ? 'Consultando cobertura…' : deliverySettingsStatus === 'error' ? 'No disponible' : !geoCoords ? 'Elige un punto' : deliveryQuoteStatus === 'loading' ? 'Calculando tarifa…' : deliveryQuoteStatus === 'error' ? 'No pudimos calcularla' : deliveryCoverageUnavailable ? 'No disponible' : money(deliveryFee)}</strong></div>{deliveryEstimate && deliveryQuoteStatus === 'ready' ? <div className="public-address-distance"><strong>{`${deliveryEstimate.isApproximate ? "≈" : ""}${deliveryEstimate.distanceKm.toFixed(1)} km`}</strong><small>desde Full China · {deliveryEstimate.isApproximate ? "aprox." : "por carretera"}</small><em className={deliveryCoverageUnavailable ? 'is-outside' : ''}>{deliveryCoverageUnavailable ? 'Fuera del área de delivery' : 'Dentro del área de delivery'}</em></div> : !deliveryCoverageUnavailable && <span>{!geoCoords ? 'Selecciona una ubicación' : deliveryQuoteStatus === 'loading' ? 'Calculando tarifa…' : deliveryQuoteStatus === 'error' ? 'Reintenta o cambia a retiro' : 'Ubicación confirmada'}</span>}
    {deliveryQuoteStatus === 'error' && <button type="button" className="public-address-quote-retry" onClick={() => setDeliveryRetryVersion(version => version + 1)}>Reintentar cotización</button>}</div>
    
    {deliverySettingsStatus === 'error' && <div className="public-address-coverage-alert" role="alert"><div><strong>No pudimos consultar la cobertura.</strong><p>Inténtalo de nuevo o cambia a retiro en el local.</p></div><div className="public-address-coverage-actions"><button type="button" onClick={() => setDeliverySettingsRetryVersion(version => version + 1)}>Reintentar</button><button type="button" onClick={() => { setOrderType('takeaway'); setDeliveryChosen(true); setStep('delivery') }}>Cambiar a retiro</button></div></div>}
    {deliverySettingsStatus === 'ready' && deliveryQuoteStatus === 'ready' && !deliveryCoverageUnavailable && <button className="public-primary public-address-continue" disabled={!cart.length} onClick={continueFromAddress}>Continuar <ChevronRight /></button>}</div>
  )
}
