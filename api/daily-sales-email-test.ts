import { createClient } from '@supabase/supabase-js'
import { sendReport } from './daily-sales-email.js'

const environment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const TEST_RECIPIENT = '1803andrea14@gmail.com'

export async function POST(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url)
    const configuredOrigin = environment.DAILY_SALES_REPORT_PUBLIC_URL?.trim()
      || environment.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      || 'https://fullchinavzla.vercel.app'
    const productionOrigin = new URL(/^https?:\/\//i.test(configuredOrigin) ? configuredOrigin : `https://${configuredOrigin}`).origin
    const requestOrigin = request.headers.get('origin')
    if (!requestOrigin || (requestOrigin !== requestUrl.origin && requestOrigin !== productionOrigin)) {
      return Response.json({ error: 'Origen no permitido.' }, { status: 403 })
    }

    const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    const supabaseUrl = environment.SUPABASE_URL ?? environment.VITE_SUPABASE_URL
    const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY
    if (!accessToken || !supabaseUrl || !serviceKey || !environment.CRON_SECRET) {
      return Response.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: 'fullchinavzla' },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !authData.user) return Response.json({ error: 'La sesión venció. Inicia sesión otra vez.' }, { status: 401 })

    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('role,is_active').eq('id', authData.user.id).maybeSingle()
    if (profileError || !profile?.is_active || profile.role !== 'owner') {
      return Response.json({ error: 'Solo la cuenta propietaria puede enviar este correo de prueba.' }, { status: 403 })
    }

    const reportRequest = new Request(
      `${requestUrl.origin}/api/daily-sales-email?sample=1&to=${encodeURIComponent(TEST_RECIPIENT)}`,
      { headers: { authorization: `Bearer ${environment.CRON_SECRET}` } },
    )
    const reportResponse = await sendReport(reportRequest)
    const responseBody = await reportResponse.json().catch(() => ({})) as { error?: string; sent?: boolean; reportDate?: string }
    if (!reportResponse.ok) {
      return Response.json({ error: responseBody.error ?? 'No se pudo enviar el correo de prueba.' }, { status: reportResponse.status })
    }
    return Response.json({ sent: true, recipient: TEST_RECIPIENT, reportDate: responseBody.reportDate })
  } catch (error) {
    console.error('No se pudo enviar el correo de prueba del reporte:', error instanceof Error ? error.message : 'error desconocido')
    return Response.json({ error: 'No se pudo enviar el correo de prueba.' }, { status: 500 })
  }
}
