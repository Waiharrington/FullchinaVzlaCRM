'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createQueueProcessor,
  normalizeChatId,
  personalizeMessage,
  nextSendDelay,
  isClientReady,
  STALE_SENDING_MESSAGE,
} = require('../queue')

// --- Fakes ------------------------------------------------------------------

function createLog() {
  const lines = { log: [], warn: [], error: [] }
  return {
    lines,
    log: msg => lines.log.push(String(msg)),
    warn: msg => lines.warn.push(String(msg)),
    error: msg => lines.error.push(String(msg)),
  }
}

// Simula el contrato de la base: rpc('claim_next_whatsapp_message') reclama la
// fila 'queued' más vieja pasándola a 'sending' (el orden atómico real lo
// garantiza FOR UPDATE SKIP LOCKED en PostgreSQL; aquí se imita serialmente).
function createFakeDb({ rows = [], failMarkSent = false, onRpc = null } = {}) {
  const db = { rows, rpcCalls: [], claimedIds: [], updateLog: [] }

  db.rpc = async fn => {
    db.rpcCalls.push(fn)
    if (fn !== 'claim_next_whatsapp_message') {
      return { data: null, error: { message: `RPC inesperada: ${fn}` } }
    }
    const next = db.rows
      .filter(row => row.status === 'queued')
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0]
    if (!next) {
      if (onRpc) onRpc(db)
      return { data: [], error: null }
    }
    next.status = 'sending'
    next.claimed_at = new Date().toISOString()
    db.claimedIds.push(next.id)
    if (onRpc) onRpc(db)
    return { data: [{ ...next, full_name: next.full_name || null }], error: null }
  }

  db.from = table => {
    const source = table === 'whatsapp_messages' ? db.rows : table === 'customers' ? (db.customers || []) : null
    if (!source) throw new Error(`Tabla inesperada: ${table}`)
    const state = { op: 'select', payload: null, filters: [], maybe: false }
    const matches = row => state.filters.every(filter => {
      if (filter.type === 'eq') return row[filter.col] === filter.value
      if (filter.type === 'lt') return row[filter.col] != null && row[filter.col] < filter.value
      if (filter.type === 'in') return filter.values.includes(row[filter.col])
      return false
    })
    const builder = {
      select() { return builder },
      update(payload) { state.op = 'update'; state.payload = payload; return builder },
      eq(col, value) { state.filters.push({ type: 'eq', col, value }); return builder },
      lt(col, value) { state.filters.push({ type: 'lt', col, value }); return builder },
      in(col, values) { state.filters.push({ type: 'in', col, values }); return builder },
      maybeSingle() { state.maybe = true; return builder },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          const hits = source.filter(matches)
          if (state.op === 'update') {
            if (state.payload.status === 'sent' && failMarkSent) {
              db.updateLog.push({ payload: { ...state.payload }, matched: 0, failed: true })
              return { data: [], error: { message: 'sin conexión' } }
            }
            hits.forEach(row => Object.assign(row, state.payload))
            db.updateLog.push({ payload: { ...state.payload }, matched: hits.length })
            return { data: hits.map(row => ({ id: row.id })), error: null }
          }
          if (state.maybe) {
            if (hits.length > 1) return { data: null, error: { message: 'demasiadas filas' } }
            return { data: hits[0] ? { ...hits[0] } : null, error: null }
          }
          return { data: hits.map(row => ({ ...row })), error: null }
        }).then(resolve, reject)
      },
    }
    return builder
  }

  return db
}

function createFakeClient({ ready = true, failFor = null, stateScript = null } = {}) {
  const client = {
    info: ready ? { wid: 'fullchina@c.us' } : undefined,
    sent: [],
    stateCalls: 0,
    getState: async () => {
      client.stateCalls += 1
      if (stateScript) return stateScript(client.stateCalls)
      return ready ? 'open' : 'closed'
    },
    sendMessage: async (chatId, text) => {
      if (failFor && chatId.startsWith(failFor)) throw new Error('Number does not exist on whatsapp')
      client.sent.push({ chatId, text })
    },
  }
  return client
}

const makeRow = (id, extra = {}) => ({
  id,
  phone: '04121234567',
  message: 'Hola [Nombre], tenemos novedades.',
  full_name: 'María Pérez',
  status: 'queued',
  claimed_at: null,
  error_message: null,
  created_at: `2026-10-01T10:00:0${id.slice(-1)}Z`,
  ...extra,
})

const minutesAgo = m => new Date(Date.now() - m * 60000).toISOString()

const setup = (options = {}) => {
  const log = createLog()
  const sleeps = []
  const db = createFakeDb(options.db || {})
  const client = options.client || createFakeClient()
  const processor = createQueueProcessor({
    db,
    client,
    log,
    sleepFn: async ms => { sleeps.push(ms) },
    delayFn: () => 9000,
    ...(options.processor || {}),
  })
  return { log, sleeps, db, client, processor }
}

// --- Helpers puros ----------------------------------------------------------

test('normalizeChatId: 0412... -> 58412...@c.us', () => {
  assert.equal(normalizeChatId('04121234567'), '584121234567@c.us')
  assert.equal(normalizeChatId('584121234567'), '584121234567@c.us')
  assert.equal(normalizeChatId('+58 412 123 4567'), '584121234567@c.us')
  assert.equal(normalizeChatId(''), '@c.us')
})

test('personalizeMessage: reemplaza [Nombre] y respeta nombre propio', () => {
  assert.equal(personalizeMessage('Hola [Nombre]!', 'María Pérez'), 'Hola María!')
  assert.equal(personalizeMessage('Hola [Nombre]!', ''), 'Hola cliente!')
  assert.equal(personalizeMessage('Sin placeholder', 'Ana'), 'Sin placeholder')
})

test('nextSendDelay: siempre entre 8000 y 14000 ms', () => {
  for (let i = 0; i < 500; i += 1) {
    const value = nextSendDelay()
    assert.ok(value >= 8000 && value <= 14000, `valor fuera de rango: ${value}`)
  }
})

test('isClientReady: client.info manda (getState no devuelve READY en v1.34)', async () => {
  assert.equal(await isClientReady({ info: undefined, getState: async () => 'open' }), false)
  assert.equal(await isClientReady({ info: {}, getState: async () => 'open' }), true)
  assert.equal(await isClientReady({ info: {}, getState: async () => 'connecting' }), false)
  assert.equal(await isClientReady({ info: {}, getState: async () => null }), true)
  assert.equal(await isClientReady({ info: {}, getState: async () => { throw new Error('x') } }), true)
})

// --- Ciclo de envío ---------------------------------------------------------

test('camino feliz: reclama, personaliza, envía y confirma con delay', async () => {
  const { db, client, sleeps, processor } = setup({ db: { rows: [makeRow('a1')] } })

  const result = await processor.processQueue()

  assert.equal(result, 'done')
  assert.equal(db.rpcCalls[0], 'claim_next_whatsapp_message')
  assert.equal(db.rows[0].status, 'sent')
  assert.ok(db.rows[0].sent_at)
  assert.equal(client.sent.length, 1)
  assert.equal(client.sent[0].chatId, '584121234567@c.us')
  assert.equal(client.sent[0].text, 'Hola María, tenemos novedades.')
  assert.deepEqual(sleeps, [9000])
})

test('dos instancias no ven la misma fila: tras reclamar, la fila ya no está queued', async () => {
  const { db, processor } = setup({ db: { rows: [makeRow('a1')] } })

  await processor.processQueue()

  // El "segundo proceso" (otra llamada a la RPC) no encuentra nada que
  // reclamar: la fila salió de 'queued' en la reserva, no en el envío.
  const second = createFakeDb({ rows: db.rows })
  const { data } = await second.rpc('claim_next_whatsapp_message')
  assert.deepEqual(data, [])
  assert.deepEqual(db.claimedIds, ['a1'], 'la fila solo debe reclamarse una vez')
})

test('ventana de "Detener": si la fila se cancela tras el reclamo, no se envía', async () => {
  const { db, client, processor } = setup({
    db: {
      rows: [makeRow('a1')],
      onRpc: fake => { fake.rows[0].status = 'cancelled' },
    },
  })

  const result = await processor.processQueue()

  assert.equal(result, 'done')
  assert.equal(client.sent.length, 0)
  assert.equal(db.rows[0].status, 'cancelled')
})

test('error de envío: marca failed con el motivo y sigue con el siguiente', async () => {
  const { db, client, sleeps, processor } = setup({
    db: { rows: [makeRow('a1'), makeRow('a2')] },
    client: createFakeClient({ failFor: '584121234567' }),
  })
  db.rows[1].phone = '04149998877'

  const result = await processor.processQueue()

  assert.equal(result, 'done')
  assert.equal(db.rows[0].status, 'failed')
  assert.match(db.rows[0].error_message, /Number does not exist/)
  assert.equal(db.rows[1].status, 'sent')
  assert.equal(client.sent.length, 1)
  assert.equal(client.sent[0].chatId, '584149998877@c.us')
  assert.deepEqual(sleeps, [9000, 9000])
})

test('envío obsoleto (bot caído): se cierra como failed sin reenviar', async () => {
  const stale = makeRow('s1', { status: 'sending', claimed_at: minutesAgo(6) })
  const { db, client, processor, log } = setup({ db: { rows: [stale] } })

  const result = await processor.processQueue()

  assert.equal(result, 'done')
  assert.equal(db.rows[0].status, 'failed')
  assert.equal(db.rows[0].error_message, STALE_SENDING_MESSAGE)
  assert.equal(client.sent.length, 0)
  assert.equal(db.rpcCalls.length, 1)
  assert.equal(log.lines.warn.length, 1)
})

test('envío sending reciente (en curso en otra instancia) NO se toca', async () => {
  const fresh = makeRow('s1', { status: 'sending', claimed_at: minutesAgo(1) })
  const { db, processor } = setup({ db: { rows: [fresh] } })

  await processor.processQueue()

  assert.equal(db.rows[0].status, 'sending')
  assert.equal(db.updateLog.every(entry => entry.matched === 0), true, 'ninguna fila debe modificarse')
})

test('falla al confirmar en la BD: reintenta y detiene el loop sin reenviar', async () => {
  const { db, client, processor, log } = setup({ db: { rows: [makeRow('a1')], failMarkSent: true } })

  const first = await processor.processQueue()
  assert.equal(first, 'done')
  assert.equal(db.rows[0].status, 'sending')
  assert.equal(client.sent.length, 1)
  const confirmAttempts = db.updateLog.filter(entry => entry.payload.status === 'sent').length
  assert.equal(confirmAttempts, 3, 'debe reintentar la confirmación 3 veces')

  // Un segundo ciclo NO vuelve a enviar: la fila no está 'queued'.
  const second = await processor.processQueue()
  assert.equal(second, 'done')
  assert.equal(client.sent.length, 1)
  assert.deepEqual(db.claimedIds, ['a1'], 'la fila debe reclamarse solo una vez en total')
  assert.ok(log.lines.error.some(line => line.includes('evitar duplicados')))
})

test('WhatsApp no listo: no reclama ninguna fila', async () => {
  const { db, client, processor } = setup({ db: { rows: [makeRow('a1')] }, client: createFakeClient({ ready: false }) })

  await processor.processQueue()

  assert.equal(db.rpcCalls.length, 0)
  assert.equal(db.rows[0].status, 'queued')
  assert.equal(client.sent.length, 0)
})

test('se desconecta tras reclamar: libera la fila de vuelta a queued', async () => {
  const { db, client, processor } = setup({
    db: { rows: [makeRow('a1')] },
    client: createFakeClient({ stateScript: call => (call <= 1 ? 'open' : 'closed') }),
  })

  await processor.processQueue()

  assert.equal(db.rpcCalls.length, 1)
  assert.equal(db.rows[0].status, 'queued')
  assert.equal(db.rows[0].claimed_at, null)
  assert.equal(client.sent.length, 0)
})

test('cola deshabilitada: no reclama ni envía', async () => {
  const { db, client, processor } = setup({
    db: { rows: [makeRow('a1')] },
    processor: { isEnabled: () => false },
  })

  const result = await processor.processQueue()

  assert.equal(result, 'done')
  assert.equal(db.rpcCalls.length, 0)
  assert.equal(db.rows[0].status, 'queued')
  assert.equal(client.sent.length, 0)
})

test('dos procesadores sobre la misma cola no envían ninguna fila dos veces', async () => {
  const rows = [makeRow('a1'), makeRow('a2', { phone: '04149998877' }), makeRow('a3', { phone: '04245556677' })]
  const db = createFakeDb({ rows })
  const log = createLog()
  const client = createFakeClient()
  const make = () => createQueueProcessor({ db, client, log, sleepFn: async () => {}, delayFn: () => 1, isEnabled: () => true })

  await Promise.all([make().processQueue(), make().processQueue()])

  assert.equal(client.sent.length, 3, 'cada fila debe enviarse exactamente una vez')
  const chats = client.sent.map(entry => entry.chatId)
  assert.equal(new Set(chats).size, 3, 'sin destinatarios duplicados')
  assert.equal(db.rows.every(row => row.status === 'sent'), true)
})
