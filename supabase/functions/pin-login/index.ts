const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_configuration' }, 500)

  let pin = ''
  try {
    const body = await request.json()
    pin = typeof body?.pin === 'string' ? body.pin : ''
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const sourceIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || forwardedFor || 'unknown'
  const userAgent = request.headers.get('user-agent')?.slice(0, 160) || 'unknown'
  const clientKey = await sha256(`${sourceIp}|${userAgent}`)

  const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }

  let verificationResponse: Response
  try {
    verificationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/fn_verify_pin_login`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Profile': 'fullchinavzla' },
      body: JSON.stringify({ p_pin: pin, p_client_key: clientKey }),
    })
  } catch (error) {
    console.error('PIN verification request failed:', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'login_unavailable' }, 503)
  }

  if (!verificationResponse.ok) {
    console.error('PIN verification failed:', verificationResponse.status)
    return json({ error: 'login_unavailable' }, 503)
  }
  const verification = await verificationResponse.json()

  if (!verification?.ok) {
    if (verification?.error === 'temporarily_locked') {
      return json({
        error: 'temporarily_locked',
        retry_after_seconds: verification.retry_after_seconds,
      }, 429)
    }
    return json({ error: 'invalid_pin' }, 401)
  }

  let linkResponse: Response
  try {
    linkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ type: 'magiclink', email: verification.email }),
    })
  } catch (error) {
    console.error('One-time login token request failed:', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'login_unavailable' }, 503)
  }

  if (!linkResponse.ok) {
    console.error('One-time login token generation failed:', linkResponse.status)
    return json({ error: 'login_unavailable' }, 503)
  }
  const linkData = await linkResponse.json()
  const tokenHash = linkData?.hashed_token || linkData?.properties?.hashed_token
  if (!tokenHash) return json({ error: 'login_unavailable' }, 503)

  return json({ token_hash: tokenHash, email: verification.email })
})
