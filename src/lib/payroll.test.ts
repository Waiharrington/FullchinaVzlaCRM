import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePayrollPeriod, getAllEmployees, getPayrollEntries } from './dataService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), delete: vi.fn(), eq: vi.fn(), select: vi.fn(), order: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }))

describe('Borrado de períodos de nómina', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const query = { delete: mocks.delete, eq: mocks.eq, select: mocks.select, order: mocks.order }
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

describe('Lectura de nómina con el esquema antiguo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const query = { select: mocks.select, eq: mocks.eq, order: mocks.order }
    mocks.from.mockReturnValue(query)
    mocks.select.mockReturnValue(query)
    mocks.eq.mockReturnValue(query)
  })

  it('lee empleados sin pedir columnas semanales ausentes', async () => {
    const query = { select: mocks.select, eq: mocks.eq, order: mocks.order }
    mocks.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [{
      id: 'employee-1', full_name: 'Barbara', position: 'Empleado', hourly_rate: 40, is_active: true,
    }], error: null })
    const employees = await getAllEmployees()
    expect(mocks.select).toHaveBeenCalledWith('*')
    expect(employees[0].weeklySalary).toBe(40)
    expect(employees[0].hasWeeklyPayrollColumns).toBe(false)
  })

  it('conserva el neto guardado sin inventar un desglose', async () => {
    mocks.order.mockResolvedValue({ data: [{
      id: 'entry-1', payroll_period_id: 'period-1', employee_id: 'employee-1', hours_worked: 0,
      base_salary: 321, deductions: 0, net_pay: 321, notes: null,
    }], error: null })
    const entries = await getPayrollEntries('period-1')
    expect(mocks.select).toHaveBeenCalledWith('*')
    expect(entries[0]).toMatchObject({ netPay: 321, hasBreakdown: false, bonusAmount: 0 })
  })
})
