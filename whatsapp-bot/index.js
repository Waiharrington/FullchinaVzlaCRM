require('dotenv').config()

const http = require('node:http')
const crypto = require('node:crypto')
const QRCode = require('qrcode')
const qrcodeTerminal = require('qrcode-terminal')
const { Client, LocalAuth } = require('whatsapp-web.js')
const { createClient } = require('@supabase/supabase-js')
const { createQueueProcessor } = require('./queue')

const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable ${name}`)
  return value
}

const qrPort = Number(process.env.WHATSAPP_QR_PORT || 3033)
const qrHost = process.env.WHATSAPP_QR_HOST || '127.0.0.1'
const qrToken = process.env.WHATSAPP_QR_ACCESS_TOKEN || ''
const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { db: { schema: 'fullchinavzla' } })
let latestQr = null

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'fullchina', dataPath: process.env.WHATSAPP_SESSION_PATH || './.wwebjs_auth' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote'] },
})

client.on('qr', qr => {
  qrcodeTerminal.generate(qr, { small: true })
  QRCode.toDataURL(qr).then(data => { latestQr = data }).catch(error => console.error('QR:', error.message))
  console.log('Escanea el QR desde el WhatsApp de Full China.')
})
client.on('authenticated', () => { latestQr = null; console.log('WhatsApp Full China autenticado.') })
client.on('ready', () => { console.log('Bot de WhatsApp Full China listo para conversaciones individuales.'); processQueue() })
async function queueAutomations() {
  const { data, error } = await supabase.rpc('fn_queue_whatsapp_automations')
  if (error) console.error('No se pudieron preparar automatizaciones:', error.message)
  else if (data?.total) console.log(`Automatizaciones preparadas: ${data.total}`)
}
if (process.env.WHATSAPP_QUEUE_AUTOMATIONS === 'true') {
  setInterval(queueAutomations, 5 * 60 * 1000)
  queueAutomations()
} else {
  console.log('Generación automática de mensajes en pausa hasta habilitar el envío de campañas.')
}

// La cola está APAGADA por defecto: hay que pedirlo explícitamente con
// WHATSAPP_SEND_QUEUE=true. Así un reinicio del bot nunca arranca un envío
// masivo por accidente (p. ej. con mensajes viejos pendientes).
const sendQueueEnabled = process.env.WHATSAPP_SEND_QUEUE === 'true'

const processor = createQueueProcessor({
  db: supabase,
  client,
  log: console,
  isEnabled: () => sendQueueEnabled,
})
const processQueue = () => processor.processQueue()

async function logQueueDepth() {
  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')
  if (error) { console.error(`No se pudo leer la cola: ${error.message}`); return }
  if (!count) { console.log('Cola de campañas vacía.'); return }
  if (sendQueueEnabled) console.log(`${count} mensaje(s) en cola; el bot los enviará uno a uno.`)
  else console.warn(`${count} mensaje(s) en cola, pero el envío está deshabilitado (WHATSAPP_SEND_QUEUE=true para activarlo).`)
}
if (sendQueueEnabled) {
  setInterval(processQueue, 15000)
  logQueueDepth().catch(() => {})
  console.log('Envío de la cola de campañas activo: un mensaje cada 8-14 segundos.')
} else {
  console.log('Envío de la cola de campañas deshabilitado (WHATSAPP_SEND_QUEUE=true para activarlo).')
}
// El bot SOLO envía campañas: no responde mensajes entrantes ni registra
// conversaciones, salvo que se active explícitamente con WHATSAPP_AUTO_REPLY=true.
const autoReplyEnabled = process.env.WHATSAPP_AUTO_REPLY === 'true'
if (autoReplyEnabled) console.log('Respuestas automáticas ACTIVADAS (WHATSAPP_AUTO_REPLY=true).')
else console.log('El bot no responde mensajes entrantes: solo envía campañas (WHATSAPP_AUTO_REPLY=true para activar respuestas).')
if (autoReplyEnabled) client.on('message', async message => {
  if (message.fromMe || message.from.endsWith('@g.us')) return
  const text = String(message.body || '').trim().toLowerCase()
  if (!text) return
  try {
    const phone = String(message.from || '').replace('@c.us', '')
    const { data: customers } = await supabase.from('customers').select('id,full_name,phone').ilike('phone', `%${phone.slice(-10)}%`).limit(1)
    const customerId = customers?.[0]?.id || null
    const { data: conversations } = await supabase.from('ai_agent_conversations').upsert({ source: 'whatsapp', source_chat_id: message.from, source_user_id: customerId }, { onConflict: 'source,source_chat_id' }).select('id').limit(1)
    if (conversations?.[0]?.id) await supabase.from('ai_agent_messages').insert({ conversation_id: conversations[0].id, role: 'user', content: message.body, metadata: { whatsapp_message_id: message.id.id, customer_id: customerId } })
    if (/^(hola|buenas|buenos días|buenas tardes|buenas noches)/.test(text)) {
      const reply = '¡Hola! Somos Full China 🍜 ¿En qué podemos ayudarte? Puedes preguntar por el menú, promociones u horarios.'
      await message.reply(reply)
      if (conversations?.[0]?.id) await supabase.from('ai_agent_messages').insert({ conversation_id: conversations[0].id, role: 'assistant', content: reply, metadata: { channel: 'whatsapp' } })
      return
    }
    if (text.includes('menú') || text.includes('menu')) {
      const { data } = await supabase.from('menu_items').select('name,price,emoji').eq('is_active', true).order('name').limit(20)
      const lines = (data || []).map(item => `${item.emoji || '🍽️'} ${item.name}: $${Number(item.price).toFixed(2)}`)
      const reply = lines.length ? `Menú disponible:\n${lines.join('\n')}` : 'En este momento estamos actualizando el menú. Escríbenos y te atendemos.'
      await message.reply(reply)
      if (conversations?.[0]?.id) await supabase.from('ai_agent_messages').insert({ conversation_id: conversations[0].id, role: 'assistant', content: reply, metadata: { channel: 'whatsapp' } })
      return
    }
    if (text.includes('promoc')) {
      const { data } = await supabase.from('promotions').select('name,description,discount_type,discount_value').eq('is_active', true).limit(10)
      const lines = (data || []).map(item => `• ${item.name}: ${item.description || 'Promoción activa'}`)
      const reply = lines.length ? `Promociones activas:\n${lines.join('\n')}` : 'En este momento no tenemos promociones activas.'
      await message.reply(reply)
      if (conversations?.[0]?.id) await supabase.from('ai_agent_messages').insert({ conversation_id: conversations[0].id, role: 'assistant', content: reply, metadata: { channel: 'whatsapp' } })
    }
  } catch (error) { console.error('Error atendiendo mensaje:', error.message) }
})
client.on('auth_failure', error => console.error('Falló la autenticación:', error.message))
client.on('disconnected', reason => console.warn('WhatsApp desconectado:', reason))

// --- Servidor QR endurecido --------------------------------------------------
// - Token largo y aleatorio obligatorio (>= 32 chars): sin él, el servidor ni
//   arranca (el bot sigue funcionando para enviar).
// - Bind por defecto en 127.0.0.1: fuera del VPS solo vía túnel SSH
//   (ssh -L 3033:127.0.0.1:3033 root@<vps>). Para exponerlo, usa un proxy con
//   HTTPS y WHATSAPP_QR_HOST explícito.
// - Comparación en tiempo constante + rate limit por IP de intentos fallidos.
const tokenLooksStrong = token => token.length >= 32 && !/^(change-me|changeme|secret|token|password|fullchina)/i.test(token)

const tokenMatches = provided => {
  const given = crypto.createHash('sha256').update(String(provided || '')).digest()
  const expected = crypto.createHash('sha256').update(qrToken).digest()
  return crypto.timingSafeEqual(given, expected)
}

const FAIL_WINDOW_MS = 10 * 60 * 1000
const MAX_FAILURES = 20
const failures = new Map()
const isRateLimited = ip => {
  const now = Date.now()
  const recent = (failures.get(ip) || []).filter(at => now - at < FAIL_WINDOW_MS)
  failures.set(ip, recent)
  return recent.length >= MAX_FAILURES
}
const recordFailure = ip => {
  const recent = failures.get(ip) || []
  recent.push(Date.now())
  failures.set(ip, recent)
}

if (!tokenLooksStrong(qrToken)) {
  console.warn('WHATSAPP_QR_ACCESS_TOKEN no es seguro (se exigen >= 32 caracteres aleatorios). El servidor QR queda DESHABILITADO; el resto del bot sigue operativo. Genera uno con: openssl rand -hex 32')
} else {
  http.createServer((request, response) => {
    const ip = request.socket.remoteAddress || 'unknown'
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
    if (url.pathname !== '/whatsapp/qr' || isRateLimited(ip) || !tokenMatches(url.searchParams.get('token'))) {
      recordFailure(ip)
      const limited = isRateLimited(ip)
      response.writeHead(limited ? 429 : 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      return response.end('No encontrado')
    }
    failures.delete(ip)
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    if (!latestQr) return response.end('<meta name="viewport" content="width=device-width"><p>El QR no está disponible. El bot puede estar conectado.</p>')
    response.end(`<meta name="viewport" content="width=device-width"><title>Full China WhatsApp</title><h1>Vincular WhatsApp Full China</h1><p>Escanea este código desde WhatsApp.</p><img style="max-width:100%;width:420px" src="${latestQr}" alt="QR de WhatsApp">`)
  }).listen(qrPort, qrHost, () => {
    const tunnel = qrHost === '127.0.0.1' ? ' (solo local; fuera del VPS: ssh -L 3033:127.0.0.1:3033 root@<vps>)' : ''
    console.log(`QR server disponible en ${qrHost}:${qrPort}${tunnel}.`)
  })
}

client.initialize()
