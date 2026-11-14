export const PUBLIC_MENU_WELCOME_DISMISSED_KEY = 'fullchina_public_welcome_dismissed_v1'
const PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY = 'fullchina_public_welcome_pending_dismiss'
let dismissalConsumedForCurrentLoad = false

export function shouldShowPublicMenuWelcome() {
  try {
    return localStorage.getItem(PUBLIC_MENU_WELCOME_DISMISSED_KEY) !== 'true'
      && sessionStorage.getItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY) !== 'true'
  } catch {
    return true
  }
}

export function consumePublicMenuWelcomeDismissal() {
  if (dismissalConsumedForCurrentLoad) return true
  try {
    const dismissedForCurrentLoad = sessionStorage.getItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY) === 'true'
    const dismissedPermanently = localStorage.getItem(PUBLIC_MENU_WELCOME_DISMISSED_KEY) === 'true'
    if (dismissedForCurrentLoad) sessionStorage.removeItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY)
    dismissalConsumedForCurrentLoad = dismissedForCurrentLoad || dismissedPermanently
    return dismissalConsumedForCurrentLoad
  } catch {
    return false
  }
}

export function markPublicMenuWelcomeDismissedForCurrentLoad(dontShowAgain: boolean) {
  try {
    if (dontShowAgain) {
      localStorage.setItem(PUBLIC_MENU_WELCOME_DISMISSED_KEY, 'true')
      sessionStorage.removeItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY)
    } else {
      sessionStorage.setItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY, 'true')
    }
  } catch { /* la navegación continúa aunque el navegador limite el almacenamiento */ }
}
