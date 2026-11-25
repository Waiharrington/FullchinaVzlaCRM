import { supabase } from '../supabase'

export function client() {
  if (!supabase) throw new Error('Supabase no está configurado (revisa el .env)')
  return supabase
}

// --- Productos ---------------------------------------------------------------

export function getErrorMessage(e: unknown, fallback = 'Error inesperado'): string {
  if (!e) return fallback
  if (typeof e === 'string') return e
  if (e instanceof Error && e.message) return e.message
  const obj = e as Record<string, unknown>
  if (typeof obj.message === 'string' && obj.message) return obj.message
  if (typeof obj.error_description === 'string' && obj.error_description) return obj.error_description
  if (typeof obj.details === 'string' && obj.details) return `${obj.message ? `${obj.message}: ` : ''}${obj.details}`
  return fallback
}


const PAGE_SIZE = 500
const PAGE_CONCURRENCY = 4

interface RangeQuery {
  range(from: number, to: number): PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * Lee todas las filas de una consulta paginada. Pide varias páginas a la vez
 * (en vez de una por una) y se detiene cuando alguna llega incompleta.
 * Si `allPages` es false, devuelve la consulta tal cual (una sola petición).
 */
export async function fetchRows(buildQuery: () => RangeQuery & PromiseLike<{ data: unknown; error: unknown }>, allPages: boolean): Promise<Record<string, unknown>[]> {
  if (!allPages) {
    const { data, error } = await buildQuery()
    if (error) throw error
    return (data ?? []) as Record<string, unknown>[]
  }
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += PAGE_SIZE * PAGE_CONCURRENCY) {
    const pages = await Promise.all(Array.from({ length: PAGE_CONCURRENCY }, async (_, i) => {
      const from = offset + i * PAGE_SIZE
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return (data ?? []) as Record<string, unknown>[]
    }))
    for (const page of pages) rows.push(...page)
    if (pages.some(page => page.length < PAGE_SIZE)) return rows
  }
}
