import { Upload } from 'tus-js-client'
import { PUBLIC_ORDER_REEL_BUCKET, PUBLIC_ORDER_REEL_MAX_BYTES } from './publicOrderPageSettings'
import { supabase } from './supabase'

const CHUNK_SIZE = 6 * 1024 * 1024
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '')

export interface UploadedPublicReel {
  videoPath: string
  posterPath: string
  src: string
  poster: string
}

export async function uploadPublicOrderReel(
  slot: number,
  file: File,
  onProgress: (progress: number) => void,
): Promise<UploadedPublicReel> {
  if (!supabase) throw new Error('No hay conexión con el almacenamiento de videos')
  if (!Number.isInteger(slot) || slot < 1 || slot > 6) throw new Error('Ese espacio de video no es válido')
  if (!file.name.toLowerCase().endsWith('.mp4') || (file.type && file.type !== 'video/mp4')) {
    throw new Error('Elige un video MP4.')
  }
  if (file.size > PUBLIC_ORDER_REEL_MAX_BYTES) {
    throw new Error('El video supera el límite de 25 MB. Elige uno más liviano.')
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session?.access_token) throw new Error('Inicia sesión de nuevo para subir videos.')

  const posterBlob = await createVideoPoster(file)
  const objectId = crypto.randomUUID()
  const videoPath = `instagram/${slot}/${objectId}.mp4`
  const posterPath = `instagram/${slot}/${objectId}.jpg`

  try {
    await uploadResumable(file, videoPath, session.access_token, onProgress)
    const { error: posterError } = await supabase.storage
      .from(PUBLIC_ORDER_REEL_BUCKET)
      .upload(posterPath, posterBlob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
    if (posterError) throw posterError

    const src = supabase.storage.from(PUBLIC_ORDER_REEL_BUCKET).getPublicUrl(videoPath).data.publicUrl
    const poster = supabase.storage.from(PUBLIC_ORDER_REEL_BUCKET).getPublicUrl(posterPath).data.publicUrl
    onProgress(100)
    return { videoPath, posterPath, src, poster }
  } catch (error) {
    await supabase.storage.from(PUBLIC_ORDER_REEL_BUCKET).remove([videoPath, posterPath]).catch(() => undefined)
    throw error
  }
}

function uploadResumable(
  file: File,
  objectPath: string,
  accessToken: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const uploaderRef: { current: Upload | null } = { current: null }
    const uploader = new Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      // Each replacement gets a new object path. Resuming an old fingerprint
      // can point to an expired Supabase/TUS upload URL and fail on its HEAD.
      storeFingerprintForResuming: false,
      // Some self-hosted Storage proxies return an internal Location such as
      // http://localhost:8000. The browser cannot reach that address in prod;
      // keep the upload path but route retries through the configured Supabase
      // origin instead.
      onUploadUrlAvailable() {
        const activeUploader = uploaderRef.current
        if (!activeUploader?.url || !SUPABASE_URL) return
        try {
          const uploadUrl = new URL(activeUploader.url)
          const endpointUrl = new URL(SUPABASE_URL)
          if (['localhost', '127.0.0.1', '::1'].includes(uploadUrl.hostname)) {
            uploadUrl.protocol = endpointUrl.protocol
            uploadUrl.host = endpointUrl.host
            activeUploader.url = uploadUrl.toString()
          }
        } catch {
          // Let tus-js-client report malformed URLs through its normal error path.
        }
      },
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      metadata: {
        bucketName: PUBLIC_ORDER_REEL_BUCKET,
        objectName: objectPath,
        contentType: 'video/mp4',
        cacheControl: '3600',
      },
      onProgress(bytesSent, bytesTotal) {
        onProgress(Math.min(96, Math.round((bytesSent / bytesTotal) * 96)))
      },
      onError: reject,
      onSuccess: () => resolve(),
    })

    uploaderRef.current = uploader
    uploader.start()
  })
}

async function createVideoPoster(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = objectUrl

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('No se pudo leer el video para crear su vista previa.')), 15_000)
      video.onloadeddata = () => { window.clearTimeout(timeout); resolve() }
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error('El video MP4 no se pudo abrir.')) }
      video.load()
    })

    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen previa del video.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const poster = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!poster) throw new Error('No se pudo crear la imagen previa del video.')
    return poster
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

export async function removePublicOrderReelFiles(paths: string[]) {
  if (!supabase) return
  const allowedPaths = paths.filter(path => /^instagram\/[1-6]\/[0-9a-f-]{36}\.(mp4|jpg)$/i.test(path))
  if (allowedPaths.length === 0) return
  const { error } = await supabase.storage.from(PUBLIC_ORDER_REEL_BUCKET).remove(allowedPaths)
  if (error) throw error
}
