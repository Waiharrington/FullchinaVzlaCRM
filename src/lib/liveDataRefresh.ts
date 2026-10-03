import { useEffect, useRef } from 'react'
import { subscribeToDataChanges } from './supabase'

export const MODULE_TABLES: Record<string, readonly string[]> = {
  dashboard: ['orders', 'order_items', 'payments', 'customers', 'credits', 'credit_payments', 'preparation_batches', 'preparation_batch_items', 'preparation_batch_costs', 'production_bonuses', 'stock_movements', 'ingredients', 'ingredient_costs', 'sellable_products'],
  caja: ['sellable_products', 'sellable_product_categories', 'menu_categories', 'sellable_product_modifiers', 'customers', 'promotions', 'floor_tables', 'delivery_config', 'delivery_zones', 'ingredients', 'orders', 'order_items', 'payments', 'cash_sessions', 'cash_movements', 'financial_accounts'],
  'delivery-settings': ['delivery_config', 'delivery_zones'],
  'caja-operativa': ['cash_sessions', 'cash_movements', 'daily_closes', 'daily_close_financials', 'payments', 'orders'],
  comandas: ['orders', 'order_items', 'payments', 'web_order_requests', 'order_event_logs', 'profiles', 'cash_sessions', 'cash_movements'],
  mesas: ['floor_tables', 'orders'],
  cocina: ['orders', 'order_items'],
  clientes: ['customers', 'orders', 'credits', 'credit_payments'],
  proveedores: ['suppliers', 'purchases', 'purchase_items', 'purchase_payments'],
  almacen: ['ingredients', 'stock_movements', 'units', 'unit_conversions', 'inventory_requisitions'],
  inventario: ['ingredients', 'ingredient_costs', 'stock_movements', 'units', 'unit_conversions'],
  produccion: ['preparation_batches', 'preparation_batch_items', 'preparation_batch_costs', 'production_bonuses', 'ingredients', 'employees'],
  recetas: ['sellable_products', 'recipe_components', 'ingredients', 'ingredient_costs', 'portion_recipes'],
  menu: ['sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'menu_categories'],
  'menu-semanal': ['weekly_menu_items', 'weekly_menu_activations', 'sellable_products'],
  compras: ['purchases', 'purchase_items', 'purchase_payments', 'suppliers', 'ingredients', 'stock_movements'],
  gastos: ['expenses', 'expense_payments', 'financial_accounts'],
  finanzas: ['financial_accounts', 'financial_operations', 'orders', 'payments', 'expenses', 'expense_payments', 'purchases', 'purchase_payments', 'daily_closes', 'daily_close_financials', 'credits', 'credit_payments'],
  equipo: ['employees', 'profiles', 'employee_attendance'],
  fidelizacion: ['customers', 'gift_cards', 'gift_card_transactions'],
  marketing: ['customers', 'whatsapp_messages', 'whatsapp_templates', 'whatsapp_segments', 'whatsapp_segment_members'],
  nomina: ['employees', 'payroll_periods', 'payroll_entries', 'payroll_payments', 'advances', 'production_bonuses', 'delivery_assignments'],
  creditos: ['customers', 'orders', 'order_items', 'payments', 'credits', 'credit_payments'],
  auditoria: ['audit_logs', 'order_event_logs', 'order_adjustments', 'system_activity_logs'],
  mas: ['customers', 'credits', 'credit_payments', 'financial_accounts', 'financial_operations'],
  promociones: ['promotions'],
  reportes: ['orders', 'order_items', 'order_item_modifiers', 'payments', 'customers', 'sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'menu_categories', 'legacy_sales', 'legacy_deleted_orders', 'legacy_purchase_orders', 'expenses', 'expense_payments', 'purchases', 'purchase_items', 'purchase_payments', 'credits', 'credit_payments', 'daily_closes', 'daily_close_financials', 'ingredients', 'ingredient_costs', 'stock_movements', 'preparation_batches', 'preparation_batch_items', 'order_event_logs', 'order_adjustments', 'employee_attendance', 'inventory_requisitions', 'gift_cards', 'gift_card_transactions', 'financial_operations', 'payroll_payments', 'advances', 'audit_logs', 'weekly_menu_items', 'delivery_config', 'delivery_zones'],
}

export function moduleUsesTable(moduleId: string, table: string) {
  const tables = MODULE_TABLES[moduleId]
  return !tables || tables.includes('*') || tables.includes(table)
}

/** Refresh the mounted module only when one of its source tables changes. */
export function useLiveDataRefresh(moduleId: string, refresh: () => void | Promise<unknown>) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = subscribeToDataChanges((changedTable) => {
      if (!moduleUsesTable(moduleId, changedTable)) return
      if (document.visibilityState === 'hidden') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void refreshRef.current() }, 180)
    })

    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [moduleId])
}
