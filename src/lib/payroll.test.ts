import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePayrollPeriod } from './dataService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), delete: vi.fn(), eq: vi.fn(), select: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }))

describe('Borrado de períodos de nómina', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const query = { delete: mocks.delete, eq: mocks.eq, select: mocks.select }
    mocks.from.mockReturnValue(query)
    mocks.delete.mockReturnValue(query)
    mocks.eq.mockReturnValue(query)
    mocks.select.mockResolvedValue({ data: [{ id: 'period-1' }], error: null })
  })

  it('usa el borrado protegido del esquema si la RPC todavía no existe', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
    await deletePayrollPeriod('period-1')
    expect(mocks.from).toHaveBeenCalledWith('payroll_periods')
    expect(mocks.eq).toHaveBeenCalledWith('status', 'open')
    expect(mocks.eq).toHaveBeenCalledWith('id', 'period-1')
  })

  it('respeta el bloqueo de clave foránea cuando hay pagos o ajustes asociados', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
    mocks.select.mockResolvedValue({ data: null, error: { code: '23503', message: 'linked record' } })
    await expect(deletePayrollPeriod('period-1')).rejects.toMatchObject({ code: '23503' })
  })
})
