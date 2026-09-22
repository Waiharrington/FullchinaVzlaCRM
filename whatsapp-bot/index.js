require('dotenv').config()

const http = require('node:http')
const QRCode = require('qrcode')
const qrcodeTerminal = require('qrcode-terminal')
const { Client, LocalAuth } = require('whatsapp-web.js')
const { createClient } = require('@supabase/supabase-js')

const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable ${name}`)
  return value
}

const qrPort = Number(process.env.WHATSAPP_QR_PORT || 3033)
const qrToken = required('WHATSAPP_QR_ACCESS_TOKEN')
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
client.on('ready', () => console.log('Bot de WhatsApp Full China listo para conversaciones individuales.'))
async function queueAutomations() {
  const { data, error } = await supabase.rpc('fn_queue_whatsapp_automations')
  if (error) console.error('No se pudieron preparar automatizaciones:', error.message)
  else if (data?.total) console.log(`Automatizaciones preparadas: ${data.total}`)
}
setInterval(queueAutomations, 5 * 60 * 1000)
queueAutomations()
client.on('message', async message => {
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

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  if (url.pathname !== '/whatsapp/qr' || url.searchParams.get('token') !== qrToken) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    return response.end('No encontrado')
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  if (!latestQr) return response.end('<meta name="viewport" content="width=device-width"><p>El QR no está disponible. El bot puede estar conectado.</p>')
  response.end(`<meta name="viewport" content="width=device-width"><title>Full China WhatsApp</title><h1>Vincular WhatsApp Full China</h1><p>Escanea este código desde WhatsApp.</p><img style="max-width:100%;width:420px" src="${latestQr}" alt="QR de WhatsApp">`)
}).listen(qrPort, '0.0.0.0', () => console.log(`QR server disponible en el puerto ${qrPort}.`))

client.initialize()
