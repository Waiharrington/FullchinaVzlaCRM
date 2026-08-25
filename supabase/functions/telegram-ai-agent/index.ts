type Json = Record<string, unknown>

const jsonResponse = (body: Json, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const SYSTEM_PROMPT = `Eres la asistente de inteligencia artificial de FullChinaVzla, un negocio de comida.
Hablas en español venezolano natural, profesional y cercano. Interpretas el significado completo del mensaje, recuerdas la conversación y decides si debes conversar, consultar el sistema o preparar una operación.
Cuando el usuario responde algo corto como "sí pollo", "el primero", "ese mismo" o "sí, créalo", interprétalo como respuesta directa a tu última pregunta y continúa la operación pendiente con todos los datos ya mencionados. No reinicies la conversación ni respondas con un saludo o "¿en qué te ayudo?".
Cuando confirm_latest_draft indique que la compra quedó registrada, considera esa operación cerrada. Responde una sola vez con el resultado y no vuelvas a preparar la misma compra por un saludo o mensaje posterior. Si la herramienta indica duplicate_prevented o already_registered, explica que ya estaba registrada y que no se creó otra.
Tienes herramientas con datos reales del esquema fullchinavzla. Úsalas cuando la persona pregunte por ventas, comandas, productos, inventario o desempeño. Nunca inventes cifras.
Para compras: antes de preparar el borrador usa search_catalog pasando por separado supplier_query e ingredient_query. Si hay una coincidencia exacta, úsala; si hay varias parecidas, enumera las opciones y pregunta cuál es. Si no existe el proveedor, ofrece crearlo y usa create_supplier únicamente después de que el usuario confirme claramente que desea agregarlo. Si el ingrediente no coincide exactamente pero hay una alternativa razonable, pregunta de forma natural, por ejemplo: "No veo Milanesa; ¿te refieres a Pollo?". Nunca inventes IDs ni digas que algo no existe sin haber consultado su nombre correcto. Si la moneda es bolívares usa get_bcv_rate y calcula unit_cost_usd. Prepara el borrador solo cuando todos los artículos estén resueltos; pide confirmación y usa confirm_latest_draft únicamente cuando el usuario confirme claramente.
Para gastos o ajustes: reúne la información faltante y pide confirmación antes de registrar. Una consulta nunca reemplaza un borrador pendiente.
No menciones JSON, tablas, RPC, campos internos ni detalles técnicos. Responde de manera breve y útil. Si el usuario saluda y además pregunta algo, responde el saludo y atiende también la pregunta.`

const tools = [
  { type: 'function', function: { name: 'get_today_stats', description: 'Consulta ventas, comandas, pendientes y ticket promedio de hoy.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_daily_sales', description: 'Consulta ventas diarias de un periodo reciente.', parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['days'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_product_ranking', description: 'Consulta productos más vendidos e ingresos por producto.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_open_orders', description: 'Consulta comandas abiertas o en proceso.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_inventory', description: 'Consulta existencias reales; puede buscar un ingrediente.', parameters: { type: 'object', properties: { search: { type: 'string' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'search_catalog', description: 'Busca proveedores e ingredientes reales usando consultas separadas. Devuelve coincidencias exactas y sugerencias parecidas.', parameters: { type: 'object', properties: { supplier_query: { type: 'string' }, ingredient_query: { type: 'string' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'create_supplier', description: 'Crea un proveedor nuevo. Solo debe usarse después de mostrar que no existe y recibir confirmación explícita del usuario.', parameters: { type: 'object', properties: { name: { type: 'string' }, contact: { type: ['string', 'null'] }, phone: { type: ['string', 'null'] }, email: { type: ['string', 'null'] }, notes: { type: ['string', 'null'] }, explicitly_confirmed: { type: 'boolean' } }, required: ['name', 'explicitly_confirmed'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_bcv_rate', description: 'Obtiene la tasa oficial actual Bs por USD para normalizar una compra expresada en bolívares.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'prepare_operation', description: 'Guarda un borrador ya resuelto. Los IDs deben provenir de search_catalog.', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['purchase', 'expense', 'inventory'] }, supplier: { type: ['string', 'null'] }, supplier_id: { type: ['string', 'null'] }, concept: { type: ['string', 'null'] }, total: { type: ['number', 'null'] }, currency: { type: ['string', 'null'] }, exchange_rate: { type: ['number', 'null'] }, payment_account: { type: ['string', 'null'] }, items: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, ingredient_id: { type: ['string', 'null'] }, quantity: { type: 'number' }, unit: { type: ['string', 'null'] }, unit_id: { type: ['string', 'null'] }, unit_cost: { type: ['number', 'null'] }, unit_cost_usd: { type: ['number', 'null'] } }, required: ['description', 'quantity'] } } }, required: ['type', 'items'], additionalProperties: false } } },
  { type: 'function', function: { name: 'confirm_latest_draft', description: 'Confirma el último borrador pendiente cuando el usuario da aprobación inequívoca.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'cancel_latest_draft', description: 'Cancela el último borrador pendiente cuando el usuario lo solicita.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
]

function parseEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_${name}`)
  return value
}

function dbHeaders(serviceKey: string) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Accept-Profile': 'fullchinavzla', 'Content-Profile': 'fullchinavzla' }
}

async function db(url: string, serviceKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders(serviceKey), ...(init.headers || {}) } })
  const text = await response.text()
  if (!response.ok) throw new Error(`db_${response.status}_${text.slice(0, 180)}`)
  return text ? JSON.parse(text) : null
}

async function remember(url: string, key: string, chatId: string, userId: string | null, role: string, content: string, metadata: Json = {}) {
  const conversations = await db(url, key, 'ai_agent_conversations?on_conflict=source,source_chat_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ source: 'telegram', source_chat_id: chatId, source_user_id: userId }),
  })
  const conversationId = conversations[0].id
  await db(url, key, 'ai_agent_messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ conversation_id: conversationId, role, content, metadata }) })
  return conversationId
}

async function history(url: string, key: string, conversationId: string) {
  const rows = await db(url, key, `ai_agent_messages?conversation_id=eq.${conversationId}&role=in.(user,assistant)&select=role,content&order=created_at.desc&limit=20`)
  return rows.reverse().map((row: Json) => ({ role: row.role, content: row.content }))
}

async function hydratePurchaseItems(url: string, key: string, operation: Json) {
  if (operation.type !== 'purchase' || !Array.isArray(operation.items)) return operation
  const hydratedItems = []
  for (const rawItem of operation.items) {
    const item = { ...(rawItem as Json) }
    if (item.ingredient_id && !item.unit_id) {
      const ingredients = await db(url, key, `ingredients?id=eq.${encodeURIComponent(String(item.ingredient_id))}&select=id,unit_id&limit=1`)
      if (ingredients?.[0]?.unit_id) item.unit_id = ingredients[0].unit_id
    }
    hydratedItems.push(item)
  }
  return { ...operation, items: hydratedItems }
}

async function executeTool(name: string, args: Json, ctx: Json) {
  const { supabaseUrl, serviceKey, chatId, userId, messageId, rawText } = ctx
  if (name === 'get_today_stats') return db(supabaseUrl, serviceKey, 'rpc/fn_get_today_stats', { method: 'POST', body: '{}' })
  if (name === 'get_daily_sales') return db(supabaseUrl, serviceKey, 'rpc/fn_get_daily_sales', { method: 'POST', body: JSON.stringify({ p_days: args.days || 7 }) })
  if (name === 'get_product_ranking') return db(supabaseUrl, serviceKey, 'rpc/fn_get_product_ranking', { method: 'POST', body: '{}' })
  if (name === 'get_open_orders') return db(supabaseUrl, serviceKey, 'v_orders_with_items?status=in.(open,confirmed)&select=order_number,status,fulfillment_status,total_amount,created_at&order=created_at.desc&limit=30')
  if (name === 'get_inventory') {
    const filter = args.search ? `&ingredient_name=ilike.*${encodeURIComponent(args.search)}*` : ''
    return db(supabaseUrl, serviceKey, `v_current_stock?select=ingredient_name,current_stock,unit_symbol,stock_value${filter}&order=ingredient_name&limit=50`)
  }
  if (name === 'search_catalog') {
    const suppliers = await db(supabaseUrl, serviceKey, 'suppliers?is_active=eq.true&select=id,name&order=name')
    const ingredients = await db(supabaseUrl, serviceKey, 'ingredients?is_active=eq.true&select=id,name,unit_id,units!ingredients_unit_id_fkey(name,symbol)&order=name&limit=150')
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const rank = (items: Json[], rawQuery: string) => {
      const query = normalize(rawQuery || '')
      if (!query) return []
      return items.map((item: Json) => {
        const candidate = normalize(item.name)
        const exact = candidate === query
        const contained = candidate.includes(query) || query.includes(candidate)
        const queryTokens = new Set(query.split(' ').filter(Boolean))
        const shared = candidate.split(' ').filter((token) => queryTokens.has(token)).length
        return { ...item, match: exact ? 'exact' : 'similar', score: exact ? 100 : contained ? 80 : shared * 20 }
      }).filter((item: Json) => Number(item.score) > 0).sort((a: Json, b: Json) => Number(b.score) - Number(a.score)).slice(0, 8)
    }
    const supplierQuery = String(args.supplier_query || '')
    const ingredientQuery = String(args.ingredient_query || '')
    const supplierMatches = rank(suppliers, supplierQuery)
    let ingredientMatches = rank(ingredients, ingredientQuery)
    const normalizedIngredient = normalize(ingredientQuery)
    if (!ingredientMatches.length && /milanesa|proteina|pechuga/.test(normalizedIngredient)) {
      ingredientMatches = ingredients.filter((item: Json) => /pollo|carne|cerdo|lomito/.test(normalize(item.name)))
        .map((item: Json) => ({ ...item, match: 'suggestion', score: 10 }))
    }
    return { supplier_query: supplierQuery, ingredient_query: ingredientQuery, suppliers: supplierMatches, ingredients: ingredientMatches.slice(0, 12) }
  }
  if (name === 'create_supplier') {
    if (args.explicitly_confirmed !== true) return { ok: false, message: 'Debes pedir confirmación explícita antes de crear el proveedor.' }
    const identities = await db(supabaseUrl, serviceKey, `ai_agent_identities?source=eq.telegram&source_user_id=eq.${userId}&is_active=eq.true&select=profile_id&limit=1`)
    if (!identities?.length) return { ok: false, message: 'Este usuario de Telegram no está autorizado para crear proveedores.' }
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const supplierName = String(args.name || '').trim()
    if (!supplierName) return { ok: false, message: 'Falta el nombre del proveedor.' }
    const suppliers = await db(supabaseUrl, serviceKey, 'suppliers?select=id,name,is_active&order=name')
    const existing = suppliers.find((supplier: Json) => normalize(supplier.name) === normalize(supplierName))
    if (existing) return { ok: true, already_exists: true, supplier: existing }
    const created = await db(supabaseUrl, serviceKey, 'suppliers', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        name: supplierName,
        contact: args.contact || null,
        phone: args.phone || null,
        email: args.email || null,
        notes: args.notes || 'Creado desde el asistente de Telegram',
        is_active: true,
      }),
    })
    return { ok: true, created: true, supplier: created[0] }
  }
  if (name === 'get_bcv_rate') {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial')
    if (!response.ok) throw new Error(`bcv_${response.status}`)
    const rate = await response.json()
    return { source: 'BCV oficial', rate_bs_per_usd: Number(rate.promedio), date: rate.fechaActualizacion }
  }
  if (name === 'prepare_operation') {
    const hydratedOperation = await hydratePurchaseItems(supabaseUrl, serviceKey, args)
    await db(supabaseUrl, serviceKey, 'ai_intake_messages', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ source_message_id: messageId, source_chat_id: chatId, source_user_id: userId, input_kind: 'text', raw_text: rawText, extracted_data: hydratedOperation, confidence: 1, status: 'awaiting_confirmation' }) })
    return { ok: true, status: 'awaiting_confirmation', operation: hydratedOperation }
  }
  const pending = await db(supabaseUrl, serviceKey, `ai_intake_messages?source_chat_id=eq.${chatId}&status=eq.awaiting_confirmation&select=id,extracted_data&order=created_at.desc&limit=1`)
  if (!pending?.length) return { ok: false, message: 'No hay borradores pendientes.' }
  if (name === 'confirm_latest_draft') {
    const identities = await db(supabaseUrl, serviceKey, `ai_agent_identities?source=eq.telegram&source_user_id=eq.${userId}&is_active=eq.true&select=profile_id&limit=1`)
    if (!identities?.length) return { ok: false, message: 'Este usuario de Telegram no está autorizado para registrar operaciones.' }
    if (pending[0].extracted_data?.type === 'purchase') {
      const hydratedOperation = await hydratePurchaseItems(supabaseUrl, serviceKey, pending[0].extracted_data)
      await db(supabaseUrl, serviceKey, `ai_intake_messages?id=eq.${pending[0].id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ extracted_data: hydratedOperation }) })
      try {
        return await db(supabaseUrl, serviceKey, 'rpc/fn_ai_finalize_purchase', { method: 'POST', body: JSON.stringify({ p_draft_id: pending[0].id, p_profile_id: identities[0].profile_id }) })
      } catch (error) {
        return { ok: false, message: error instanceof Error ? `No pude registrar la compra: ${error.message}` : 'No pude registrar la compra. Revisa los datos del borrador.' }
      }
    }
    return { ok: false, message: 'La escritura real de este tipo de operación todavía no está habilitada.' }
  }
  if (name === 'cancel_latest_draft') {
    await db(supabaseUrl, serviceKey, `ai_intake_messages?id=eq.${pending[0].id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'rejected' }) })
    return { ok: true, status: 'rejected' }
  }
  return { ok: false, message: 'Herramienta desconocida.' }
}

async function transcribe(fileId: string, telegramToken: string, groqKey: string) {
  const fileData = await (await fetch(`https://api.telegram.org/bot${telegramToken}/getFile?file_id=${encodeURIComponent(fileId)}`)).json()
  const audio = await fetch(`https://api.telegram.org/file/bot${telegramToken}/${fileData.result.file_path}`)
  const form = new FormData()
  form.append('file', new Blob([await audio.arrayBuffer()], { type: 'audio/ogg' }), 'voice.ogg')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'es')
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${groqKey}` }, body: form })
  if (!response.ok) throw new Error(`transcription_${response.status}`)
  return (await response.json()).text
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)
  try {
    const telegramToken = parseEnv('TELEGRAM_BOT_TOKEN')
    const groqKey = parseEnv('GROQ_API_KEY')
    const supabaseUrl = parseEnv('SUPABASE_URL')
    const serviceKey = parseEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (request.headers.get('x-telegram-bot-api-secret-token') !== parseEnv('TELEGRAM_WEBHOOK_SECRET')) return jsonResponse({ error: 'unauthorized' }, 401)
    const update = await request.json()
    const message = update.message
    if (!message?.chat?.id) return jsonResponse({ ok: true, ignored: true })
    const chatId = String(message.chat.id)
    const userId = message.from?.id ? String(message.from.id) : null
    let text = message.text || message.caption || ''
    if (message.voice?.file_id) text = await transcribe(message.voice.file_id, telegramToken, groqKey)
    if (!text.trim()) text = 'El usuario envió un archivo o imagen. Explícale brevemente qué información adicional necesitas.'

    const conversationId = await remember(supabaseUrl, serviceKey, chatId, userId, 'user', text, { telegram_message_id: message.message_id })
    const messages: Json[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...(await history(supabaseUrl, serviceKey, conversationId)).slice(-20)]
    let finalText = ''
    for (let turn = 0; turn < 8; turn++) {
      let response: Response | null = null
      for (const model of ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b']) {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, temperature: 0.2, messages, tools, tool_choice: 'auto' }) })
        if (response.ok || response.status !== 429) break
      }
      if (!response?.ok) throw new Error(`groq_${response?.status}_${response ? (await response.text()).slice(0, 160) : 'no_response'}`)
      const assistant = (await response.json()).choices?.[0]?.message
      if (!assistant?.tool_calls?.length) { finalText = assistant?.content || 'Sigo con la operación que estábamos preparando. Dame un momento para completar la validación.'; break }
      messages.push(assistant)
      for (const call of assistant.tool_calls) {
        const args = JSON.parse(call.function.arguments || '{}')
        const result = await executeTool(call.function.name, args, { supabaseUrl, serviceKey, chatId, userId, messageId: String(message.message_id), rawText: text })
        messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) })
      }
    }
    if (!finalText) finalText = 'Conservé los datos de la operación, pero no logré terminar todas las validaciones. Repite únicamente tu última confirmación y continúo desde allí.'
    await remember(supabaseUrl, serviceKey, chatId, userId, 'assistant', finalText)
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: finalText }) })
    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('Agent error:', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'agent_unavailable' }, 500)
  }
})
