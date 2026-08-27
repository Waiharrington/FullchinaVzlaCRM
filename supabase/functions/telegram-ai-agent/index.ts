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
Cuando recibas el análisis de una factura o comprobante en imagen, diferencia datos visibles de inferencias. Cruza proveedor e ingredientes con search_catalog, pide únicamente los datos obligatorios ausentes o ilegibles y jamás registres basándote solo en una imagen sin mostrar el borrador y recibir confirmación explícita. Una referencia de pago no demuestra por sí sola que la factura y el pago correspondan si los importes o beneficiarios no coinciden; señala la discrepancia.
Para compras: antes de preparar el borrador usa search_catalog pasando por separado supplier_query e ingredient_query. Si hay una coincidencia exacta, úsala; si hay varias parecidas, enumera las opciones y pregunta cuál es. Si no existe el proveedor, ofrece crearlo y usa create_supplier únicamente después de que el usuario confirme claramente que desea agregarlo. Si el ingrediente no coincide exactamente pero hay una alternativa razonable, pregunta de forma natural, por ejemplo: "No veo Milanesa; ¿te refieres a Pollo?". Nunca inventes IDs ni digas que algo no existe sin haber consultado su nombre correcto. Si la moneda es bolívares usa get_bcv_rate y calcula unit_cost_usd. Prepara el borrador solo cuando todos los artículos estén resueltos; pide confirmación y usa confirm_latest_draft únicamente cuando el usuario confirme claramente.
Haz cálculos obvios tú misma. Si compraron 660 gramos por 2600 Bs y el ingrediente se controla en kg, convierte 660 g a 0,66 kg y calcula 2600 / 0,66 = 3939,39 Bs/kg; no preguntes el precio unitario. Convierte también mg↔g↔kg y ml↔L cuando corresponda. Muestra el cálculo y pregunta solo si la unidad o el total son ambiguos.
Clasifica cada salida de dinero según su efecto: purchase es compra de ingredientes que aumenta inventario; expense variable es una compra o gasto que no entra al inventario y cambia con la operación; expense fixed es un gasto recurrente/estructural; expense other solo si el usuario no permite decidir entre fijo y variable. Si el usuario dice "compra no inventario", "gasto variable" o equivalente, usa expense y no modifiques stock. income es un ingreso manual diferente de una venta/comanda ya registrada. Para expense e income reúne concepto, total, moneda, fecha y cuenta si fue indicada; usa get_bcv_rate para bolívares. Siempre muestra borrador y confirma antes de escribir.
Entiende también la administración completa del restaurante. transfer mueve dinero entre cuentas y nunca es gasto ni ingreso; receivable crea una cuenta por cobrar; receivable_collection registra su cobro sin duplicar el ingreso original; tip y tip_distribution controlan propinas; employee_advance es adelanto de nómina y no gasto adicional al pagarse la nómina; loan y loan_payment controlan préstamos; bank_fee sí es un gasto financiero; adjustment solo se usa cuando la persona explica una corrección. Usa get_financial_accounts para resolver expresiones como Banesco, Exterior, pago móvil, punto, efectivo en dólares o efectivo en bolívares. Si falta la cuenta exacta, pregunta; no inventes una.
Las palabras Compras, Gastos F, Gastos V y Otros reflejan el lenguaje histórico de la familia: Compras solo significa inventario; Gastos F equivale a fixed; Gastos V equivale a variable. Depósitos y traspasos no se clasifican como gasto. Adelantos, préstamos, cuentas por cobrar y propinas deben conservar contraparte y referencia cuando se conozcan.
Para gastos, ingresos o ajustes: reúne únicamente la información realmente faltante y pide confirmación antes de registrar. Una consulta nunca reemplaza un borrador pendiente.
No menciones JSON, tablas, RPC, campos internos ni detalles técnicos. Responde de manera breve y útil. Si el usuario saluda y además pregunta algo, responde el saludo y atiende también la pregunta.`

const tools = [
  { type: 'function', function: { name: 'get_today_stats', description: 'Consulta ventas, comandas, pendientes y ticket promedio de hoy.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_daily_sales', description: 'Consulta ventas diarias de un periodo reciente.', parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['days'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_product_ranking', description: 'Consulta productos más vendidos e ingresos por producto.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_open_orders', description: 'Consulta comandas abiertas o en proceso.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_inventory', description: 'Consulta existencias reales; puede buscar un ingrediente.', parameters: { type: 'object', properties: { search: { type: 'string' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'search_catalog', description: 'Busca proveedores e ingredientes reales usando consultas separadas. Devuelve coincidencias exactas y sugerencias parecidas.', parameters: { type: 'object', properties: { supplier_query: { type: ['string', 'null'] }, ingredient_query: { type: ['string', 'null'] } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'create_supplier', description: 'Crea un proveedor nuevo. Solo debe usarse después de mostrar que no existe y recibir confirmación explícita del usuario.', parameters: { type: 'object', properties: { name: { type: 'string' }, contact: { type: ['string', 'null'] }, phone: { type: ['string', 'null'] }, email: { type: ['string', 'null'] }, notes: { type: ['string', 'null'] }, explicitly_confirmed: { type: 'boolean' } }, required: ['name', 'explicitly_confirmed'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_bcv_rate', description: 'Obtiene la tasa oficial actual Bs por USD para normalizar una compra expresada en bolívares.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_financial_accounts', description: 'Lista las cuentas financieras y sus alias para resolver de dónde salió o a dónde entró el dinero.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_financial_summary', description: 'Consulta ventas, compras, gastos, ingresos y movimientos administrativos de un rango.', parameters: { type: 'object', properties: { start_date: { type: 'string' }, end_date: { type: 'string' } }, required: ['start_date','end_date'], additionalProperties: false } } },
  { type: 'function', function: { name: 'prepare_operation', description: 'Guarda un borrador resuelto para cualquier operación del restaurante. Los IDs deben provenir de las herramientas de consulta.', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['purchase','expense','income','inventory','transfer','receivable','receivable_collection','tip','tip_distribution','employee_advance','loan','loan_payment','bank_fee','adjustment'] }, expense_category: { type: ['string', 'null'] }, supplier: { type: ['string', 'null'] }, supplier_id: { type: ['string', 'null'] }, concept: { type: ['string', 'null'] }, date: { type: ['string', 'null'] }, total: { type: ['number', 'null'] }, currency: { type: ['string', 'null'] }, exchange_rate: { type: ['number', 'null'] }, payment_account: { type: ['string', 'null'] }, from_account_id: { type: ['string','null'] }, to_account_id: { type: ['string','null'] }, counterparty: { type: ['string','null'] }, reference_number: { type: ['string','null'] }, affects_profit: { type: ['boolean','null'] }, notes: { type: ['string', 'null'] }, items: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, ingredient_id: { type: ['string', 'null'] }, quantity: { type: 'number' }, unit: { type: ['string', 'null'] }, unit_id: { type: ['string', 'null'] }, unit_cost: { type: ['number', 'null'] }, unit_cost_usd: { type: ['number', 'null'] } }, required: ['description', 'quantity'] } } }, required: ['type'], additionalProperties: false } } },
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
    if (item.ingredient_id) {
      const ingredients = await db(url, key, `ingredients?id=eq.${encodeURIComponent(String(item.ingredient_id))}&select=id,unit_id,units!ingredients_unit_id_fkey(symbol)&limit=1`)
      const ingredient = ingredients?.[0]
      if (ingredient?.unit_id) item.unit_id = ingredient.unit_id
      const inputUnit = String(item.unit || '').toLowerCase().replace(/\s/g, '')
      const targetUnit = String(ingredient?.units?.symbol || '').toLowerCase().replace(/\s/g, '')
      let quantity = Number(item.quantity)
      if (Number.isFinite(quantity) && inputUnit && targetUnit && inputUnit !== targetUnit) {
        if ((inputUnit === 'g' || inputUnit === 'gr' || inputUnit === 'gramos') && targetUnit === 'kg') quantity /= 1000
        else if (inputUnit === 'mg' && targetUnit === 'g') quantity /= 1000
        else if (inputUnit === 'mg' && targetUnit === 'kg') quantity /= 1_000_000
        else if (inputUnit === 'kg' && (targetUnit === 'g' || targetUnit === 'gr')) quantity *= 1000
        else if ((inputUnit === 'ml' || inputUnit === 'mililitros') && (targetUnit === 'l' || targetUnit === 'lt')) quantity /= 1000
        else if ((inputUnit === 'l' || inputUnit === 'lt' || inputUnit === 'litros') && targetUnit === 'ml') quantity *= 1000
      }
      if (Number.isFinite(quantity) && quantity > 0) item.quantity = quantity
      if (targetUnit) item.unit = ingredient.units.symbol
    }
    hydratedItems.push(item)
  }
  if (hydratedItems.length === 1) {
    const item = hydratedItems[0]
    const quantity = Number(item.quantity)
    const total = Number(operation.total)
    const rate = Number(operation.exchange_rate)
    const currency = String(operation.currency || 'USD').toUpperCase()
    const totalUsd = ['VES', 'BS', 'BOLIVARES'].includes(currency) ? total / rate : total
    if (quantity > 0 && totalUsd > 0 && Number.isFinite(totalUsd)) item.unit_cost_usd = Number((totalUsd / quantity).toFixed(6))
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
  if (name === 'get_financial_accounts') {
    return db(supabaseUrl, serviceKey, 'financial_accounts?is_active=eq.true&select=id,name,account_type,currency,aliases&order=name')
  }
  if (name === 'get_financial_summary') {
    return db(supabaseUrl, serviceKey, 'rpc/fn_get_restaurant_financial_summary', { method: 'POST', body: JSON.stringify({ p_start: args.start_date, p_end: args.end_date }) })
  }
  if (name === 'prepare_operation') {
    const hydratedOperation = await hydratePurchaseItems(supabaseUrl, serviceKey, { ...args, items: Array.isArray(args.items) ? args.items : [] })
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
    if (['expense', 'income'].includes(String(pending[0].extracted_data?.type))) {
      try {
        return await db(supabaseUrl, serviceKey, 'rpc/fn_ai_finalize_financial_operation', { method: 'POST', body: JSON.stringify({ p_draft_id: pending[0].id, p_profile_id: identities[0].profile_id }) })
      } catch (error) {
        return { ok: false, message: error instanceof Error ? `No pude registrar la operación: ${error.message}` : 'No pude registrar la operación financiera.' }
      }
    }
    if (['transfer','receivable','receivable_collection','tip','tip_distribution','employee_advance','loan','loan_payment','bank_fee','adjustment'].includes(String(pending[0].extracted_data?.type))) {
      try {
        return await db(supabaseUrl, serviceKey, 'rpc/fn_ai_finalize_restaurant_operation', { method: 'POST', body: JSON.stringify({ p_draft_id: pending[0].id, p_profile_id: identities[0].profile_id }) })
      } catch (error) {
        return { ok: false, message: error instanceof Error ? `No pude registrar el movimiento: ${error.message}` : 'No pude registrar el movimiento administrativo.' }
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

async function telegramFile(fileId: string, telegramToken: string) {
  const lookup = await fetch(`https://api.telegram.org/bot${telegramToken}/getFile?file_id=${encodeURIComponent(fileId)}`)
  if (!lookup.ok) throw new Error(`telegram_file_lookup_${lookup.status}`)
  const fileData = await lookup.json()
  if (!fileData.result?.file_path) throw new Error('telegram_file_path_missing')
  const file = await fetch(`https://api.telegram.org/file/bot${telegramToken}/${fileData.result.file_path}`)
  if (!file.ok) throw new Error(`telegram_file_download_${file.status}`)
  return { bytes: new Uint8Array(await file.arrayBuffer()), path: String(fileData.result.file_path) }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function inspectBusinessImage(fileId: string, telegramToken: string, groqKey: string, caption = '') {
  const file = await telegramFile(fileId, telegramToken)
  if (file.bytes.length > 3_500_000) throw new Error('image_too_large')
  const extension = file.path.split('.').pop()?.toLowerCase()
  const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'
  const imageUrl = `data:${mimeType};base64,${bytesToBase64(file.bytes)}`
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      temperature: 0,
      max_completion_tokens: 1400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analiza esta imagen administrativa de FullChinaVzla. Puede ser factura, ticket, nota de entrega o comprobante de pago móvil. Transcribe únicamente datos visibles y nunca inventes. Identifica: tipo de documento; proveedor/comercio; fecha y hora; número de factura; artículos con descripción, cantidad, unidad, precio unitario y subtotal; total, moneda e impuestos; banco emisor/receptor; monto pagado; referencia; titular o beneficiario; estado del pago. Señala claramente cada dato ilegible, dudoso o ausente. Si hay factura y pago en la misma imagen, sepáralos. Texto adjunto del usuario: ${caption || '(ninguno)'}`,
          },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
    }),
  })
  if (!response.ok) throw new Error(`vision_${response.status}_${(await response.text()).slice(0, 180)}`)
  const result = await response.json()
  const description = result.choices?.[0]?.message?.content?.trim()
  if (!description) throw new Error('vision_empty_response')
  return `El usuario envió una imagen. Análisis visual fiel:\n${description}\nUsa estos datos junto con el texto adjunto. Pregunta por cualquier dato obligatorio ausente o dudoso y muestra un borrador antes de registrar.`
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
    let inputKind = 'text'
    if (message.voice?.file_id) {
      inputKind = 'voice'
      text = await transcribe(message.voice.file_id, telegramToken, groqKey)
    } else if (message.photo?.length) {
      inputKind = 'photo'
      const bestPhoto = message.photo[message.photo.length - 1]
      try {
        text = await inspectBusinessImage(bestPhoto.file_id, telegramToken, groqKey, message.caption || '')
      } catch (error) {
        console.error('Image analysis failed:', error instanceof Error ? error.message : 'unknown')
        text = error instanceof Error && error.message === 'image_too_large'
          ? 'La imagen supera el tamaño que puedo analizar. Pídele al usuario reenviarla como foto comprimida o captura de pantalla.'
          : 'No pude leer la imagen con suficiente claridad. Pídele al usuario una foto más nítida, completa, de frente y con buena iluminación.'
      }
    } else if (message.document?.file_id && /^image\/(jpeg|png|webp)$/i.test(message.document.mime_type || '')) {
      inputKind = 'image_document'
      try {
        text = await inspectBusinessImage(message.document.file_id, telegramToken, groqKey, message.caption || '')
      } catch (error) {
        console.error('Image document analysis failed:', error instanceof Error ? error.message : 'unknown')
        text = error instanceof Error && error.message === 'image_too_large'
          ? 'La imagen supera el tamaño que puedo analizar. Pídele al usuario reenviarla como foto comprimida o captura de pantalla.'
          : 'No pude leer la imagen con suficiente claridad. Pídele al usuario una foto más nítida, completa, de frente y con buena iluminación.'
      }
    }
    if (!text.trim()) text = 'El usuario envió un archivo que no pude interpretar. Pídele una foto JPG, PNG o WEBP legible.'

    const conversationId = await remember(supabaseUrl, serviceKey, chatId, userId, 'user', text, { telegram_message_id: message.message_id, input_kind: inputKind })
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
