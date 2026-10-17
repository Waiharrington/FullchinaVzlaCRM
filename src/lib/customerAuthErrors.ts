type ErrorPayload = { message?: unknown }

function readMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('message' in value)) return null
  const message = (value as ErrorPayload).message
  return typeof message === 'string' && message.trim() ? message.trim() : null
}

export async function customerAuthErrorMessage(error: unknown, responseData?: unknown): Promise<string> {
  const responseMessage = readMessage(responseData)
  if (responseMessage) return responseMessage

  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (context && typeof context === 'object' && 'clone' in context && typeof context.clone === 'function') {
      try {
        const payload: unknown = await (context as Response).clone().json()
        const message = readMessage(payload)
        if (message) return message
      } catch { /* la respuesta puede no traer JSON */ }
    }

    const status = context && typeof context === 'object' && 'status' in context
      ? Number((context as { status?: unknown }).status)
      : NaN
    if (status === 400) return 'Revisa los datos ingresados e inténtalo de nuevo.'
    if (status === 401 || status === 403) return 'Los datos de acceso no coinciden. Verifícalos e inténtalo de nuevo.'
    if (status === 409) return 'Ya existe una cuenta asociada a esos datos. Si ya te registraste, inicia sesión.'
  }

  const errorName = error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name)
    : ''
  if (errorName === 'FunctionsFetchError' || (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))) {
    return 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.'
  }

  return 'No pudimos completar la solicitud. Revisa los datos e inténtalo de nuevo.'
}
