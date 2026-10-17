import { describe, expect, it } from 'vitest'
import { customerAuthErrorMessage } from './customerAuthErrors'

describe('customerAuthErrorMessage', () => {
  it('prefers the Spanish message returned by customer-auth', async () => {
    await expect(customerAuthErrorMessage(new Error('Edge Function returned a non-2xx status code'), {
      message: 'La cédula debe tener entre 6 y 10 dígitos.',
    })).resolves.toBe('La cédula debe tener entre 6 y 10 dígitos.')
  })

  it('reads a JSON message from the Supabase error response context', async () => {
    const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      name: 'FunctionsHttpError',
      context: new Response(JSON.stringify({ message: 'Datos de acceso incorrectos.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    })

    await expect(customerAuthErrorMessage(error)).resolves.toBe('Datos de acceso incorrectos.')
  })

  it('uses a friendly fallback instead of exposing a technical HTTP error', async () => {
    const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      name: 'FunctionsHttpError',
      context: new Response('not-json', { status: 409 }),
    })

    await expect(customerAuthErrorMessage(error)).resolves.toBe('Ya existe una cuenta asociada a esos datos. Si ya te registraste, inicia sesión.')
  })

  it('explains connection failures in Spanish', async () => {
    await expect(customerAuthErrorMessage(Object.assign(new Error('fetch failed'), { name: 'FunctionsFetchError' })))
      .resolves.toContain('conectar con el servicio')
  })
})
