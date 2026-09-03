import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Plus, Pencil, Trash2, X, Users, Clock, UtensilsCrossed } from 'lucide-react'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { confirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../context/auth-context'
import {
  getFloorTables,
  createFloorTable,
  updateFloorTable,
  deleteFloorTable,
  type FloorTable,
} from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { PageSkeleton } from '../components/PageSkeleton'
import './Mesas.css'

const CANVAS_WIDTH = 100
const CANVAS_HEIGHT = 100

function elapsedLabel(createdAt: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

interface TableFormState {
  id: string | null
  number: string
  zone: string
  shape: 'square' | 'round'
  seats: string
}

const emptyForm = (zone: string): TableFormState => ({ id: null, number: '', zone, shape: 'square', seats: '4' })

export function Mesas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = user?.role === 'owner' || user?.role === 'manager'

  const [tables, setTables] = useState<FloorTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [activeZone, setActiveZone] = useState<string>('all')
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null)
  const [closingSelectedTable, setClosingSelectedTable] = useState(false)
  const [formState, setFormState] = useState<TableFormState | null>(null)
  const [closingFormState, setClosingFormState] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const closeSelectedTable = (then?: () => void) => {
    if (closingSelectedTable) return
    setClosingSelectedTable(true)
    window.setTimeout(() => {
      setSelectedTable(null)
      setClosingSelectedTable(false)
      then?.()
    }, 200)
  }

  const closeFormState = (then?: () => void) => {
    if (closingFormState) return
    setClosingFormState(true)
    window.setTimeout(() => {
      setFormState(null)
      setClosingFormState(false)
      then?.()
    }, 200)
  }

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ id: string; pointerId: number } | null>(null)

  const refresh = async () => {
    try {
      setTables(await getFloorTables())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las mesas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 20000)
    return () => clearInterval(interval)
  }, [])

  const zones = useMemo(() => {
    const set = new Set(tables.map(t => t.zone))
    return ['all', ...Array.from(set)]
  }, [tables])

  const visibleTables = useMemo(
    () => tables.filter(t => activeZone === 'all' || t.zone === activeZone),
    [tables, activeZone],
  )

  const occupiedCount = tables.filter(t => t.openOrderId).length

  // --- Drag para reposicionar (solo en modo edición) --------------------------
  const handlePointerDown = (table: FloorTable, e: React.PointerEvent) => {
    if (!editMode) return
    e.preventDefault()
    dragging.current = { id: table.id, pointerId: e.pointerId }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.min(94, Math.max(0, ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH))
    const y = Math.min(88, Math.max(0, ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT))
    setTables(prev => prev.map(t => (t.id === dragging.current?.id ? { ...t, posX: x, posY: y } : t)))
  }

  const handlePointerUp = async () => {
    if (!dragging.current) return
    const id = dragging.current.id
    dragging.current = null
    const table = tables.find(t => t.id === id)
    if (table) {
      try {
        await updateFloorTable(id, { posX: table.posX, posY: table.posY })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar la posición')
      }
    }
  }

  // --- Click en una mesa --------------------------------------------------
  const handleTableClick = (table: FloorTable) => {
    if (editMode) {
      setFormState({
        id: table.id,
        number: String(table.number),
        zone: table.zone,
        shape: table.shape,
        seats: String(table.seats),
      })
      setFormError('')
      return
    }
    if (table.openOrderId) {
      setSelectedTable(table)
      return
    }
    navigate('/caja', { state: { tableNumber: table.number } })
  }

  // --- Alta/edición de mesa ------------------------------------------------
  const openNewTableForm = () => {
    const nextNumber = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1
    setFormState({ ...emptyForm(activeZone === 'all' ? 'Salón' : activeZone), number: String(nextNumber) })
    setFormError('')
  }

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState) return
    const number = Number(formState.number)
    const seats = Number(formState.seats)
    if (!Number.isFinite(number) || number < 1 || number > 50) {
      setFormError('Número de mesa inválido (1-50)')
      return
    }
    if (!Number.isFinite(seats) || seats < 1) {
      setFormError('Cantidad de puestos inválida')
      return
    }
    if (!formState.zone.trim()) {
      setFormError('La zona es obligatoria')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (formState.id) {
        await updateFloorTable(formState.id, {
          number,
          zone: formState.zone.trim(),
          shape: formState.shape,
          seats,
        })
      } else {
        await createFloorTable({
          number,
          zone: formState.zone.trim(),
          shape: formState.shape,
          seats,
          posX: 10,
          posY: 10,
        })
      }
      closeFormState()
      await refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar la mesa')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTable = async (table: FloorTable) => {
    if (table.openOrderId) {
      setFormError('No puedes eliminar una mesa con un pedido abierto')
      return
    }
    const ok = await confirmDialog({ title: 'Eliminar mesa', message: `¿Eliminar la mesa ${table.number}?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    setSaving(true)
    try {
      await deleteFloorTable(table.id)
      closeFormState()
      await refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo eliminar la mesa')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton cards={0} rows={6} hasTable={false} />

  return (
    <div className="mesas-page">
      <header className="mesas-page-header">
        <div className="mesas-page-title-wrap">
          <div>
            <h1 className="page-title"><LayoutGrid size={22} className="page-title-icon" /> Mapa de mesas</h1>
            <p>{occupiedCount} de {tables.length} mesas ocupadas ahora mismo.</p>
          </div>
        </div>
        {canManage && (
          <div className="mesas-header-actions">
            {editMode && (
              <button className="mesas-btn mesas-btn-ghost" onClick={openNewTableForm}>
                <Plus size={16} /> Agregar mesa
              </button>
            )}
            <button
              className={`mesas-btn ${editMode ? 'mesas-btn-active' : 'mesas-btn-ghost'}`}
              onClick={() => setEditMode(v => !v)}
            >
              <Pencil size={16} /> {editMode ? 'Listo' : 'Editar mapa'}
            </button>
          </div>
        )}
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {zones.length > 2 && (
        <div className="mesas-zone-tabs">
          {zones.map(z => (
            <button
              key={z}
              className={`mesas-zone-tab ${activeZone === z ? 'active' : ''}`}
              onClick={() => setActiveZone(z)}
            >
              {z === 'all' ? 'Todas' : z}
            </button>
          ))}
        </div>
      )}

      {visibleTables.length === 0 ? (
        <div className="mesas-empty">
          Aún no hay mesas configuradas.
          {canManage && (
            <button className="mesas-btn mesas-btn-ghost" onClick={() => { setEditMode(true); openNewTableForm() }}>
              <Plus size={16} /> Crear la primera mesa
            </button>
          )}
        </div>
      ) : (
        <div
          ref={canvasRef}
          className={`mesas-canvas ${editMode ? 'edit-mode' : ''}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {visibleTables.map(table => {
            const isOccupied = Boolean(table.openOrderId)
            const isActive = Boolean(table.isActive)
            return (
              <button
                key={table.id}
                type="button"
                className={`mesas-tile ${table.shape} ${isOccupied ? 'occupied' : isActive ? 'free' : 'inactive'}`}
                style={{ left: `${table.posX}%`, top: `${table.posY}%` }}
                onPointerDown={(e) => handlePointerDown(table, e)}
                onClick={() => handleTableClick(table)}
                disabled={!isActive && !editMode}
                aria-disabled={!isActive && !editMode}
              >
                <span className="mesas-tile-number">{table.number}</span>
                <span className="mesas-tile-seats"><Users size={11} /> {table.seats}</span>
                {isOccupied && table.openOrderCreatedAt && (
                  <span className="mesas-tile-elapsed"><Clock size={10} /> {elapsedLabel(table.openOrderCreatedAt)}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="mesas-legend">
        <span><i className="dot free" /> Libre</span>
        <span><i className="dot occupied" /> Ocupada</span>
        {editMode && <span className="mesas-legend-hint">Arrastra una mesa para reubicarla · toca una mesa para editarla</span>}
      </div>

      {selectedTable && createPortal(
        <div className={`mesas-modal-overlay ${closingSelectedTable ? 'closing' : ''}`} onClick={() => closeSelectedTable()}>
          <div className="mesas-modal" onClick={e => e.stopPropagation()}>
            <button className="mesas-modal-close" onClick={() => closeSelectedTable()}><X size={18} /></button>
            <div className="mesas-modal-header">
              <div className="mesas-modal-icon"><UtensilsCrossed size={20} /></div>
              <h3>Mesa {selectedTable.number}</h3>
              <p className="mesas-modal-order">Pedido #FC-{String(selectedTable.openOrderNumber).padStart(6, '0')}</p>
            </div>
            <div className="mesas-modal-rows">
              <div><span>Cliente</span><span>{selectedTable.openOrderCustomer || 'Cliente general'}</span></div>
              <div><span>Tiempo abierto</span><span>{selectedTable.openOrderCreatedAt ? elapsedLabel(selectedTable.openOrderCreatedAt) : '—'}</span></div>
              <div className="mesas-modal-total-row"><span>Total</span><span className="mesas-modal-total-value">{formatUsd(selectedTable.openOrderTotal)}</span></div>
            </div>
            <button
              className="mesas-btn mesas-btn-primary mesas-modal-cta"
              onClick={() => closeSelectedTable(() => navigate('/comandas'))}
            >
              Ver en Comandas
            </button>
          </div>
        </div>,
        document.body
      )}

      {formState && createPortal(
        <div className={`mesas-modal-overlay ${closingFormState ? 'closing' : ''}`} onClick={() => closeFormState()}>
          <form className="mesas-modal" onClick={e => e.stopPropagation()} onSubmit={handleSaveForm}>
            <button type="button" className="mesas-modal-close" onClick={() => closeFormState()}><X size={18} /></button>
            <div className="mesas-modal-header">
              <h3>{formState.id ? `Editar mesa ${formState.number}` : 'Nueva mesa'}</h3>
            </div>

            <label className="mesas-form-field">
              <span>Número de mesa</span>
              <NumberStepper
                min={1}
                max={50}
                value={formState.number}
                onChange={v => setFormState(f => f && { ...f, number: v })}
                required
              />
            </label>

            <label className="mesas-form-field">
              <span>Zona / Ambiente</span>
              <input
                type="text"
                value={formState.zone}
                onChange={e => setFormState(f => f && { ...f, zone: e.target.value })}
                placeholder="Salón, Terraza…"
                required
              />
            </label>

            <label className="mesas-form-field">
              <span>Puestos</span>
              <NumberStepper
                min={1}
                value={formState.seats}
                onChange={v => setFormState(f => f && { ...f, seats: v })}
                required
              />
            </label>

            <div className="mesas-form-field">
              <span>Forma</span>
              <div className="mesas-shape-picker">
                <button
                  type="button"
                  className={formState.shape === 'square' ? 'active' : ''}
                  onClick={() => setFormState(f => f && { ...f, shape: 'square' })}
                >
                  Cuadrada
                </button>
                <button
                  type="button"
                  className={formState.shape === 'round' ? 'active' : ''}
                  onClick={() => setFormState(f => f && { ...f, shape: 'round' })}
                >
                  Redonda
                </button>
              </div>
            </div>

            {formError && <div className="mesas-form-error">{formError}</div>}

            <div className="mesas-form-actions">
              {formState.id && (
                <button
                  type="button"
                  className="mesas-btn mesas-btn-danger"
                  disabled={saving}
                  onClick={() => {
                    const table = tables.find(t => t.id === formState.id)
                    if (table) handleDeleteTable(table)
                  }}
                >
                  <Trash2 size={16} /> Eliminar
                </button>
              )}
              <button type="submit" className="mesas-btn mesas-btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  )
}
