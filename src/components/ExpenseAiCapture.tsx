import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, FileImage, Loader2, Mic, Sparkles, Square, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './ExpenseAiCapture.css'

export interface ExtractedExpenseDraft {
  description: string | null
  amount: number | null
  currency: 'USD' | 'VES' | null
  reference: string | null
}

interface Props {
  onClose: () => void
  onDraft: (draft: ExtractedExpenseDraft) => void
}

export function ExpenseAiCapture({ onClose, onDraft }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<'audio' | 'image'>('image')
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const onCloseRef = useRef(onClose)
  const processingRef = useRef(processing)
  onCloseRef.current = onClose
  processingRef.current = processing

  useLayoutEffect(() => {
    const scrollContainers = [
      document.documentElement,
      document.body,
      document.querySelector<HTMLElement>('.app-main'),
      document.querySelector<HTMLElement>('.sidebar-container'),
    ].filter((element): element is HTMLElement => element instanceof HTMLElement)
    const previousStyles = scrollContainers.map((element) => ({
      element,
      overflow: element.style.overflow,
      overflowY: element.style.overflowY,
    }))
    const scrollPositions = scrollContainers.map((element) => ({ element, top: element.scrollTop, left: element.scrollLeft }))
    scrollContainers.forEach((element) => {
      element.style.overflow = 'hidden'
      element.style.overflowY = 'hidden'
    })
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !processingRef.current) onCloseRef.current() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      previousStyles.forEach(({ element, overflow, overflowY }) => {
        element.style.overflow = overflow
        element.style.overflowY = overflowY
      })
      scrollPositions.forEach(({ element, top, left }) => element.scrollTo({ top, left, behavior: 'instant' }))
      window.removeEventListener('keydown', onKeyDown)
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

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
        setFile(new File(chunks, `recibo-gasto.${extension}`, { type }))
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
      const { data, error: invokeError } = await supabase.functions.invoke('expense-ai-extract', { body })
      if (invokeError) throw invokeError
      if (!data?.draft || (data.draft.amount == null && !data.draft.description)) {
        throw new Error(data?.message || 'No se identificaron el concepto o el monto. Intenta con otra foto o audio.')
      }
      onDraft(data.draft as ExtractedExpenseDraft)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo analizar el recibo.') }
    finally { setProcessing(false) }
  }

  return createPortal(
    <div className="gst-ai-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !processing) onClose() }}>
      <div className="gst-ai-modal" role="dialog" aria-modal="true" aria-labelledby="expense-ai-title">
        <div className="gst-ai-header">
          <h3 id="expense-ai-title"><Sparkles size={18} /> Registrar gasto con IA</h3>
          <button type="button" className="gst-close" aria-label="Cerrar" onClick={onClose} disabled={processing}><X size={20} /></button>
        </div>
        <p className="gst-ai-intro">Sube o toma una foto del recibo de pago móvil, o graba un audio. Revisarás los datos antes de registrar el gasto.</p>
        {error && <div className="gst-ai-error" role="alert">{error}</div>}
        <div className="gst-ai-options">
          <button type="button" className="gst-ai-option" onClick={() => {
            if (recording) { recorderRef.current?.stop(); setRecording(false) }
            else void startRecording()
          }} disabled={processing}>
            {recording ? <Square size={21} /> : <Mic size={21} />}
            <strong>{recording ? 'Detener grabación' : 'Grabar audio'}</strong>
          </button>
          <button type="button" className="gst-ai-option" onClick={() => uploadRef.current?.click()} disabled={processing || recording}><FileImage size={21} /><strong>Subir foto</strong></button>
          <button type="button" className="gst-ai-option" onClick={() => cameraRef.current?.click()} disabled={processing || recording}><Camera size={21} /><strong>Tomar foto</strong></button>
        </div>
        <input ref={uploadRef} className="gst-ai-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} />
        <input ref={cameraRef} className="gst-ai-file" type="file" accept="image/*" capture="environment" onChange={(event) => chooseImage(event.target.files?.[0])} />
        {file && <div className="gst-ai-selected">Archivo listo: <strong>{file.name}</strong></div>}
        <div className="gst-ai-actions">
          <button type="button" className="gst-help" onClick={onClose} disabled={processing}>Cancelar</button>
          <button type="button" className="gst-btn" onClick={() => void process()} disabled={!file || processing || recording}>
            {processing ? <Loader2 size={16} className="gst-ai-spinner" /> : <Sparkles size={16} />}
            {processing ? 'Analizando...' : 'Procesar y revisar'}
          </button>
        </div>
      </div>
    </div>, document.body,
  )
}
