import { useEffect, useState, useCallback } from 'react'
import { Loader2, MapPin, Plus, Save, Trash2, CheckCircle2, AlertTriangle, Bike } from 'lucide-react'
import {
  getDeliverySettings, updateDeliveryConfig, createDeliveryZone, updateDeliveryZone, deleteDeliveryZone,
  type DeliveryConfigRow, type DeliveryZoneRow,
} from '../lib/dataService'
import { estimateDelivery } from '../lib/delivery'

/** Configuración administrable del delivery por distancia (origen + zonas). */
export function DeliverySettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [config, setConfig] = useState<DeliveryConfigRow>({ originLat: null, originLng: null, roadFactor: 1.3, enabled: true })
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [factor, setFactor] = useState('1.3')
  const [zones, setZones] = useState<DeliveryZoneRow[]>([])
  const [testCoords, setTestCoords] = useState('')

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3000) }

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { config: cfg, zones: zs } = await getDeliverySettings()
      setConfig(cfg)
      setLat(cfg.originLat == null ? '' : String(cfg.originLat))
      setLng(cfg.originLng == null ? '' : String(cfg.originLng))
      setFactor(String(cfg.roadFactor))
      setZones(zs)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error cargando la configuración de delivery') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const saveConfig = async () => {
    setSaving(true); setError('')
    try {
      await updateDeliveryConfig({
        originLat: lat.trim() ? parseFloat(lat) : null,
        originLng: lng.trim() ? parseFloat(lng) : null,
        roadFactor: parseFloat(factor) || 1.3,
        enabled: config.enabled,
      })
      flash('Ubicación y ajustes guardados'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setSaving(false) }
  }

  const toggleEnabled = async () => {
    const next = !config.enabled
    setConfig((c) => ({ ...c, enabled: next }))
    try { await updateDeliveryConfig({ enabled: next }) } catch { setConfig((c) => ({ ...c, enabled: !next })) }
  }

  const patchZone = (id: string, patch: Partial<DeliveryZoneRow>) =>
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)))

  const saveZone = async (zone: DeliveryZoneRow) => {
    setError('')
    try { await updateDeliveryZone(zone.id, { minKm: zone.minKm, maxKm: zone.maxKm, price: zone.price }); flash('Zona actualizada') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la zona') }
  }

  const addZone = async () => {
    setError('')
    const lastMax = zones.reduce((max, z) => (z.maxKm != null ? Math.max(max, z.maxKm) : max), 0)
    const sortOrder = (zones.reduce((max, z) => Math.max(max, z.sortOrder), 0)) + 10
    try { await createDeliveryZone({ minKm: lastMax, maxKm: null, price: 0, sortOrder }); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo agregar la zona') }
  }

  const removeZone = async (zone: DeliveryZoneRow) => {
    if (!window.confirm('¿Eliminar esta zona de delivery?')) return
    setError('')
    try { await deleteDeliveryZone(zone.id); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar la zona') }
  }

  // Probador: pega "lat, lng" y muestra distancia + tarifa estimada.
  const testEstimate = (() => {
    const parts = testCoords.split(',').map((s) => parseFloat(s.trim()))
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null
    return estimateDelivery(
      { originLat: lat.trim() ? parseFloat(lat) : null, originLng: lng.trim() ? parseFloat(lng) : null, roadFactor: parseFloat(factor) || 1.3, enabled: config.enabled, zones },
      parts[0], parts[1],
    )
  })()

  if (loading) return <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 className="animate-spin" style={{ color: '#e11d2a' }} /></div>

  return (
    <div className="card">
      <div className="card-header-row">
        <div>
          <h2 className="card-title"><Bike size={18} style={{ verticalAlign: -3, marginRight: 6 }} />Delivery por distancia</h2>
          <p className="card-subtitle">Se estima el costo en el menú de clientes según la distancia al local. En Caja el monto sigue siendo manual.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={config.enabled} onChange={toggleEnabled} />
          {config.enabled ? 'Activado' : 'Desactivado'}
        </label>
      </div>

      {error && <div className="whatsapp-notice-banner" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 12 }}><AlertTriangle size={16} /> {error}</div>}
      {notice && <div className="whatsapp-notice-banner" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 12 }}><CheckCircle2 size={16} /> {notice}</div>}

      <div className="ds-section">
        <h3 className="ds-h3"><MapPin size={15} style={{ verticalAlign: -2, marginRight: 5 }} />Ubicación de Full China (origen)</h3>
        <p className="ds-hint">En Google Maps, clic derecho sobre el local → copia los dos números (latitud, longitud).</p>
        <div className="ds-grid">
          <div className="ds-field"><label>Latitud</label><input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="10.2547567" /></div>
          <div className="ds-field"><label>Longitud</label><input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-67.5926267" /></div>
          <div className="ds-field"><label>Factor de ruta</label><input value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="1.3" /><span className="ds-sub">1.3 = ruta ~30% más larga que la línea recta.</span></div>
        </div>
        <button className="btn-accent btn-sm" onClick={saveConfig} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar ubicación</button>
      </div>

      <div className="ds-section">
        <h3 className="ds-h3">Zonas por distancia</h3>
        <p className="ds-hint">Rango en km y su precio. Deja "hasta" vacío en la última zona para "más de X km".</p>
        <div className="ds-zones">
          <div className="ds-zone-head"><span>Desde (km)</span><span>Hasta (km)</span><span>Precio ($)</span><span></span></div>
          {zones.map((z) => (
            <div className="ds-zone-row" key={z.id}>
              <input type="number" step="0.1" min="0" value={z.minKm} onChange={(e) => patchZone(z.id, { minKm: parseFloat(e.target.value) || 0 })} />
              <input type="number" step="0.1" min="0" value={z.maxKm ?? ''} placeholder="sin tope" onChange={(e) => patchZone(z.id, { maxKm: e.target.value.trim() ? parseFloat(e.target.value) : null })} />
              <input type="number" step="0.01" min="0" value={z.price} onChange={(e) => patchZone(z.id, { price: parseFloat(e.target.value) || 0 })} />
              <div className="ds-zone-actions">
                <button className="btn-ghost btn-sm" onClick={() => saveZone(z)} title="Guardar"><Save size={14} /></button>
                <button className="btn-ghost btn-sm" onClick={() => removeZone(z)} title="Eliminar" style={{ color: '#f87171' }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-ghost btn-sm" onClick={addZone} style={{ marginTop: 8 }}><Plus size={14} /> Agregar zona</button>
      </div>

      <div className="ds-section">
        <h3 className="ds-h3">Probar cálculo</h3>
        <p className="ds-hint">Pega unas coordenadas de cliente ("lat, lng") para ver la distancia y el costo estimado.</p>
        <input className="ds-test-input" value={testCoords} onChange={(e) => setTestCoords(e.target.value)} placeholder="10.28, -67.60" />
        {testEstimate && (
          <div className="ds-test-result">
            Distancia estimada: <strong>{testEstimate.distanceKm.toFixed(1)} km</strong> ·{' '}
            {testEstimate.fee != null ? <>Delivery: <strong>${testEstimate.fee.toFixed(2)}</strong></> : <strong style={{ color: '#f87171' }}>Fuera de las zonas configuradas</strong>}
          </div>
        )}
      </div>
    </div>
  )
}
