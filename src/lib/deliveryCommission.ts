import type { DeliveryAssignment } from './dataService'

/** El 70 % se conserva para comandas antiguas sin asignación registrada. */
export function deliveryCommissionCost(fee: number, assignment?: Pick<DeliveryAssignment, 'status' | 'employeeAmount'>): number {
  if (assignment) return assignment.status === 'cancelled' ? 0 : assignment.employeeAmount
  return Math.round(fee * 70) / 100
}
