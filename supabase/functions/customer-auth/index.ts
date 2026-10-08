import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ message: 'Método no permitido.' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !anonKey) return json({ message: 'Servicio de cuentas no configurado.' }, 500)
  const admin = createClient(url, serviceKey, { db: { schema: 'fullchinavzla' }, auth: { persistSession: false, autoRefreshToken: false } })
  const publicClient = createClient(url, anonKey, { db: { schema: 'fullchinavzla' }, auth: { persistSession: false, autoRefreshToken: false } })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return json({ message: 'Solicitud inválida.' }, 400) }
  const action = String(body.action ?? '')
  if (action === 'register') {
    const firstName = String(body.first_name ?? '').trim()
    const lastName = String(body.last_name ?? '').trim()
    const identification = String(body.identification ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = String(body.password ?? '')
    if (!firstName || !lastName || !identification || phone.replace(/\D/g, '').length < 7 || password.length < 8) return json({ message: 'Verifica nombre, apellido, cédula, teléfono y contraseña (mínimo 8 caracteres).' }, 400)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ message: 'El correo no tiene un formato válido.' }, 400)
    const internalEmail = `customer-${crypto.randomUUID()}@accounts.fullchina.invalid`
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: internalEmail, password, email_confirm: true, user_metadata: { customer_account: true } })
    if (createError || !created.user) return json({ message: 'No se pudo crear la cuenta. Verifica los datos o contacta al negocio.' }, 400)
    const { data: account, error: linkError } = await admin.rpc('fn_register_customer_loyalty_account', {
      p_auth_user_id: created.user.id, p_login_email: internalEmail, p_first_name: firstName,
      p_last_name: lastName, p_identification: identification, p_phone: phone, p_email: email || null,
    })
    if (linkError) {
      await admin.auth.admin.deleteUser(created.user.id)
      const message = /duplicate key|already exists/i.test(linkError.message) ? 'Ya existe una cuenta asociada a uno de esos datos. Contacta al negocio para recuperar el acceso.' : 'No se pudo registrar la cuenta. Revisa tus datos e inténtalo de nuevo.'
      console.error('Customer registration link failed:', linkError.message)
      return json({ message }, 409)
    }
    return json({ registered: true, status: account?.status ?? 'active' })
  }

  if (action === 'login') {
    const identifier = String(body.identifier ?? '').trim()
    const password = String(body.password ?? '')
    if (!identifier || !password) return json({ message: 'Escribe tu cédula, teléfono o correo y tu contraseña.' }, 400)
    const { data: internalEmail, error: lookupError } = await admin.rpc('fn_customer_login_email', { p_identifier: identifier })
    if (lookupError || !internalEmail) return json({ message: 'La cédula, el teléfono o el correo y la contraseña no coinciden.' }, 401)
    const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({ email: String(internalEmail), password })
    if (signInError || !signedIn.session) return json({ message: 'Datos de acceso incorrectos.' }, 401)
    return json({ access_token: signedIn.session.access_token, refresh_token: signedIn.session.refresh_token })
  }

  if (action === 'admin-reset-password') {
    const authorization = request.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) return json({ message: 'Debes iniciar sesión como administrador.' }, 401)
    const actorClient = createClient(url, anonKey, { db: { schema: 'fullchinavzla' }, global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
    const { data: actorData, error: actorError } = await actorClient.auth.getUser(token)
    if (actorError || !actorData.user) return json({ message: 'Sesión administrativa inválida.' }, 401)
    const customerId = String(body.customer_id ?? '')
    const nextPassword = String(body.new_password ?? '')
    if (!customerId || nextPassword.length < 8) return json({ message: 'La nueva contraseña debe tener al menos 8 caracteres.' }, 400)
    const { data: authUserId, error: auditError } = await actorClient.rpc('fn_admin_record_customer_password_reset', { p_customer_id: customerId })
    if (auditError || !authUserId) return json({ message: auditError?.message || 'No se pudo autorizar el cambio de clave.' }, 403)
    const { error: updateError } = await admin.auth.admin.updateUserById(String(authUserId), { password: nextPassword })
    if (updateError) {
      console.error('Customer password update failed:', updateError.message)
      return json({ message: 'No se pudo cambiar la contraseña. Inténtalo nuevamente.' }, 500)
    }
    return json({ updated: true })
  }
  return json({ message: 'Acción no reconocida.' }, 400)
})
