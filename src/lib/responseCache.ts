type ResponseSnapshot = {
  body: ArrayBuffer
  headers: Headers
  status: number
  statusText: string
}

type CacheEntry = ResponseSnapshot & {
  expiresAt: number
  table: string | null
}

type InFlightEntry = {
  table: string | null
  invalidated: boolean
  promise: Promise<ResponseSnapshot>
}

type ResponseCacheOptions = {
  ttlMs: number
  maxEntries: number
  tableDependencies: Record<string, readonly string[]>
  now?: () => number
}

function snapshotResponse(snapshot: ResponseSnapshot) {
  const bodylessStatus = snapshot.status === 204 || snapshot.status === 205 || snapshot.status === 304
  return new Response(bodylessStatus ? null : snapshot.body.slice(0), {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: snapshot.headers,
  })
}

async function readSnapshot(response: Response): Promise<ResponseSnapshot> {
  const body = await response.clone().arrayBuffer()
  const headers = new Headers(response.headers)
  headers.delete('content-encoding')
  headers.delete('content-length')
  headers.delete('transfer-encoding')
  return { body, headers, status: response.status, statusText: response.statusText }
}

export function createResponseCache({ ttlMs, maxEntries, tableDependencies, now = Date.now }: ResponseCacheOptions) {
  const cache = new Map<string, CacheEntry>()
  const inFlight = new Map<string, InFlightEntry>()

  const isAffected = (entryTable: string | null, changedTable: string | null) =>
    changedTable === null || changedTable === '*' || entryTable === changedTable || entryTable === null ||
    (entryTable !== null && (tableDependencies[entryTable] ?? []).includes(changedTable))

  const fetch = async (key: string, table: string | null, load: () => Promise<Response>) => {
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now()) return snapshotResponse(cached)
    if (cached) cache.delete(key)

    let pending = inFlight.get(key)
    if (!pending) {
      const flight: InFlightEntry = {
        table,
        invalidated: false,
        promise: Promise.resolve({ body: new ArrayBuffer(0), headers: new Headers(), status: 500, statusText: 'Internal Server Error' }),
      }
      flight.promise = (async () => {
        const response = await load()
        const snapshot = await readSnapshot(response)
        if (response.ok && !flight.invalidated) {
          cache.set(key, { ...snapshot, expiresAt: now() + ttlMs, table })
          while (cache.size > maxEntries) {
            const oldestKey = cache.keys().next().value
            if (oldestKey === undefined) break
            cache.delete(oldestKey)
          }
        }
        return snapshot
      })()
      pending = flight
      inFlight.set(key, pending)
    }

    try {
      return snapshotResponse(await pending.promise)
    } finally {
      if (inFlight.get(key) === pending) inFlight.delete(key)
    }
  }

  const invalidate = (changedTable: string | null) => {
    for (const [key, entry] of cache) {
      if (isAffected(entry.table, changedTable)) cache.delete(key)
    }
    for (const [key, entry] of inFlight) {
      if (isAffected(entry.table, changedTable)) {
        entry.invalidated = true
        inFlight.delete(key)
      }
    }
  }

  const clear = () => {
    for (const entry of inFlight.values()) entry.invalidated = true
    cache.clear()
    inFlight.clear()
  }

  return { fetch, invalidate, clear }
}
