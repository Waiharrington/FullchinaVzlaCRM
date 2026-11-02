import { useCallback, useEffect, useState } from 'react'
import { BellRing, BellOff, LoaderCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './DashboardPushSettings.css'

type Props = { role: 'owner' | 'manager' | 'cashier' }

function decodeApplicationServerKey(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function DashboardPushSettings({ role }: Props) {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const persistSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!supabase) throw new Error('El servicio no está configurado.')
    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('El navegador devolvió una suscripción incompleta.')
    const { error: saveError } = await supabase.rpc('fn_register_push_subscription', {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_user_agent: navigator.userAgent.slice(0, 400),
    })
    if (saveError) throw saveError
  }, [])

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      const canPush = typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window
      if (!canPush) return
      setSupported(true)
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await persistSubscription(subscription)
          if (!cancelled) setEnabled(true)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No pudimos revisar las notificaciones de este dispositivo.')
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [persistSubscription])

  const toggle = async () => {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        const endpoint = existing.endpoint
        await existing.unsubscribe()
        const { error: deleteError } = await supabase.rpc('fn_delete_push_subscription', { p_endpoint: endpoint })
        if (deleteError) throw deleteError
        setEnabled(false)
        return
      }

      const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY
      if (!publicKey) throw new Error('Falta configurar la clave pública de notificaciones en la aplicación.')
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Permite las notificaciones en la configuración del navegador para activarlas.')

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey) as BufferSource,
      })
      await persistSubscription(subscription)
      setEnabled(true)
      try {
        await registration.showNotification('Notificaciones activadas', {
          body: 'Listo. Este dispositivo recibirá avisos de Full China.',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: 'push-activation-confirmation',
          data: { url: '/inicio' },
        })
      } catch {
        // The subscription is already saved; a blocked system notification
        // should not make activation appear to have failed.
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cambiar la configuración de notificaciones.')
    } finally {
      setBusy(false)
    }
  }

  const audience = role === 'cashier'
    ? 'Solo recibirás avisos de nuevos pedidos de la web.'
    : 'Recibirás avisos de pedidos y cambios operativos en este dispositivo.'

  return (
    <section className="db-push-settings" aria-label="Notificaciones push">
      <div className="db-push-settings-copy">
        {enabled ? <BellRing size={16} aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />}
        <span><strong>Notificaciones en este dispositivo</strong><small>{supported ? audience : 'Este navegador no admite notificaciones push.'}</small></span>
      </div>
      {supported && <button type="button" onClick={() => void toggle()} disabled={busy} aria-pressed={enabled}>
        {busy ? <LoaderCircle size={14} className="is-spinning" /> : null}
        {enabled ? 'Desactivar' : 'Activar'}
      </button>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
