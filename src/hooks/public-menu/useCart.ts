import { useEffect, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { WebOrderCartItem } from '../../lib/publicOrders'
import { CART_KEY } from '../../lib/publicMenuConfig'
import { cartLineKey } from '../../lib/publicMenuFormat'
import { getPublicCartLimitViolation } from '../../lib/publicOrderRules'
import { type CheckoutStep } from '../../lib/publicMenuTypes'

interface UseCartArgs {
  cart: WebOrderCartItem[]
  cartOpen: boolean
  cartRef: RefObject<WebOrderCartItem[]>
  setCart: Dispatch<SetStateAction<WebOrderCartItem[]>>
  setCartOpen: Dispatch<SetStateAction<boolean>>
  setClosingCart: Dispatch<SetStateAction<boolean>>
  setDeletingKeys: Dispatch<SetStateAction<string[]>>
  setError: Dispatch<SetStateAction<string>>
  step: CheckoutStep
}

export function useCart({ cart, cartOpen, cartRef, setCart, setCartOpen, setClosingCart, setDeletingKeys, setError, step }: UseCartArgs) {
  useEffect(() => { cartRef.current = cart }, [cart, cartRef])
  const commitCart = (update: WebOrderCartItem[] | ((current: WebOrderCartItem[]) => WebOrderCartItem[])) => {
    const next = typeof update === 'function' ? update(cartRef.current) : update
    cartRef.current = next
    setCart(next)
  }
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  const updateQuantity = (itemKey: string, delta: number, legacyNotes?: string) => {
    const target = cartRef.current.find(item => cartLineKey(item) === itemKey || (item.productId === itemKey && (item.notes || '') === (legacyNotes || '')))
    const candidateCart = cartRef.current
      .map(item => (cartLineKey(item) === itemKey || (item.productId === itemKey && (item.notes || '') === (legacyNotes || ''))) ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0)
    const cartLimitViolation = getPublicCartLimitViolation(candidateCart)
    if (delta > 0 && cartLimitViolation) {
      setError(cartLimitViolation === 'presentation-quantity'
        ? 'Puedes pedir hasta 30 unidades de una misma presentación. Reduce la cantidad para continuar; tu pedido se conserva.'
        : 'Tu pedido ya tiene 40 productos distintos. Quita un producto para hacer espacio; lo que ya agregaste se conserva.')
      return
    }
    if (target && cart.length === 1 && target.quantity + delta <= 0 && cartOpen && step === 'cart') {
      const targetKey = cartLineKey(target)
      setClosingCart(true)
      window.setTimeout(() => {
        commitCart(current => current.filter(item => cartLineKey(item) !== targetKey))
        setCartOpen(false)
        setClosingCart(false)
      }, 360)
      return
    }
    commitCart(candidateCart)
  }

  const handleRemoveSidebarItem = (itemKey: string, qty: number) => {
    const key = itemKey
    setDeletingKeys(prev => [...prev, key])
    window.setTimeout(() => {
      updateQuantity(itemKey, -qty)
      setDeletingKeys(prev => prev.filter(k => k !== key))
    }, 220)
  }
  return { total, commitCart, handleRemoveSidebarItem, itemCount, updateQuantity }
}
