import { useEffect, useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'
import './PrintChoiceDialog.css'

export function PrintChoiceDialog({
  documentName,
  onPrint,
  onSkip,
}: {
  documentName: string
  onPrint: () => void
  onSkip: () => void
}) {
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | null>(null)
  const finish = (action: () => void) => {
    if (closing) return
    setClosing(true)
    timer.current = window.setTimeout(action, 180)
  }
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])

  return (
    <div className={`print-choice-overlay${closing ? ' closing' : ''}`} role="presentation">
      <section className={`print-choice-dialog${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="print-choice-title">
        <button className="print-choice-close" type="button" onClick={() => finish(onSkip)} aria-label="Cerrar">
          <X size={18} />
        </button>
        <span className="print-choice-icon"><Printer size={22} /></span>
        <h2 id="print-choice-title">¿Imprimir {documentName}?</h2>
        <p>El pedido se guardó correctamente. Puedes imprimirlo ahora o hacerlo después desde la comanda.</p>
        <div className="print-choice-actions">
          <button className="print-choice-skip" type="button" onClick={() => finish(onSkip)}>No imprimir</button>
          <button className="print-choice-confirm" type="button" onClick={() => finish(onPrint)}><Printer size={16} /> Imprimir</button>
        </div>
      </section>
    </div>
  )
}
