import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const environment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Request = { method?: string; body?: unknown }
type Response = { status: (code: number) => Response; json: (body: Record<string, unknown>) => void }
type OutboxEvent = {
  id: string
  target_roles: string[]
  payload: { title?: string; body?: string; url?: string; tag?: string }
}
type SubscriptionRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
type ProfileRow = { id: string; role: string; is_active: boolean }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default async function pushDispatch(request: Request, response: Response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' })

  const body = typeof request.body === 'string'
    ? (() => { try { return JSON.parse(request.body) as Record<string, unknown> } catch { return {} } })()
    : request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  if (!EVENT_ID_PATTERN.test(eventId)) return response.status(400).json({ error: 'invalid_event_id' })

  const supabaseUrl = environment.SUPABASE_URL ?? environment.VITE_SUPABASE_URL
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublicKey = environment.PUSH_VAPID_PUBLIC_KEY
  const vapidPrivateKey = environment.PUSH_VAPID_PRIVATE_KEY
  const vapidSubject = environment.PUSH_VAPID_SUBJECT
  if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return response.status(503).json({ error: 'push_sender_not_configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'fullchinavzla' },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: claimed, error: claimError } = await admin.rpc('fn_claim_push_event', { p_event_id: eventId })
  if (claimError) return response.status(500).json({ error: 'event_claim_failed' })
  const event = (claimed as OutboxEvent[] | null)?.[0]
  if (!event) return response.status(200).json({ ok: true, skipped: true })

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    const { data: subscriptions, error: subscriptionsError } = await admin
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth')
    if (subscriptionsError) throw subscriptionsError

    const rows = (subscriptions ?? []) as SubscriptionRow[]
    const userIds = [...new Set(rows.map(row => row.user_id))]
    const { data: profiles, error: profilesError } = userIds.length
      ? await admin.from('profiles').select('id,role,is_active').in('id', userIds)
      : { data: [], error: null }
    if (profilesError) throw profilesError
    const roleByUser = new Map(((profiles ?? []) as ProfileRow[]).map(profile => [profile.id, profile.is_active ? profile.role : 'inactive']))
    const allowedRoles = new Set(event.target_roles)
    const payload = JSON.stringify({
      title: event.payload.title || 'Full China',
      body: event.payload.body || 'Tienes una novedad en Full China.',
      url: /^\/(?!\/)/.test(event.payload.url || '') ? event.payload.url : '/inicio',
      tag: event.payload.tag || event.id,
    })

    const failed: string[] = []
    for (const subscription of rows) {
      if (!allowedRoles.has(roleByUser.get(subscription.user_id) || '')) continue
      const target = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }
      let delivered = false
      for (let attempt = 0; attempt < 2 && !delivered; attempt++) {
        try {
          await webpush.sendNotification(target, payload, { TTL: 90, urgency: 'high' })
          delivered = true
        } catch (cause) {
          const statusCode = Number((cause as { statusCode?: unknown })?.statusCode)
          if (statusCode === 404 || statusCode === 410) {
            const { error: removeError } = await admin.from('push_subscriptions').delete().eq('id', subscription.id)
            if (removeError) failed.push(removeError.message)
            delivered = true
          } else if (attempt === 0) await sleep(250)
          else failed.push(cause instanceof Error ? cause.message : 'push_delivery_failed')
        }
      }
    }

    if (failed.length) throw new Error(failed.slice(0, 3).join(' · '))
    const { error: finishError } = await admin.rpc('fn_finish_push_event', { p_event_id: event.id, p_error: null })
    if (finishError) throw finishError
    return response.status(200).json({ ok: true })
  } catch (cause) {
    await admin.rpc('fn_finish_push_event', {
      p_event_id: event.id,
      p_error: cause instanceof Error ? cause.message : 'push_delivery_failed',
    })
    return response.status(500).json({ error: 'push_delivery_failed' })
  }
}
