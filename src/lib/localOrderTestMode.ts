import type { CustomerRepeatOrder, WebOrderCartItem } from './publicOrders'

export type LocalOrderTestCustomer = {
  firstName: string
  lastName: string
  fullName: string
  identification: string
  phone: string
  email: string
}

export type LocalOrderTestProfile = {
  customer: {
    first_name: string
    last_name: string
    full_name: string
    identification: string
    phone: string
  }
  total_visits: number
  current_cycle_visits: number
  rewards_unlocked: number
  reward_description: string
  next_reward_description: string
  visits_per_reward: number
  available_rewards: Array<{ id: number; cycle_number: number; reward_description: string; unlocked_at: string }>
  redeemed_rewards: Array<{ id: number; cycle_number: number; reward_description: string; unlocked_at: string; redeemed_at: string }>
  has_more: boolean
  visits: Array<{ order_id: string; order_number: string; visited_at: string }>
  account_status: 'active'
}

type Account = { customer: LocalOrderTestCustomer; passwordDigest: string }
type TestOrder = { order: CustomerRepeatOrder; orderNumber: string; visitedAt: string }

let account: Account | null = null
let signedIn = false
let testOrders: TestOrder[] = []
let testFavoriteKeys: string[] = []
let hydrated = false

const STORAGE_KEY = 'fullchina-local-order-test-v1'

export function isLocalOrderTestMode() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('modoPrueba') === '1'
}

function hydrateLocalTestState() {
  if (hydrated) return
  hydrated = true
  if (!isLocalOrderTestMode()) return

  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return
    const state = JSON.parse(saved) as {
      account?: Account | null
      testOrders?: TestOrder[]
      testFavoriteKeys?: string[]
    }
    account = state.account ?? null
    testOrders = Array.isArray(state.testOrders) ? state.testOrders : []
    testFavoriteKeys = Array.isArray(state.testFavoriteKeys) ? state.testFavoriteKeys : []
    // A page reload returns the synthetic customer to the sign-in state.
    signedIn = false
  } catch {
    account = null
    testOrders = []
    testFavoriteKeys = []
  }
}

function persistLocalTestState() {
  if (!isLocalOrderTestMode()) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ account, testOrders, testFavoriteKeys }))
  } catch {
    // The in-memory test flow remains usable when browser storage is unavailable.
  }
}

async function digestPassword(password: string) {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, '').toLocaleLowerCase('es-VE')
}

function sameCustomerIdentification(left: string, right: string) {
  const leftDigits = left.replace(/\D/g, '')
  const rightDigits = right.replace(/\D/g, '')
  return Boolean(leftDigits && rightDigits && leftDigits === rightDigits)
}

export async function registerLocalOrderTestCustomer(input: {
  firstName: string
  lastName: string
  identification: string
  phone: string
  email: string | null
  password: string
}) {
  hydrateLocalTestState()
  const identification = input.identification.trim().toUpperCase()
  const phone = input.phone.trim()
  const email = input.email?.trim().toLocaleLowerCase('es-VE') ?? ''
  const identifiers = new Set([identification, phone, email].filter(Boolean).map(normalizeIdentifier))
  if (account && [account.customer.identification, account.customer.phone, account.customer.email].some(value => identifiers.has(normalizeIdentifier(value)))) {
    throw new Error('Ya existe una cuenta local de prueba con esos datos.')
  }

  account = {
    customer: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      identification,
      phone,
      email,
    },
    passwordDigest: await digestPassword(input.password),
  }
  signedIn = false
  testOrders = []
  testFavoriteKeys = []
  persistLocalTestState()
}

export async function loginLocalOrderTestCustomer(identifier: string, password: string) {
  hydrateLocalTestState()
  if (!account) throw new Error('Primero crea una cuenta en este ensayo local.')
  const normalized = normalizeIdentifier(identifier)
  const matches = [account.customer.identification, account.customer.phone, account.customer.email]
    .some(value => Boolean(value) && normalizeIdentifier(value) === normalized)
  if (!matches || await digestPassword(password) !== account.passwordDigest) {
    throw new Error('Los datos de prueba no coinciden. Revisa el identificador y la contraseña.')
  }
  signedIn = true
  return getLocalOrderTestProfile()!
}

export function signOutLocalOrderTestCustomer() {
  hydrateLocalTestState()
  signedIn = false
}

export function getLocalOrderTestCustomer() {
  hydrateLocalTestState()
  return isLocalOrderTestMode() && signedIn ? account?.customer ?? null : null
}

export function getLocalOrderTestOrderProfile() {
  hydrateLocalTestState()
  const customer = getLocalOrderTestCustomer()
  return customer ? { ...customer } : null
}

export function getLocalOrderTestProfile(): LocalOrderTestProfile | null {
  hydrateLocalTestState()
  const customer = getLocalOrderTestCustomer()
  if (!customer) return null
  const visits = testOrders.map(({ order, orderNumber, visitedAt }) => ({
    order_id: order.orderId,
    order_number: orderNumber,
    visited_at: visitedAt,
  }))
  const currentCycleVisits = testOrders.length % 10
  return {
    customer: {
      first_name: customer.firstName,
      last_name: customer.lastName,
      full_name: customer.fullName,
      identification: customer.identification,
      phone: customer.phone,
    },
    total_visits: testOrders.length,
    current_cycle_visits: currentCycleVisits,
    rewards_unlocked: 0,
    reward_description: 'Tu próxima recompensa Full China',
    next_reward_description: 'Tu próxima recompensa Full China',
    visits_per_reward: 10,
    available_rewards: [],
    redeemed_rewards: [],
    has_more: false,
    visits,
    account_status: 'active',
  }
}

export function recordLocalOrderTestOrder(input: {
  orderNumber: string
  orderType: 'takeaway' | 'delivery'
  customerName: string
  customerPhone: string
  customerIdentification: string
  deliveryAddress?: string | null
  customerNotes?: string
  items: WebOrderCartItem[]
}) {
  hydrateLocalTestState()
  const customer = getLocalOrderTestCustomer()
  if (!customer || !sameCustomerIdentification(customer.identification, input.customerIdentification)) return false
  const orderId = `local-test-${crypto.randomUUID()}`
  const order: CustomerRepeatOrder = {
    orderId,
    orderType: input.orderType,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerIdentification: input.customerIdentification,
    deliveryAddress: input.deliveryAddress ?? null,
    deliveryLat: null,
    deliveryLng: null,
    customerNotes: input.customerNotes ?? '',
    items: input.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      available: true,
      quantity: item.quantity,
      notes: item.notes ?? '',
      modifiers: item.modifiers ?? [],
    })),
  }
  testOrders = [{ order, orderNumber: input.orderNumber, visitedAt: new Date().toISOString() }, ...testOrders]
  persistLocalTestState()
  window.dispatchEvent(new Event('fullchina:local-order-test-updated'))
  return true
}

export function getLocalOrderTestOrder(orderId: string) {
  hydrateLocalTestState()
  if (!isLocalOrderTestMode()) return null
  return testOrders.find(entry => entry.order.orderId === orderId)?.order ?? null
}

export function getLocalOrderTestFavorites() {
  hydrateLocalTestState()
  return isLocalOrderTestMode() && signedIn ? [...testFavoriteKeys] : []
}

export function setLocalOrderTestFavorites(keys: string[]) {
  hydrateLocalTestState()
  if (!isLocalOrderTestMode() || !signedIn) throw new Error('Inicia sesión en el perfil local de prueba.')
  testFavoriteKeys = [...new Set(keys.map(key => key.trim()).filter(Boolean))]
  persistLocalTestState()
  return [...testFavoriteKeys]
}

export function getLocalOrderTestConfirmationCopy(linkedToProfile: boolean) {
  return linkedToProfile
    ? {
        body: 'El pedido se guardó en el historial local de este perfil. No se registró en Full China ni se envió por WhatsApp.',
        title: 'Pedido sintético guardado',
        history: 'Quedó asociado al perfil de prueba y su historial local.',
        time: 'Ahora',
      }
    : {
        body: 'La confirmación se simuló sin guardar un pedido en un perfil. No se registró en Full China ni se envió por WhatsApp.',
        title: 'Ensayo no asociado a un perfil',
        history: 'Inicia sesión en el perfil local con la misma cédula para verificar el historial.',
        time: '·',
      }
}
