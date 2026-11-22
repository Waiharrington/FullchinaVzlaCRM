import { lazy } from 'react'

export const loadCustomerLoyaltyProfile = () => import('../CustomerLoyaltyProfile')
export const CustomerLoyaltyProfile = lazy(() => loadCustomerLoyaltyProfile().then(module => ({ default: module.CustomerLoyaltyProfile })))
export const preloadCustomerLoyaltyProfile = () => { void loadCustomerLoyaltyProfile().catch(() => undefined) }
export const loadPublicMenuContactView = () => import('../PublicMenuContactView')
export const PublicMenuContactView = lazy(() => loadPublicMenuContactView().then(module => ({ default: module.PublicMenuContactView })))
export const preloadPublicMenuContactView = () => { void loadPublicMenuContactView().catch(() => undefined) }
