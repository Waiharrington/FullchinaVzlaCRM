const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function classifyMessage(message: Record<string, unknown>) {
  if (message.voice) return { inputKind: 'voice', fileId: message.voice.file_id, mimeType: 'audio/ogg' }
  if (message.photo?.length) return { inputKind: 'photo', fileId: message.photo.at(-1).file_id, mimeType: 'image/jpeg' }
  if (message.document) return { inputKind: 'document', fileId: message.document.file_id, mimeType: message.document.mime_type || null }
  return { inputKind: 'text', fileId: null, mimeType: null }
}

async function extractTextData(text: string, context: Record<string, unknown> = {}) {
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey || !text.trim()) return { data: {}, confidence: null, status: 'received' }
  const model = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b'
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'Eres la inteligencia artificial administrativa de FullChinaVzla, no un chatbot de respuestas prefabricadas. Tu trabajo es entender la intención de la persona, conservar el contexto, relacionar cada mensaje con la operación pendiente, detectar contradicciones y hacer la siguiente pregunta más útil. Habla como una persona competente y cercana, nunca expongas nombres técnicos de campos, JSON, esquemas ni listas internas. Si dicen "compré en Euromercado", entiende que probablemente están iniciando una compra y pregunta qué compraron. Si corrigen un dato, actualízalo sin reiniciar la conversación. Devuelve SOLO JSON válido con type (purchase, expense, inventory, unknown), supplier, date, total, currency, payment_account, concept, items (array de description, quantity, unit, unit_cost), missing_fields, confidence. Para una purchase, considera esenciales supplier, items y total; date, currency y cuenta solo son obligatorios si hacen falta para registrar correctamente. No inventes valores. missing_fields debe contener únicamente información realmente necesaria y en lenguaje humano.',
        },
        { role: 'user', content: JSON.stringify({ previous_data: context, new_message: text }) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`groq_http_${response.status}`)
  const result = await response.json()
  const content = result.choices?.[0]?.message?.content
  if (!content) throw new Error('groq_empty_response')
  let cleanContent = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const firstObject = cleanContent.indexOf('{')
  const lastObject = cleanContent.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject) cleanContent = cleanContent.slice(firstObject, lastObject + 1)
  const data = JSON.parse(cleanContent)
  const confidence = typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : null
  return { data, confidence, status: 'awaiting_confirmation' }
}

function applyExplicitFacts(text: string, base: Record<string, unknown> = {}) {
  const data = { ...base }
  const supplier = text.match(/(?:proveedor|en)\s+(?:fue\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ0-9][\wÁÉÍÓÚáéíóúÑñ .-]{2,40}?)(?=\s+(?:por|compr[eé]|y\s+compr[eé]|,|$))/i)
  if (supplier) data.supplier = supplier[1].trim()
  const payment = text.match(/(?:desde|por|con)\s+(?:la cuenta de\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ][\wÁÉÍÓÚáéíóúÑñ .-]{2,30})(?:\.|$)/i)
  if (payment && /pago|pag[uéó]|salieron|cuenta/i.test(text)) data.payment_account = payment[1].trim()
  const total = text.match(/(?:por|total de|fue de)\s+([0-9][0-9.,]*)\s*(d[oó]lares?|usd|bs|bol[ií]vares?)/i)
  if (total) { data.total = total[1].replace(',', '.'); data.currency = /bs|bol/i.test(total[2]) ? 'VES' : 'USD' }
  return data
}

async function transcribeVoice(fileId: string, token: string) {
  const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`)
  if (!fileResponse.ok) throw new Error('telegram_file_lookup_failed')
  const fileData = await fileResponse.json()
  const filePath = fileData.result?.file_path
  if (!filePath) throw new Error('telegram_file_path_missing')
  const audioResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`)
  if (!audioResponse.ok) throw new Error('telegram_file_download_failed')
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) throw new Error('groq_not_configured')
  const form = new FormData()
  form.append('file', new Blob([await audioResponse.arrayBuffer()], { type: 'audio/ogg' }), 'voice.ogg')
  form.append('model', Deno.env.get('GROQ_TRANSCRIPTION_MODEL') || 'whisper-large-v3-turbo')
  form.append('language', 'es')
  form.append('response_format', 'json')
  const transcriptionResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${groqKey}` }, body: form,
  })
  if (!transcriptionResponse.ok) throw new Error(`groq_transcription_${transcriptionResponse.status}`)
  const transcription = await transcriptionResponse.json()
  if (!transcription.text) throw new Error('groq_empty_transcription')
  return transcription.text as string
}

function isConfirmation(text: string) {
  return /\b(s[ií]|confirmo|confirmar|hazlo|correcto|adelante|reg[ií]stralo)\b/i.test(text)
}

function isCancellation(text: string) {
  return /\b(no|cancela|cancelar|anula|incorrecto|equivocad[oa])\b/i.test(text)
}

function isGreeting(text: string) {
  return /^(?:\/start|hol+a+|holi|buenos d[ií]as|buenas tardes|buenas noches|buenas|hello|hey)\b/i.test(text.trim());
}

function isBusinessQuery(text: string) {
  return /(?:c[oó]mo va(?: el)? negocio|cu[aá]ntas? ventas?|cu[aá]ntas? comandas?|ventas? de hoy|comandas? (?:abiertas?|pendientes?)|qu[eé] se vendi[oó]|resumen (?:de hoy|del d[ií]a))/i.test(text);
}

async function businessOverview(supabaseUrl: string, headers: Record<string, string>) {
  const start = new Date();
  start.setUTCHours(4, 0, 0, 0);
  const response = await fetch(`${supabaseUrl}/rest/v1/orders?created_at=gte.${encodeURIComponent(start.toISOString())}&select=id,status`, { headers });
  if (!response.ok) throw new Error(`business_query_${response.status}_${(await response.text()).slice(0, 240)}`);
  const orders = await response.json();
  const open = orders.filter((order) => ['open', 'confirmed'].includes(order.status)).length;
  const paid = orders.filter((order) => order.status === 'paid').length;
  return `Hoy hay ${orders.length} comandas registradas: ${paid} pagadas y ${open} abiertas o en proceso.`;
}

function confirmationMessage(data: Record<string, unknown>) {
  const type = data.type === 'purchase' ? 'compra' : data.type === 'expense' ? 'gasto' : data.type === 'inventory' ? 'movimiento de inventario' : 'operación';
  const subject = data.concept || data.supplier || 'sin concepto identificado';
  const total = data.total != null ? ` por ${data.total} ${data.currency || 'USD'}` : '';
  const missing = Array.isArray(data.missing_fields) ? data.missing_fields.filter(Boolean) : [];
  if (missing.length) return `Entendí que se trata de ${type} en ${subject}. Para completar el registro necesito saber ${missing.join(' y ')}.`;
  return `Entendí una ${type} en ${subject}${total}. ¿Está correcto?`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!webhookSecret || receivedSecret !== webhookSecret) return json({ error: 'unauthorized' }, 401)

  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!telegramToken || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'server_configuration' }, 500);
  }

  let update: Record<string, unknown>
  try { update = await request.json() } catch { return json({ error: 'invalid_request' }, 400) }
  const message = update.message
  if (!message?.chat?.id || !message.message_id) return json({ ok: true, ignored: true })

  const classified = classifyMessage(message)
  let rawText = typeof message.text === 'string' ? message.text : typeof message.caption === 'string' ? message.caption : null
  if (classified.inputKind === 'voice' && classified.fileId) {
    try { rawText = await transcribeVoice(classified.fileId, telegramToken) } catch (error) {
      console.error('Voice transcription failed:', error instanceof Error ? error.message : 'unknown')
    }
  }
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    'Accept-Profile': 'fullchinavzla',
    'Content-Profile': 'fullchinavzla',
    'Prefer': 'resolution=ignore-duplicates,return=minimal',
  }
  const existingResponse = await fetch(`${supabaseUrl}/rest/v1/ai_intake_messages?source_chat_id=eq.${encodeURIComponent(String(message.chat.id))}&status=eq.awaiting_confirmation&select=id,extracted_data&order=created_at.desc&limit=1`, { headers })
  const pending = existingResponse.ok ? (await existingResponse.json())?.[0] : null
  if (rawText && isBusinessQuery(rawText)) {
    let reply = 'No pude consultar el negocio en este momento. Intenta nuevamente en unos segundos.'
    try { reply = await businessOverview(supabaseUrl, headers) } catch (error) {
      console.error('Business query failed:', error instanceof Error ? error.message : 'unknown')
    }
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: message.chat.id, text: reply }),
    })
    return json({ ok: true, action: 'business_query' })
  }
  if (rawText && isGreeting(rawText)) {
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: message.chat.id, text: '¡Hola! Todo bien por aquí 😊 Soy tu asistente de FullChinaVzla. Podemos registrar una compra o un gasto, revisar inventario, ver las comandas o consultar cómo va el negocio. ¿Qué necesitas hoy?' }),
    })
    return json({ ok: true, action: 'greeting' })
  }
  if (pending && rawText && isConfirmation(rawText)) {
    await fetch(`${supabaseUrl}/rest/v1/ai_intake_messages?id=eq.${pending.id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() }) })
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: message.chat.id, text: 'Confirmado. Dejé la operación aprobada para registrarla en el sistema.' }) })
    return json({ ok: true, action: 'approved', draft_id: pending.id })
  }
  if (pending && rawText && isCancellation(rawText)) {
    await fetch(`${supabaseUrl}/rest/v1/ai_intake_messages?id=eq.${pending.id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'rejected' }) })
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: message.chat.id, text: 'Entendido, cancelé ese borrador.' }) })
    return json({ ok: true, action: 'rejected', draft_id: pending.id })
  }
  if (pending && rawText) {
    try {
      const refinement = await extractTextData(rawText, applyExplicitFacts(rawText, pending.extracted_data || {}))
      await fetch(`${supabaseUrl}/rest/v1/ai_intake_messages?id=eq.${pending.id}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ extracted_data: refinement.data, confidence: refinement.confidence, raw_text: rawText, status: refinement.status }),
      })
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: message.chat.id, text: confirmationMessage(refinement.data) }) })
      return json({ ok: true, action: 'refined', draft_id: pending.id })
    } catch (error) {
      console.error('AI refinement failed:', error instanceof Error ? error.message : 'unknown')
    }
  }
  let extraction = { data: {}, confidence: null as number | null, status: 'received' }
  if (rawText) {
    try { extraction = await extractTextData(rawText, applyExplicitFacts(rawText)) } catch (error) {
      console.error('AI extraction failed:', error instanceof Error ? error.message : 'unknown')
      const fallback = applyExplicitFacts(rawText)
      if (/compr[aeé]|compra/i.test(rawText)) {
        fallback.type = 'purchase'
        fallback.missing_fields = ['productos y cantidades']
        extraction = { data: fallback, confidence: 0.25, status: 'awaiting_confirmation' }
      } else {
        extraction = { data: fallback, confidence: null, status: 'failed' }
      }
    }
  }
  const insert = await fetch(`${supabaseUrl}/rest/v1/ai_intake_messages`, {
    method: 'POST', headers,
    body: JSON.stringify({
      source_message_id: String(message.message_id),
      source_chat_id: String(message.chat.id),
      source_user_id: message.from?.id ? String(message.from.id) : null,
      input_kind: classified.inputKind,
      raw_text: rawText,
      transcription: classified.inputKind === 'voice' ? rawText : null,
      media_file_id: classified.fileId,
      media_mime_type: classified.mimeType,
      extracted_data: extraction.data,
      confidence: extraction.confidence,
      status: extraction.status,
    }),
  })
  if (!insert.ok && insert.status !== 409) return json({ error: 'persistence_failed' }, 503)

  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: message.chat.id,
      text: extraction.status === 'awaiting_confirmation'
        ? confirmationMessage(extraction.data)
        : 'Recibido, pero necesito revisar la información antes de preparar el borrador.',
    }),
  })
  return json({ ok: true })
})
