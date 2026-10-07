/** Comisión bancaria de Pago Móvil: 0,3% con mínimo de Bs. 14, redondeada a céntimos. */
export function calculateMobilePaymentFee(amountBs: number): number {
  if (!Number.isFinite(amountBs) || amountBs <= 0) return 0
  return Math.round(Math.max(amountBs * 0.003, 14) * 100) / 100
}
