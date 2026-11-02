import { useCallback, useEffect, useState } from 'react'
import { BellRing, BellOff, LoaderCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './DashboardPushSettings.css'

type Props = { role: 'owner' | 'manager' | 'cashier'; isDrawerOpen: boolean; promptOnEntry?: boolean }

const DISMISSED_PROMPT_KEY = 'fullchina-push-prompt-dismissed'

function wasEntryPromptDismissed() {
  try { return sessionStorage.getItem(DISMISSED_PROMPT_KEY) === '1' } catch { return false }
}

function dismissEntryPrompt() {
  try { sessionStorage.setItem(DISMISSED_PROMPT_KEY, '1') } catch { /* sesión sin almacenamiento */ }
}

function decodeApplicationServerKey(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function DashboardPushSettings({ role, isDrawerOpen, promptOnEntry = false }: Props) {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preferenceChecked, setPreferenceChecked] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)

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
      if (!canPush) {
        setPreferenceChecked(true)
        return
      }
      setSupported(true)
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await persistSubscription(subscription)
          if (!cancelled) setEnabled(true)
        } else if (
          promptOnEntry && !cancelled
          && Notification.permission !== 'denied'
          && !wasEntryPromptDismissed()
        ) {
          setPromptOpen(true)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No pudimos revisar las notificaciones de este dispositivo.')
      } finally {
        if (!cancelled) setPreferenceChecked(true)
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [persistSubscription, promptOnEntry])

  useEffect(() => {
    const syncSubscriptionState = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        setEnabled(Boolean(await registration.pushManager.getSubscription()))
      } catch { /* otro componente conserva su estado; el próximo ingreso reintenta */ }
    }
    window.addEventListener('fullchina:push-subscription-changed', syncSubscriptionState)
    return () => window.removeEventListener('fullchina:push-subscription-changed', syncSubscriptionState)
  }, [])

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
        window.dispatchEvent(new Event('fullchina:push-subscription-changed'))
        return
      }

      const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY
      if (!publicKey) throw new Error('Falta configurar la clave pública de notificaciones en la aplicación.')
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Las notificaciones no se permitieron. Puedes activarlas desde la configuración de este sitio en el navegador.')

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey) as BufferSource,
      })
      await persistSubscription(subscription)
      setEnabled(true)
      setPromptOpen(false)
      dismissEntryPrompt()
      window.dispatchEvent(new Event('fullchina:push-subscription-changed'))
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
    <>
      {isDrawerOpen && <section className="db-push-settings" aria-label="Notificaciones push">
        <div className="db-push-settings-copy">
          {enabled ? <BellRing size={16} aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />}
          <span><strong>Notificaciones en este dispositivo</strong><small>{supported ? audience : 'Este navegador no admite notificaciones push.'}</small></span>
        </div>
        {supported && <button type="button" onClick={() => void toggle()} disabled={busy} aria-pressed={enabled}>
          {busy ? <LoaderCircle size={14} className="is-spinning" /> : null}
          {enabled ? 'Desactivar' : 'Activar'}
        </button>}
        {error && <p role="alert">{error}</p>}
      </section>}

      {supported && preferenceChecked && promptOpen && !enabled && <div className="db-modal-backdrop db-push-entry-backdrop" role="presentation">
        <section className="db-modal db-push-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="db-push-entry-title" aria-describedby="db-push-entry-description">
          <div className="db-modal-header db-push-entry-header">
            <div className="db-push-entry-heading">
              <span className="db-push-entry-icon"><BellRing size={20} aria-hidden="true" /></span>
              <div>
                <span className="db-modal-eyebrow">Full China · avisos al instante</span>
                <h2 id="db-push-entry-title">Activa las notificaciones</h2>
              </div>
            </div>
            <button className="db-modal-close" type="button" onClick={() => {
              dismissEntryPrompt()
              setPromptOpen(false)
            }} aria-label="Ahora no"><X size={16} /></button>
          </div>
          <div className="db-push-entry-content">
            <p id="db-push-entry-description">{audience} Puedes cambiar esta opción cuando quieras desde la campana.</p>
            {error && <p className="db-push-entry-error" role="alert">{error}</p>}
          </div>
          <div className="db-push-entry-actions">
            <button className="db-modal-secondary" type="button" onClick={() => {
              dismissEntryPrompt()
              setPromptOpen(false)
            }}>Ahora no</button>
            <button className="db-push-entry-primary" type="button" onClick={() => void toggle()} disabled={busy}>
              {busy ? <LoaderCircle size={15} className="is-spinning" /> : <BellRing size={15} />}
              {busy ? 'Activando…' : 'Activar'}
            </button>
          </div>
        </section>
      </div>}
    </>
  )
}
