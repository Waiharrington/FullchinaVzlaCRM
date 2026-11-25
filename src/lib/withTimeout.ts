/** Falla si la promesa no responde a tiempo, para ofrecer reintentar. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('La consulta tardó demasiado.')), ms)
    promise.then(resolve, reject).finally(() => window.clearTimeout(timer))
  })
}
