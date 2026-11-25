'use strict'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const nextSendDelay = (random = Math.random) => 8000 + Math.floor(random() * 6001)

const DISCONNECTED_STATES = [
  'closed', 'closing', 'timeout', 'stopped', 'unlaunched', 'unpaired',
  'unpaired_idle', 'pairing', 'opening', 'connecting', 'qr', 'conflict',
]

const STALE_SENDING_MESSAGE =
  'Envío interrumpido: el bot se reinició antes de confirmar el resultado (pudo haberse enviado). Revisa manualmente antes de reenviar.'

const ALLOWED_AFTER_HOURS_TYPES = new Set(['post_purchase', 'web_order_confirmation'])

function isQuietHours(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = Number(parts.find(part => part.type === 'hour')?.value)
  return hour >= 22 || hour < 8
}

function campaignWindowStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = type => parts.find(part => part.type === type)?.value
  return new Date(`${value('year')}-${value('month')}-${value('day')}T08:00:00-04:00`).toISOString()
}

function isAllowedAfterHours(message) {
  return ALLOWED_AFTER_HOURS_TYPES.has(String(message?.template_type || '').toLowerCase())
}

const normalizeChatId = phone => {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `58${digits}`
  return `${digits}@c.us`
}

const personalizeMessage = (template, fullName) => {
  const firstName = String(fullName || '').trim().split(/\s+/)[0] || 'cliente'
  return String(template || '').replace(/\[Nombre\]/g, firstName)
}

async function isClientReady(client) {
  const state = await Promise.resolve(client.getState()).catch(() => null)
  const socket = String(state || '').toLowerCase()
  return Boolean(client.info) && !DISCONNECTED_STATES.includes(socket)
}

// Ciclo de envío de la cola de campañas.
// Garantías:
//  - Reserva atómica vía RPC 'claim_next_whatsapp_message' (SKIP LOCKED):
//    dos procesos nunca reclaman la misma fila.
//  - La fila pasa a 'sending' ANTES de enviar; si el proceso muere, queda
//    'sending' y resolveStaleSending() la cierra como 'failed' sin reenviar.
//  - Justo antes de enviar se re-verifica el estado (ventana de "Detener").
//  - markSent se reintenta; si falla, el loop se detiene en lugar de
//    arriesgar un duplicado.
function createQueueProcessor({ db, client, log = console, sleepFn = sleep, delayFn = nextSendDelay, isEnabled = () => true, quietHours = isQuietHours, staleAfterMinutes = 5, markRetries = 3 }) {
  let running = false

  async function resolveStaleSending() {
    const cutoff = new Date(Date.now() - staleAfterMinutes * 60000).toISOString()
    const { data, error } = await db.from('whatsapp_messages')
      .update({ status: 'failed', error_message: STALE_SENDING_MESSAGE })
      .eq('status', 'sending')
      .lt('claimed_at', cutoff)
      .select('id')
    if (error) throw new Error(`No se pudieron resolver envíos interrumpidos: ${error.message}`)
    const resolved = data ? data.length : 0
    if (resolved > 0) {
      log.warn(`Se marcaron ${resolved} envío(s) interrumpido(s) como fallidos, sin reenviarlos.`)
    }
    return resolved
  }

  async function claimNext() {
    const { data, error } = await db.rpc('claim_next_whatsapp_message')
    if (error) throw new Error(`No se pudo reclamar el siguiente mensaje: ${error.message}`)
    if (Array.isArray(data)) return data[0] || null
    return data || null
  }

  async function getStatus(id) {
    const { data, error } = await db.from('whatsapp_messages').select('status').eq('id', id).maybeSingle()
    if (error) throw new Error(`No se pudo verificar el estado del mensaje: ${error.message}`)
    return data ? data.status : null
  }

  async function releaseClaim(id) {
    const { error } = await db.from('whatsapp_messages')
      .update({ status: 'queued', claimed_at: null })
      .eq('id', id)
      .eq('status', 'sending')
      .select('id')
    if (error) throw new Error(`No se pudo liberar el mensaje reclamado: ${error.message}`)
  }

  async function markFailed(id, reason) {
    const message = String(reason || 'Error desconocido').slice(0, 500)
    const { data, error } = await db.from('whatsapp_messages')
      .update({ status: 'failed', error_message: message })
      .eq('id', id)
      .eq('status', 'sending')
      .select('id')
    if (error) {
      log.error(`No se pudo marcar el mensaje como fallido: ${error.message}`)
      return false
    }
    return !data || data.length > 0
  }

  async function cancelCampaignQueue() {
    const { data, error } = await db.from('whatsapp_messages')
      .update({ status: 'cancelled', error_message: 'Campaña cancelada automáticamente fuera del horario permitido (10:00 p. m. a 8:00 a. m., hora de Caracas).' })
      .eq('status', 'queued')
      .not('template_type', 'in', '(post_purchase,web_order_confirmation)')
      .select('id')
    if (error) throw new Error(`No se pudieron cancelar las campañas fuera de horario: ${error.message}`)
    const cancelled = data ? data.length : 0
    if (cancelled > 0) log.warn(`Se cancelaron ${cancelled} campaña(s) pendiente(s) por horario.`)
    return cancelled
  }

  async function cancelOvernightCampaignQueue(date = new Date()) {
    const cutoff = campaignWindowStart(date)
    const { data, error } = await db.from('whatsapp_messages')
      .update({ status: 'cancelled', error_message: 'Campaña pendiente de la noche anterior cancelada automáticamente al reanudar el horario diurno (8:00 a. m., hora de Caracas).' })
      .eq('status', 'queued')
      .lt('created_at', cutoff)
      .not('template_type', 'in', '(post_purchase,web_order_confirmation)')
      .select('id')
    if (error) throw new Error(`No se pudieron cancelar campañas anteriores al horario diurno: ${error.message}`)
    const cancelled = data ? data.length : 0
    if (cancelled > 0) log.warn(`Se cancelaron ${cancelled} campaña(s) de la noche anterior.`)
    return cancelled
  }

  async function cancelClaimedCampaign(id) {
    const { error } = await db.from('whatsapp_messages')
      .update({ status: 'cancelled', error_message: 'Campaña cancelada automáticamente al llegar las 10:00 p. m. (hora de Caracas).' })
      .eq('id', id)
      .eq('status', 'sending')
    if (error) throw new Error(`No se pudo cancelar la campaña reclamada: ${error.message}`)
  }

  async function markSent(id) {
    const payload = { status: 'sent', sent_at: new Date().toISOString(), provider_id: 'whatsapp-web.js' }
    for (let attempt = 1; attempt <= markRetries; attempt += 1) {
      const { data, error } = await db.from('whatsapp_messages')
        .update(payload)
        .eq('id', id)
        .eq('status', 'sending')
        .select('id')
      if (!error && data && data.length > 0) return true
      if (error) log.error(`No se pudo confirmar el envío (intento ${attempt}/${markRetries}): ${error.message}`)
      else log.error(`El mensaje dejó de estar "sending" al confirmar (intento ${attempt}/${markRetries}).`)
      if (attempt < markRetries) await sleepFn(2000)
    }
    return false
  }

  // Pregunta a WhatsApp por el id real del número. Evita el error "No LID for
  // user" y detecta números sin WhatsApp. Si la consulta misma falla, se usa
  // el id calculado como antes.
  async function resolveChatId(phone) {
    const fallback = normalizeChatId(phone)
    if (typeof client.getNumberId !== 'function') return fallback
    try {
      const found = await client.getNumberId(fallback.replace('@c.us', ''))
      return found ? found._serialized : null
    } catch {
      return fallback
    }
  }

  // outcome: 'sent' | 'failed' | 'skipped' | 'not-ready' | 'unconfirmed'
  async function sendOne(next) {
    const current = await getStatus(next.id)
    if (current !== 'sending') {
      log.log(`El mensaje ${next.id} fue cancelado antes de enviar; se omite.`)
      return 'skipped'
    }
    if (quietHours() && !isAllowedAfterHours(next)) {
      await cancelClaimedCampaign(next.id)
      log.warn(`Se canceló la campaña ${next.id}; fuera de horario solo se permiten mensajes individuales de postcompra.`)
      return 'skipped'
    }
    if (!(await isClientReady(client))) {
      await releaseClaim(next.id)
      return 'not-ready'
    }
    const text = personalizeMessage(next.message, next.full_name)
    try {
      const chatId = await resolveChatId(next.phone)
      if (!chatId) {
        log.warn(`El número ${next.phone} no tiene WhatsApp; no se envía.`)
        await markFailed(next.id, 'Este número no tiene WhatsApp o está mal escrito.')
        return 'failed'
      }
      await client.sendMessage(chatId, text)
    } catch (sendError) {
      log.error(`No se pudo enviar a ${next.phone}: ${sendError.message || sendError}`)
      await markFailed(next.id, sendError.message || sendError)
      return 'failed'
    }
    if (!(await markSent(next.id))) {
      log.error('No se pudo confirmar el envío en la base de datos; se detiene el loop para evitar duplicados.')
      return 'unconfirmed'
    }
    log.log(`Mensaje enviado a ${next.phone}.`)
    return 'sent'
  }

  async function processQueue() {
    if (running) return 'busy'
    running = true
    try {
      await resolveStaleSending()
      while (isEnabled()) {
        if (quietHours()) await cancelCampaignQueue()
        else await cancelOvernightCampaignQueue()
        if (!(await isClientReady(client))) {
          log.log('WhatsApp no está listo para enviar; se reintenta en unos segundos.')
          break
        }
        const next = await claimNext()
        if (!next) break
        const outcome = await sendOne(next)
        if (outcome === 'unconfirmed' || outcome === 'not-ready') break
        if (outcome === 'sent' || outcome === 'failed') await sleepFn(delayFn())
      }
      return 'done'
    } catch (error) {
      log.error(`Error en el loop de envío: ${error.message}`)
      return 'error'
    } finally {
      running = false
    }
  }

  return { processQueue, resolveStaleSending, markSent, markFailed, releaseClaim }
}

module.exports = { sleep, nextSendDelay, normalizeChatId, personalizeMessage, isClientReady, isQuietHours, campaignWindowStart, isAllowedAfterHours, STALE_SENDING_MESSAGE, createQueueProcessor }
