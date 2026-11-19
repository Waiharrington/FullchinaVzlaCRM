import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadLocalMode() {
  return import('./localOrderTestMode')
}

describe('ensayo local de perfil e historial de pedidos', () => {
  beforeEach(() => {
    vi.resetModules()
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/pedir?modoPrueba=1')
  })

  afterEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
    vi.resetModules()
  })

  it('registra e inicia sesión con identificador y conserva la cuenta al recargar', async () => {
    let localMode = await loadLocalMode()
    await localMode.registerLocalOrderTestCustomer({
      firstName: 'Cliente',
      lastName: 'Prueba',
      identification: 'V-12345678',
      phone: '04141234567',
      email: 'cliente@example.test',
      password: 'Clave-ensayo-1',
    })

    expect(localMode.getLocalOrderTestCustomer()).toBeNull()
    await expect(localMode.loginLocalOrderTestCustomer('V-12345678', 'incorrecta'))
      .rejects.toThrow('Los datos de prueba no coinciden.')
    const profile = await localMode.loginLocalOrderTestCustomer('cliente@example.test', 'Clave-ensayo-1')
    expect(profile.customer.full_name).toBe('Cliente Prueba')
    expect(profile.current_cycle_visits).toBe(0)

    vi.resetModules()
    localMode = await loadLocalMode()
    expect(localMode.getLocalOrderTestCustomer()).toBeNull()
    expect(localMode.getLocalOrderTestProfile()).toBeNull()
    const afterReload = await localMode.loginLocalOrderTestCustomer('04141234567', 'Clave-ensayo-1')
    expect(afterReload.customer.identification).toBe('V-12345678')
    const { getCustomerOrderProfile } = await import('./customerOrderProfile')
    await expect(getCustomerOrderProfile()).resolves.toMatchObject({
      firstName: 'Cliente',
      lastName: 'Prueba',
      fullName: 'Cliente Prueba',
      identification: 'V-12345678',
      phone: '04141234567',
      email: 'cliente@example.test',
    })
  })

  it('asocia la compra simulada con el perfil, guarda sus detalles para repetirla y rechaza otra identificación', async () => {
    const localMode = await loadLocalMode()
    await localMode.registerLocalOrderTestCustomer({
      firstName: 'Cliente',
      lastName: 'Prueba',
      identification: 'V-87654321',
      phone: '04149876543',
      email: null,
      password: 'Clave-ensayo-2',
    })
    const orderInput = {
      orderNumber: 'PRUEBA-ABC123',
      orderType: 'delivery' as const,
      customerName: 'Cliente Prueba',
      customerPhone: '04149876543',
      customerIdentification: 'V-00000000',
      deliveryAddress: 'Dirección sintética, Base Aragua',
      customerNotes: 'Entregar en recepción de prueba',
      items: [{
        productId: 'rice-cantonese',
        productName: 'Arroz Cantonés — Medio Kilo',
        price: 9,
        quantity: 2,
        notes: 'Sin camarón, por favor.',
        modifiers: [{ optionId: 'shrimp', quantity: 0 }],
      }],
    }
    expect(localMode.recordLocalOrderTestOrder(orderInput)).toBe(false)
    expect(localMode.getLocalOrderTestProfile()).toBeNull()

    await localMode.loginLocalOrderTestCustomer('V-87654321', 'Clave-ensayo-2')
    expect(localMode.recordLocalOrderTestOrder(orderInput)).toBe(false)
    expect(localMode.getLocalOrderTestProfile()?.total_visits).toBe(0)

    expect(localMode.recordLocalOrderTestOrder({ ...orderInput, customerIdentification: 'V-87654321' })).toBe(true)
    const profile = localMode.getLocalOrderTestProfile()
    expect(profile?.total_visits).toBe(1)
    expect(profile?.current_cycle_visits).toBe(1)
    expect(profile?.visits[0]?.order_number).toBe('PRUEBA-ABC123')

    const visit = profile!.visits[0]!
    const order = localMode.getLocalOrderTestOrder(visit.order_id)
    expect(order).toMatchObject({
      orderType: 'delivery',
      deliveryAddress: 'Dirección sintética, Base Aragua',
      customerNotes: 'Entregar en recepción de prueba',
      items: [{
        productName: 'Arroz Cantonés — Medio Kilo',
        quantity: 2,
        notes: 'Sin camarón, por favor.',
        modifiers: [{ optionId: 'shrimp', quantity: 0 }],
      }],
    })

    const { getCustomerOrderForRepeat } = await import('./publicOrders')
    await expect(getCustomerOrderForRepeat(visit.order_id)).resolves.toMatchObject({
      orderId: visit.order_id,
      orderType: 'delivery',
      customerIdentification: 'V-87654321',
      items: [{ productId: 'rice-cantonese', quantity: 2, notes: 'Sin camarón, por favor.' }],
    })
  })

  it('mantiene favoritos de prueba solo para el perfil autenticado', async () => {
    const localMode = await loadLocalMode()
    await localMode.registerLocalOrderTestCustomer({
      firstName: 'Cliente',
      lastName: 'Favorito',
      identification: 'V-11111111',
      phone: '04141111111',
      email: null,
      password: 'Clave-ensayo-3',
    })
    expect(localMode.getLocalOrderTestFavorites()).toEqual([])
    expect(() => localMode.setLocalOrderTestFavorites(['rice']))
      .toThrow('Inicia sesión en el perfil local de prueba.')
    await localMode.loginLocalOrderTestCustomer('V-11111111', 'Clave-ensayo-3')
    expect(localMode.setLocalOrderTestFavorites(['rice', 'rice', '', 'lumpias']))
      .toEqual(['rice', 'lumpias'])
    localMode.signOutLocalOrderTestCustomer()
    expect(localMode.getLocalOrderTestFavorites()).toEqual([])
  })

  it('explica el resultado correcto cuando la simulación no se asocia a un perfil', async () => {
    const localMode = await loadLocalMode()
    expect(localMode.getLocalOrderTestConfirmationCopy(false)).toMatchObject({
      title: 'Ensayo no asociado a un perfil',
      history: 'Inicia sesión en el perfil local con la misma cédula para verificar el historial.',
      time: '·',
    })
    expect(localMode.getLocalOrderTestConfirmationCopy(true)).toMatchObject({
      title: 'Pedido sintético guardado',
      history: 'Quedó asociado al perfil de prueba y su historial local.',
      time: 'Ahora',
    })
  })
})
