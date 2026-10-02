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
  return (
    <div className="print-choice-overlay" role="presentation">
      <section className="print-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="print-choice-title">
        <button className="print-choice-close" type="button" onClick={onSkip} aria-label="Cerrar">
          <X size={18} />
        </button>
        <span className="print-choice-icon"><Printer size={22} /></span>
        <h2 id="print-choice-title">¿Imprimir {documentName}?</h2>
        <p>El pedido se guardó correctamente. Puedes imprimirlo ahora o hacerlo después desde la comanda.</p>
        <div className="print-choice-actions">
          <button className="print-choice-skip" type="button" onClick={onSkip}>No imprimir</button>
          <button className="print-choice-confirm" type="button" onClick={onPrint}><Printer size={16} /> Imprimir</button>
        </div>
      </section>
    </div>
  )
}
