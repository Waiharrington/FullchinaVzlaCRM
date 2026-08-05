import { useState } from 'react'
import { useDemoData } from '../context/demo-data-context'
import './Nomina.css'

interface PayrollRecord {
  id: string
  employeeName: string
  role: string
  baseSalary: number
  productionBonus: number
  advances: number
  netPay: number
  status: 'paid' | 'pending'
}

export function Nomina() {
  const { staff } = useDemoData()
  const [payrollList] = useState<PayrollRecord[]>([
    {
      id: 'PAY-001',
      employeeName: 'Ana García',
      role: 'Cajera Principal',
      baseSalary: 150.0,
      productionBonus: 25.0,
      advances: 10.0,
      netPay: 165.0,
      status: 'paid',
    },
    {
      id: 'PAY-002',
      employeeName: 'Carlos Ruiz',
      role: 'Cocinero de Wok',
      baseSalary: 180.0,
      productionBonus: 45.0,
      advances: 20.0,
      netPay: 205.0,
      status: 'paid',
    },
    {
      id: 'PAY-003',
      employeeName: 'María López',
      role: 'Asistente de Producción (Lumpias)',
      baseSalary: 140.0,
      productionBonus: 60.0,
      advances: 0.0,
      netPay: 200.0,
      status: 'pending',
    },
  ])

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Nómina y Personal</h1>
          <p className="page-subtitle">Sueldos base, bonificaciones de producción y adelantos</p>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <span className="stat-value">{staff.length}</span>
            <span className="stat-label">Empleados activos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💸</div>
          <div className="stat-info">
            <span className="stat-value">
              ${payrollList.reduce((sum, p) => sum + p.netPay, 0).toFixed(2)}
            </span>
            <span className="stat-label">Total nómina semanal</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎁</div>
          <div className="stat-info">
            <span className="stat-value">
              ${payrollList.reduce((sum, p) => sum + p.productionBonus, 0).toFixed(2)}
            </span>
            <span className="stat-label">Total bonos de producción</span>
          </div>
        </div>
      </div>

      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Cálculo de Nómina Semanal</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID Pago</th>
              <th>Empleado</th>
              <th>Cargo</th>
              <th>Sueldo Base</th>
              <th>Bonos Producción</th>
              <th>Adelantos (-)</th>
              <th>Total Net a Cobrar</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {payrollList.map(item => (
              <tr key={item.id}>
                <td>
                  <strong>{item.id}</strong>
                </td>
                <td>{item.employeeName}</td>
                <td>{item.role}</td>
                <td>${item.baseSalary.toFixed(2)}</td>
                <td className="text-success">+${item.productionBonus.toFixed(2)}</td>
                <td className="text-danger">-${item.advances.toFixed(2)}</td>
                <td>
                  <strong className="text-gradient">${item.netPay.toFixed(2)}</strong>
                </td>
                <td>
                  <span className={`badge ${item.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                    {item.status === 'paid' ? '✅ Pagado' : '⏳ Pendiente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
