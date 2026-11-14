export const PUBLIC_MENU_WELCOME_DISMISSED_KEY = 'fullchina_public_welcome_dismissed_v1'
const PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY = 'fullchina_public_welcome_pending_dismiss'

export function shouldShowPublicMenuWelcome() {
  try {
    return localStorage.getItem(PUBLIC_MENU_WELCOME_DISMISSED_KEY) !== 'true'
      && sessionStorage.getItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY) !== 'true'
  } catch {
    return true
  }
}

export function consumePublicMenuWelcomeDismissal() {
  try {
    const dismissedForCurrentLoad = sessionStorage.getItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY) === 'true'
    sessionStorage.removeItem(PUBLIC_MENU_WELCOME_PENDING_DISMISS_KEY)
    return dismissedForCurrentLoad || localStorage.getItem(PUBLIC_MENU_WELCOME_DISMISSED_KEY) === 'true'
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
