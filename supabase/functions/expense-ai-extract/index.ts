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
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function parseJson(raw: string) {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('La IA no devolvió los datos del recibo.')
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}

const system = `Eres un asistente que lee recibos de pago y comprobantes de gastos para FullChinaVzla, un restaurante de comida china en Venezuela. Responde SOLO JSON sin markdown con esta forma exacta:
{"description":string|null,"amount":number|null,"currency":"VES"|"USD"|null,"reference":string|null}.
Extrae el concepto o descripción real del gasto a partir del texto visible del comprobante; redacta una descripción breve y clara en español, conservando el comercio o concepto cuando esté impreso. Extrae el monto efectivamente pagado (no el saldo, comisión o monto disponible) y la moneda indicada. Si el monto está expresado en bolívares, usa VES; si está en dólares, USD. Extrae el número de referencia/operación si aparece. No devuelvas ni inventes un proveedor separado, una cuenta bancaria, método de pago, categoría, fecha o datos que no se pidieron. No confundas el número de teléfono, documento, cuenta, saldo o comisión con el monto. No inventes información; si un campo no se distingue, devuelve null. Los importes JSON usan punto decimal. Si el recibo no es legible o no muestra un gasto, devuelve los campos como null.`

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
    if (roleError || !['owner', 'manager'].includes(String(role))) return json({ message: 'No tienes acceso a gastos.' }, 403)

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
        { type: 'text', text: 'Lee este comprobante de pago o recibo de gasto. Devuelve el concepto, el monto efectivamente pagado, la moneda y la referencia visibles. No devuelvas el proveedor como campo separado.' },
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
      userContent = `Transcripción del audio del usuario sobre el gasto: ${transcription}`
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: image ? (Deno.env.get('GROQ_VISION_MODEL') || 'qwen/qwen3.8-27b') : (Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b'),
        temperature: 0, max_completion_tokens: 700,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    })
    if (!response.ok) throw new Error(`No se pudo analizar el recibo (${response.status}).`)
    const raw = String((await response.json()).choices?.[0]?.message?.content ?? '')
    const extracted = parseJson(raw)
    const description = typeof extracted.description === 'string' && extracted.description.trim() ? extracted.description.trim().slice(0, 240) : null
    const rawAmount = typeof extracted.amount === 'number' ? extracted.amount : Number(String(extracted.amount ?? '').replace(',', '.'))
    const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null
    const currency = extracted.currency === 'VES' || extracted.currency === 'USD' ? extracted.currency : null
    const reference = typeof extracted.reference === 'string' && extracted.reference.trim() ? extracted.reference.trim().slice(0, 120) : null
    const draft = { description, amount, currency, reference }
    if (draft.amount == null && !draft.description) return json({ message: 'No se distinguieron el concepto ni el monto. Intenta con una imagen más nítida o un audio más detallado.' }, 422)
    return json({ draft })
  } catch (error) {
    console.error('expense-ai-extract:', error)
    return json({ message: error instanceof Error ? error.message : 'No se pudo analizar el recibo.' }, 500)
  }
})
