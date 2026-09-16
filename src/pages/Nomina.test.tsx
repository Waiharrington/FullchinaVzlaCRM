import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Nomina } from './Nomina'

const mocks = vi.hoisted(() => ({
  getAllEmployees: vi.fn(), getPayrollPeriods: vi.fn(), getPayrollEntries: vi.fn(),
  getAdvances: vi.fn(), getProductionBonusRecords: vi.fn(), getPayrollPayments: vi.fn(),
  getFinancialAccounts: vi.fn(), getDeliveryAssignments: vi.fn(), liquidatePayrollPeriod: vi.fn(),
  deletePayrollPeriod: vi.fn(), confirmDialog: vi.fn(),
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
    mocks.getFinancialAccounts.mockResolvedValue([])
    mocks.getDeliveryAssignments.mockResolvedValue([])
    mocks.confirmDialog.mockResolvedValue(true)
    mocks.deletePayrollPeriod.mockResolvedValue(undefined)
  })

  it('muestra el bono guardado y el neto histórico del período seleccionado', async () => {
    render(<Nomina />)
    const input = await screen.findByRole('spinbutton', { name: 'Bono de Barbara' })
    await waitFor(() => expect(input).toHaveValue(21))
    expect(screen.getByText('Total Bonos').parentElement).toHaveTextContent('$21,00')
    expect(screen.getByText('Liquidación guardada').parentElement).toHaveTextContent('$21,00')
    expect(screen.getByText('TOTAL NETO A PAGAR').parentElement).toHaveTextContent('$61,00')
  })

  it('conserva el total antiguo cuando no existe desglose y permite eliminar el período abierto', async () => {
    render(<Nomina />)
    const cards = await screen.findAllByRole('button', { name: /Liquidación:/ })
    fireEvent.click(cards[1])
    expect(await screen.findByText(/las liquidaciones antiguas no registraron los bonos/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar liquidación' })).not.toBeInTheDocument()
    expect(screen.getAllByText('TOTAL GUARDADO')[0].parentElement).toHaveTextContent('$61,00')
    fireEvent.click(within(cards[1]).getByRole('button', { name: /Eliminar período/ }))
    await waitFor(() => expect(mocks.deletePayrollPeriod).toHaveBeenCalledWith('older'))
  })

  it('bloquea un guardado nuevo cuando el servidor aún no tiene las columnas semanales', async () => {
    mocks.getAllEmployees.mockResolvedValue([{ ...employee, hasWeeklyPayrollColumns: false }])
    mocks.getPayrollEntries.mockResolvedValue([])
    render(<Nomina />)
    expect(await screen.findByText(/El servidor aún no tiene la migración semanal de nómina/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar liquidación' })).toBeDisabled()
  })
})
