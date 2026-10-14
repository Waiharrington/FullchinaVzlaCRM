import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
})

function asBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function parseJson(raw: string) {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('La IA no devolvió una factura estructurada.')
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}

function normalizeDraft(raw: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
  const amount = (value: unknown) => {
    const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
    return Number.isFinite(number) && number >= 0 ? number : null
  }
  const items = Array.isArray(raw.items) ? raw.items.map((value) => {
    const item = value as Record<string, unknown>
    return {
      description: text(item.description) ?? '',
      quantity: amount(item.quantity) ?? 1,
      unit: text(item.unit),
      unitCost: amount(item.unitCost ?? item.unit_cost),
      kind: item.kind === 'expense' ? 'expense' : 'purchase',
    }
  }).filter((item) => item.description) : []
  const missingFields = raw.missingFields ?? raw.missing_fields
  return {
    supplier: text(raw.supplier),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? '')) ? raw.date : null,
    invoiceNumber: text(raw.invoiceNumber ?? raw.invoice_number),
    currency: raw.currency === 'VES' || raw.currency === 'USD' ? raw.currency : null,
    total: amount(raw.total),
    items,
    missingFields: Array.isArray(missingFields)
      ? missingFields.filter((field): field is string => typeof field === 'string')
      : [],
  }
}

const system = `Extrae una factura de proveedor para FullChinaVzla. Responde SOLO JSON sin markdown:
{"supplier":string|null,"date":"YYYY-MM-DD"|null,"invoiceNumber":string|null,"currency":"VES"|"USD"|null,"total":number|null,"items":[{"description":string,"quantity":number,"unit":string|null,"unitCost":number|null,"kind":"purchase"|"expense"}],"missingFields":string[]}.
No inventes información. Conserva cada renglón y sus decimales. Usa punto decimal en números JSON. "purchase" es insumo que entra al inventario; "expense" es consumo administrativo que no entra a inventario. Clasifica como gasto solo si hay evidencia clara; el usuario puede corregirlo. Nunca infieras una cuenta bancaria ni marques la factura pagada. Si solo hay un total pero faltan costos por ítem, deja unitCost null e indica el faltante. Si el documento está ilegible, devuelve items vacío.`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ message: 'Método no permitido.' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!url || !anonKey || !groqKey) return json({ message: 'El servicio de IA no está configurado.' }, 503)
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ message: 'Inicia sesión para usar esta función.' }, 401)
    const actor = createClient(url, anonKey, {
      db: { schema: 'fullchinavzla' },
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: authError } = await actor.auth.getUser(token)
    if (authError || !userData.user) return json({ message: 'Sesión inválida.' }, 401)
    const { data: role, error: roleError } = await actor.rpc('get_current_user_role')
    if (roleError || !['owner', 'manager'].includes(String(role))) return json({ message: 'No tienes acceso a compras.' }, 403)

    const body = await request.formData()
    const file = body.get('file')
    const kind = body.get('kind')
    if (!(file instanceof File) || (kind !== 'image' && kind !== 'audio')) return json({ message: 'Selecciona una foto o graba un audio.' }, 400)
    const image = kind === 'image'
    const allowed = image ? ['image/jpeg', 'image/png', 'image/webp'] : ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a']
    if (!allowed.includes(file.type.split(';')[0]) || file.size === 0 || file.size > (image ? 6_000_000 : 15_000_000)) {
      return json({ message: 'Formato no admitido o archivo demasiado grande.' }, 400)
    }

    let userContent: unknown
    if (image) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      userContent = [
        { type: 'text', text: 'Lee esta factura y extrae sus renglones. Los datos dudosos deben quedar vacíos.' },
        { type: 'image_url', image_url: { url: `data:${file.type};base64,${asBase64(bytes)}` } },
      ]
    } else {
      const audio = new FormData()
      audio.append('file', file, file.name)
      audio.append('model', 'whisper-large-v3-turbo')
      audio.append('language', 'es')
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${groqKey}` }, body: audio,
      })
      if (!response.ok) throw new Error(`No se pudo transcribir el audio (${response.status}).`)
      const transcription = String((await response.json()).text ?? '')
      if (!transcription.trim()) return json({ message: 'El audio no contiene datos reconocibles.' }, 422)
      userContent = transcription
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: image ? 'qwen/qwen3.6-27b' : (Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b'),
        temperature: 0, max_completion_tokens: 2400,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      }),
    })
    if (!response.ok) throw new Error(`No se pudo analizar la factura (${response.status}).`)
    const raw = String((await response.json()).choices?.[0]?.message?.content ?? '')
    const draft = normalizeDraft(parseJson(raw))
    if (draft.items.length === 0) return json({ message: 'No se distinguieron artículos. Intenta con una imagen más nítida o un audio más detallado.' }, 422)
    return json({ draft })
  } catch (error) {
    console.error('purchase-ai-extract:', error)
    return json({ message: error instanceof Error ? error.message : 'No se pudo analizar la factura.' }, 500)
  }
})
