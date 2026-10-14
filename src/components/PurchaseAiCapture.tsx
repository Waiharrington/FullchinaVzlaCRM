import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, FileImage, Loader2, Mic, Square, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export interface ExtractedPurchaseDraft {
  supplier: string | null
  date: string | null
  invoiceNumber: string | null
  currency: 'USD' | 'VES' | null
  total: number | null
  items: Array<{
    description: string
    quantity: number
    unit: string | null
    unitCost: number | null
    kind: 'purchase' | 'expense'
  }>
  missingFields: string[]
}

interface Props {
  onClose: () => void
  onDraft: (draft: ExtractedPurchaseDraft) => void
}

export function PurchaseAiCapture({ onClose, onDraft }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<'audio' | 'image'>('image')
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !processing) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [onClose, processing])

  const startRecording = async () => {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Este navegador no permite grabar audio.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        setFile(new File(chunks, `factura.${extension}`, { type }))
        setKind('audio')
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo activar el micrófono.') }
  }

  const chooseImage = (selected: File | undefined) => {
    if (!selected) return
    setFile(selected)
    setKind('image')
    setError('')
  }

  const process = async () => {
    if (!file || !supabase) return
    setProcessing(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('kind', kind)
      const { data, error: invokeError } = await supabase.functions.invoke('purchase-ai-extract', { body })
      if (invokeError) throw invokeError
      if (!data?.draft?.items?.length) throw new Error(data?.message || 'No se identificaron artículos. Intenta otra foto o audio.')
      onDraft(data.draft as ExtractedPurchaseDraft)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo analizar el archivo.') }
    finally { setProcessing(false) }
  }

  return createPortal(
    <div className="cmp-modal-overlay cmp-purchase-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !processing) onClose() }}>
      <div className="cmp-card cmp-purchase-modal cmp-ai-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-ai-title">
        <div className="cmp-purchase-header">
          <h3 id="purchase-ai-title" className="cmp-card-title"><Sparkles size={18} style={{ color: '#e11d2a' }} /> Nueva compra con IA</h3>
          <button type="button" className="cmp-icon-btn" aria-label="Cerrar" onClick={onClose} disabled={processing}><X size={20} /></button>
        </div>
        <p className="cmp-ai-intro">Graba los datos de la factura o envía una foto. Revisarás todos los campos antes de guardarla.</p>
        {error && <div className="cmp-form-error" role="alert">{error}</div>}
        <div className="cmp-ai-options">
          <button type="button" className="cmp-ai-option" onClick={() => {
            if (recording) { recorderRef.current?.stop(); setRecording(false) }
            else void startRecording()
          }} disabled={processing}>
            {recording ? <Square size={22} /> : <Mic size={22} />}
            <strong>{recording ? 'Detener grabación' : 'Grabar audio'}</strong>
          </button>
          <button type="button" className="cmp-ai-option" onClick={() => uploadRef.current?.click()} disabled={processing || recording}><FileImage size={22} /><strong>Subir foto</strong></button>
          <button type="button" className="cmp-ai-option" onClick={() => cameraRef.current?.click()} disabled={processing || recording}><Camera size={22} /><strong>Tomar foto</strong></button>
        </div>
        <input ref={uploadRef} className="cmp-ai-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} />
        <input ref={cameraRef} className="cmp-ai-file" type="file" accept="image/*" capture="environment" onChange={(event) => chooseImage(event.target.files?.[0])} />
        {file && <div className="cmp-ai-selected">Archivo listo: <strong>{file.name}</strong></div>}
        <div className="cmp-ai-actions">
          <button type="button" className="cmp-cancel" onClick={onClose} disabled={processing}>Cancelar</button>
          <button type="button" className="cmp-new-btn" onClick={() => void process()} disabled={!file || processing || recording}>
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {processing ? 'Analizando...' : 'Procesar y revisar'}
          </button>
        </div>
      </div>
    </div>, document.body
  )
}
