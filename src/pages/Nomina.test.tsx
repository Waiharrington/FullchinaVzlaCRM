import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Nomina } from './Nomina'

const mocks = vi.hoisted(() => ({
  getAllEmployees: vi.fn(), getPayrollPeriods: vi.fn(), getPayrollEntries: vi.fn(),
  getAdvances: vi.fn(), getProductionBonusRecords: vi.fn(), getPayrollPayments: vi.fn(),
  getPayrollAdjustments: vi.fn(), createPayrollAdjustment: vi.fn(), createPayrollPayment: vi.fn(),
  createAdvance: vi.fn(), getFinancialAccounts: vi.fn(), getDeliveryAssignments: vi.fn(), confirmDialog: vi.fn(),
}))

vi.mock('../lib/dataService', () => ({ ...mocks }))
vi.mock('../context/rates-context', () => ({ useRates: () => ({ bcvRate: 800 }) }))
vi.mock('../components/ConfirmDialog', () => ({ confirmDialog: (...args: unknown[]) => mocks.confirmDialog(...args) }))

const employee = { id: 'employee-1', fullName: 'Barbara', position: 'Empleado', hourlyRate: 0, weeklySalary: 40, overtimeRate: 0, isActive: true }
const recent = { id: 'recent', startDate: '2026-09-07', endDate: '2026-09-12', status: 'open', notes: null, createdAt: '2026-09-07' }
const older = { id: 'older', startDate: '2026-08-31', endDate: '2026-09-05', status: 'open', notes: null, createdAt: '2026-08-31' }
const entry = (periodId: string, hasBreakdown: boolean) => ({
  id: `entry-${periodId}`, payrollPeriodId: periodId, employeeId: employee.id, employeeName: employee.fullName,
  position: employee.position, hoursWorked: 0, baseSalary: 61, deductions: 0, netPay: 61, notes: null,
  weeklySalary: hasBreakdown ? 40 : 0, bonusAmount: hasBreakdown ? 21 : 0,
  overtimeHours: 0, overtimeAmount: 0, transportAmount: 0, absenceDays: 0,
  absenceDeduction: 0, advanceDeduction: 0, hasBreakdown,
})

describe('Historial de nómina', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllEmployees.mockResolvedValue([employee])
    mocks.getPayrollPeriods.mockResolvedValue([recent, older])
    mocks.getPayrollEntries.mockImplementation((id: string) => Promise.resolve([entry(id, id === 'recent')]))
    mocks.getAdvances.mockResolvedValue([])
    mocks.getProductionBonusRecords.mockResolvedValue([])
    mocks.getPayrollPayments.mockResolvedValue([])
    mocks.getPayrollAdjustments.mockResolvedValue([])
    mocks.createPayrollAdjustment.mockResolvedValue(undefined)
    mocks.createPayrollPayment.mockResolvedValue(undefined)
    mocks.createAdvance.mockResolvedValue(undefined)
    mocks.getFinancialAccounts.mockResolvedValue([])
    mocks.getDeliveryAssignments.mockResolvedValue([])
    mocks.confirmDialog.mockResolvedValue(true)
  })

  it('muestra las acciones en la tarjeta y abre el detalle en el mes del movimiento más reciente', async () => {
    render(<Nomina />)
    expect(await screen.findByText('Barbara')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Salario' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Bono' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '− Descuento' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Detalle/ }))
    expect(await screen.findByLabelText('Mes del detalle')).toHaveValue('2026-09')
    expect(screen.getAllByText('Nómina de período')).toHaveLength(2)
  })

  it('prellena el salario semanal al añadir salario desde la tarjeta', async () => {
    render(<Nomina />)
    await screen.findByText('Barbara')
    fireEvent.click(screen.getByRole('button', { name: '+ Salario' }))
    expect(await screen.findByText('Añadir salario')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue(40)
  })

  it('abre el registro de un pago parcial desde la tarjeta', async () => {
    mocks.getPayrollEntries.mockResolvedValue([entry('recent', true)])
    mocks.getFinancialAccounts.mockResolvedValue([{ id: 'cash-usd', name: 'Caja USD', currency: 'USD', currentBalance: 500, isActive: true }])
    render(<Nomina />)
    await screen.findByText('Barbara')
    fireEvent.click(screen.getByRole('button', { name: /Liquidar saldo/ }))
    expect(await screen.findByText('Registrar pago directo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar cuenta...' }))
    expect(await screen.findByRole('option', { name: 'Caja USD · USD' })).toBeInTheDocument()
  })
})
