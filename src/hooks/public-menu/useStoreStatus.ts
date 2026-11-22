import { useRef, useCallback, useEffect, useState, useMemo, type Dispatch, type SetStateAction, type RefObject } from 'react'
import { PUBLIC_MENU_WELCOME_DISMISSED_KEY } from '../../lib/publicMenuWelcome'
import { DEFAULT_PUBLIC_ORDER_REELS, getPublicOrderMapEmbedUrl, getPublicOrderPageSettings, DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS, type PublicOrderPageSettings } from '../../lib/publicOrderPageSettings'
import { PUBLIC_WHATSAPP_PHONE, LOCAL_ORDER_TEST_MODE, ORDER_HOURS_BLOCK_ENABLED } from '../../lib/publicMenuConfig'
import { DEFAULT_INSTAGRAM_PROFILE_URL } from '../../lib/publicMenuRuntime'
import { formatStoreTime, formatStoreSchedule, getStoreClock } from '../../lib/publicStoreClock'
import { getPublicPickupSlots } from '../../lib/publicOrderRules'

interface UseStoreStatusArgs {
  closingWelcomeNotice: boolean
  dontShowWelcomeAgain: boolean
  pageSettings: PublicOrderPageSettings
  pageSettingsLoaded: boolean
  pickupTime: string
  setClosingWelcomeNotice: Dispatch<SetStateAction<boolean>>
  setPageSettings: Dispatch<SetStateAction<PublicOrderPageSettings>>
  setPageSettingsLoaded: Dispatch<SetStateAction<boolean>>
  setPickupTime: Dispatch<SetStateAction<string>>
  setShowStoreClosedNotice: Dispatch<SetStateAction<boolean>>
  setShowWelcomeNotice: Dispatch<SetStateAction<boolean>>
  showStoreClosedNotice: boolean
  showWelcomeNotice: boolean
  storeClosedNoticeButtonRef: RefObject<HTMLButtonElement | null>
  welcomeNoticeButtonRef: RefObject<HTMLButtonElement | null>
}

export function useStoreStatus({ closingWelcomeNotice, dontShowWelcomeAgain, pageSettings, pageSettingsLoaded, pickupTime, setClosingWelcomeNotice, setPageSettings, setPageSettingsLoaded, setPickupTime, setShowStoreClosedNotice, setShowWelcomeNotice, showStoreClosedNotice, showWelcomeNotice, storeClosedNoticeButtonRef, welcomeNoticeButtonRef }: UseStoreStatusArgs) {
  const welcomeCloseTimeoutRef = useRef<number | null>(null)
  const dismissWelcomeNotice = useCallback(() => {
    if (closingWelcomeNotice) return
    if (dontShowWelcomeAgain) {
      try { localStorage.setItem(PUBLIC_MENU_WELCOME_DISMISSED_KEY, 'true') } catch { /* la bienvenida se cierra aunque el navegador bloquee el almacenamiento */ }
    }
    setClosingWelcomeNotice(true)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220
    welcomeCloseTimeoutRef.current = window.setTimeout(() => {
      setShowWelcomeNotice(false)
      setClosingWelcomeNotice(false)
      welcomeCloseTimeoutRef.current = null
    }, duration)
  }, [closingWelcomeNotice, dontShowWelcomeAgain, setClosingWelcomeNotice, setShowWelcomeNotice])
  const dismissWelcomeNoticeRef = useRef(dismissWelcomeNotice)
  dismissWelcomeNoticeRef.current = dismissWelcomeNotice

  useEffect(() => {
    if (!showStoreClosedNotice || showWelcomeNotice) return
    storeClosedNoticeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowStoreClosedNotice(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showStoreClosedNotice, showWelcomeNotice, setShowStoreClosedNotice, storeClosedNoticeButtonRef])

  useEffect(() => {
    if (!showWelcomeNotice) return
    welcomeNoticeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissWelcomeNoticeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showWelcomeNotice, welcomeNoticeButtonRef])

  useEffect(() => () => {
    if (welcomeCloseTimeoutRef.current !== null) window.clearTimeout(welcomeCloseTimeoutRef.current)
  }, [])
  const currentInstagramReels = pageSettings.contactReels.length ? pageSettings.contactReels : DEFAULT_PUBLIC_ORDER_REELS
  const publicWhatsappPhone = (pageSettings.contactWhatsapp || PUBLIC_WHATSAPP_PHONE).replace(/\D/g, '')
  const publicInstagramUrl = pageSettings.contactInstagramUrl || DEFAULT_INSTAGRAM_PROFILE_URL
  const publicFacebookUrl = pageSettings.contactFacebookUrl
  const formattedOpenTime = formatStoreTime(pageSettings.contactOpenTime)
  const formattedCloseTime = formatStoreTime(pageSettings.contactCloseTime)
  const storeScheduleLabel = formatStoreSchedule(pageSettings)
  const mapPreviewUrl = getPublicOrderMapEmbedUrl(pageSettings.contactDirectionsUrl, pageSettings.contactAddress)
  const refreshPublicPageSettings = useCallback(async () => {
    setPageSettings(await getPublicOrderPageSettings())
    setPageSettingsLoaded(true)
  }, [setPageSettings, setPageSettingsLoaded])
  useEffect(() => { void refreshPublicPageSettings().catch(() => setPageSettingsLoaded(true)) }, [refreshPublicPageSettings, setPageSettingsLoaded])
  const [storeClock, setStoreClock] = useState(() => getStoreClock(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS))
  useEffect(() => {
    setStoreClock(getStoreClock(pageSettings))
    const timer = window.setInterval(() => setStoreClock(getStoreClock(pageSettings)), 60_000)
    return () => window.clearInterval(timer)
  }, [pageSettings])
  const isStoreOpen = LOCAL_ORDER_TEST_MODE || pageSettings.storeStatusMode === 'open' || (pageSettings.storeStatusMode !== 'closed' && storeClock.isOpen)
  const isAcceptingOrders = LOCAL_ORDER_TEST_MODE || pageSettings.storeStatusMode === 'open' || (pageSettings.storeStatusMode !== 'closed' && storeClock.acceptingOrders)
  useEffect(() => {
    if (!pageSettingsLoaded) return
    setShowStoreClosedNotice(ORDER_HOURS_BLOCK_ENABLED && !LOCAL_ORDER_TEST_MODE && !isAcceptingOrders)
  }, [isAcceptingOrders, pageSettingsLoaded, setShowStoreClosedNotice])
  const pickupSlots = useMemo(
    () => getPublicPickupSlots(storeClock.nowMinutes, pageSettings.contactOpenTime, pageSettings.contactCloseTime),
    [storeClock.nowMinutes, pageSettings.contactOpenTime, pageSettings.contactCloseTime],
  )
  useEffect(() => {
    // Si la hora elegida ya pasó (el reloj avanza), se vuelve a "Lo antes posible".
    if (pickupTime !== 'asap' && !pickupSlots.includes(pickupTime)) setPickupTime('asap')
  }, [pickupSlots, pickupTime, setPickupTime])
  const blockClosedStoreAdd = () => {
    if (!pageSettingsLoaded || !ORDER_HOURS_BLOCK_ENABLED || isAcceptingOrders) return false
    setShowStoreClosedNotice(true)
    return true
  }
  return { currentInstagramReels, blockClosedStoreAdd, publicWhatsappPhone, formattedOpenTime, formattedCloseTime, publicInstagramUrl, publicFacebookUrl, mapPreviewUrl, isStoreOpen, storeScheduleLabel, pickupSlots, dismissWelcomeNotice }
}
