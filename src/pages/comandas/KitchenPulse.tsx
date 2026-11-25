import { Clock, CheckCircle2, Package, Plus, ChefHat, ClipboardList, Timer, Flame, Maximize2, Minimize2 } from 'lucide-react'
import { formatElapsed } from '../comandas/model'
import type { Dispatch, SetStateAction } from 'react'

export interface KitchenPulseProps {
  kitchenPulse: { tone: string; label: string; message: string; }
  pendientesCount: number
  boardExpanded: boolean
  setBoardExpanded: Dispatch<SetStateAction<boolean>>
  isDemoMode: boolean
  setShowHistoryModal: Dispatch<SetStateAction<boolean>>
  setShowNewOrderModal: Dispatch<SetStateAction<boolean>>
  totalComandasCount: number
  nuevasCount: number
  preparandoCount: number
  listasCount: number
  avgMins: number
}

export function KitchenPulse({ kitchenPulse, pendientesCount, boardExpanded, setBoardExpanded, isDemoMode, setShowHistoryModal, setShowNewOrderModal, totalComandasCount, nuevasCount, preparandoCount, listasCount, avgMins }: KitchenPulseProps) {
  return (
    <section className={`comandas-pulse comandas-pulse--${kitchenPulse.tone}`} aria-labelledby="comandas-title">
        <div className="comandas-pulse-top">
          <div className="comandas-pulse-heading">
            <div className="comandas-pulse-title-row">
              <span className="comandas-pulse-icon" aria-hidden="true"><ClipboardList size={22} /></span>
              <div>
                <div className="comandas-title-line">
                  <h1 id="comandas-title">Comandas</h1>
                  {pendientesCount > 0 && (
                    <span className="comandas-pending-badge">
                      <Flame size={12} /> {pendientesCount} pendiente{pendientesCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p><strong>{kitchenPulse.label}.</strong> {kitchenPulse.message}</p>
              </div>
            </div>
          </div>

          <div className="comandas-actions-row">
            <button
              type="button"
              className="btn-nueva-comanda btn-historial cmd-board-focus-btn"
              aria-label={boardExpanded ? 'Salir del tablero ampliado' : 'Ampliar tablero'}
              aria-pressed={boardExpanded}
              title={boardExpanded ? 'Mostrar nuevamente el menú lateral' : 'Usar todo el ancho para el tablero'}
              onClick={() => setBoardExpanded(value => !value)}
            >
              {boardExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{boardExpanded ? 'Salir' : 'Ampliar'}</span>
            </button>
            <button className="btn-nueva-comanda btn-historial" disabled={isDemoMode} title={isDemoMode ? 'No disponible en la vista demo' : undefined} onClick={() => setShowHistoryModal(true)}>
              <Clock size={16} />
              <span>Historial</span>
            </button>
            <button className="btn-nueva-comanda" disabled={isDemoMode} title={isDemoMode ? 'No disponible en la vista demo' : undefined} onClick={() => setShowNewOrderModal(true)}>
              <Plus size={16} />
              <span>Nueva comanda</span>
            </button>
          </div>
        </div>

        <div className="comandas-flow" role="status" aria-label={`Resumen: ${totalComandasCount} total, ${nuevasCount} nuevas, ${preparandoCount} preparando, ${listasCount} listas, ${avgMins} minutos de promedio`}>
          <div className="comandas-flow-step comandas-flow-step--total comandas-flow-step--extra">
            <span><Package size={14} /> Total hoy</span><strong>{totalComandasCount}</strong>
          </div>
          <span className="comandas-flow-line comandas-flow-line--extra" aria-hidden="true" />
          <div className="comandas-flow-step comandas-flow-step--new">
            <span><Package size={14} /> Nuevas</span><strong>{nuevasCount}</strong>
          </div>
          <span className="comandas-flow-line" aria-hidden="true" />
          <div className="comandas-flow-step comandas-flow-step--preparing">
            <span><ChefHat size={14} /> Preparando</span><strong>{preparandoCount}</strong>
          </div>
          <span className="comandas-flow-line" aria-hidden="true" />
          <div className="comandas-flow-step comandas-flow-step--ready">
            <span><CheckCircle2 size={14} /> Listas</span><strong>{listasCount}</strong>
          </div>
          <span className="comandas-flow-line comandas-flow-line--extra" aria-hidden="true" />
          <div className="comandas-flow-step comandas-flow-step--time comandas-flow-step--extra">
            <span><Timer size={14} /> Prom.</span><strong>{avgMins > 0 ? formatElapsed(avgMins) : '—'}</strong>
          </div>
        </div>
      </section>
  )
}
