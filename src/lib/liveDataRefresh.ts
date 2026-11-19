import { useEffect, useRef } from 'react'
import { subscribeToDataChanges } from './supabase'

export const MODULE_TABLES: Record<string, readonly string[]> = {
  dashboard: ['orders', 'order_items', 'order_item_modifiers', 'payments', 'customers', 'credits', 'credit_payments', 'preparation_batches', 'preparation_batch_items', 'preparation_batch_costs', 'production_bonuses', 'stock_movements', 'ingredients', 'ingredient_costs', 'units', 'sellable_products', 'financial_accounts', 'cash_sessions', 'daily_closes', 'daily_close_financials'],
  caja: ['sellable_products', 'sellable_product_categories', 'menu_categories', 'sellable_product_modifiers', 'modifiers', 'modifier_options', 'customers', 'promotions', 'floor_tables', 'delivery_config', 'delivery_zones', 'ingredients', 'orders', 'order_items', 'order_item_modifiers', 'payments', 'cash_sessions', 'cash_movements', 'financial_accounts'],
  'pagina-pedir': ['sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'modifiers', 'modifier_options', 'menu_categories', 'promotions', 'delivery_config', 'delivery_zones', 'public_order_page_settings'],
  'delivery-settings': ['delivery_config', 'delivery_zones', 'delivery_payroll_config'],
  'caja-operativa': ['cash_sessions', 'cash_movements', 'daily_closes', 'daily_close_financials', 'payments', 'orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'sellable_products', 'customers', 'financial_accounts'],
  comandas: ['orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'sellable_products', 'payments', 'web_order_requests', 'web_order_items', 'order_event_logs', 'profiles', 'customers', 'cash_sessions', 'cash_movements'],
  mesas: ['floor_tables', 'orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'sellable_products', 'profiles'],
  cocina: ['orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'sellable_products'],
  clientes: ['customers', 'orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'sellable_products', 'credits', 'credit_payments', 'financial_accounts'],
  proveedores: ['suppliers', 'purchases', 'purchase_items', 'purchase_expense_items', 'purchase_payments', 'financial_accounts', 'ingredients', 'units'],
  almacen: ['ingredients', 'ingredient_costs', 'stock_movements', 'units', 'unit_conversions', 'purchase_items', 'inventory_requisitions'],
  inventario: ['ingredients', 'ingredient_costs', 'stock_movements', 'units', 'unit_conversions', 'purchase_items', 'preparation_batch_items', 'recipe_components'],
  produccion: ['preparation_batches', 'preparation_batch_items', 'preparation_batch_costs', 'production_bonuses', 'ingredients', 'ingredient_costs', 'stock_movements', 'units', 'unit_conversions', 'employees'],
  recetas: ['sellable_products', 'recipe_components', 'ingredients', 'ingredient_costs', 'portion_recipes', 'units'],
  menu: ['sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'modifiers', 'modifier_options', 'menu_categories'],
  'menu-semanal': ['weekly_menu_items', 'weekly_menu_activations', 'sellable_products'],
  compras: ['purchases', 'purchase_items', 'purchase_expense_items', 'purchase_payments', 'suppliers', 'ingredients', 'stock_movements', 'financial_accounts', 'units'],
  gastos: ['expenses', 'expense_payments', 'financial_accounts'],
  finanzas: ['financial_accounts', 'financial_operations', 'orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'sellable_products', 'expenses', 'expense_payments', 'purchases', 'purchase_items', 'purchase_expense_items', 'purchase_payments', 'suppliers', 'daily_closes', 'daily_close_financials', 'credits', 'credit_payments', 'customers', 'delivery_assignments', 'preparation_batches', 'preparation_batch_items', 'preparation_batch_costs', 'production_bonuses', 'payroll_periods', 'payroll_entries', 'payroll_payments', 'payroll_adjustments', 'advances', 'recipe_components', 'ingredients', 'ingredient_costs', 'portion_recipes', 'units', 'unit_conversions'],
  equipo: ['employees', 'profiles', 'employee_attendance'],
  fidelizacion: ['customers', 'orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'customer_accounts', 'customer_account_identifiers', 'customer_loyalty_visits', 'customer_loyalty_rewards', 'loyalty_settings', 'loyalty_reward_sequence', 'customer_favorites', 'gift_cards', 'gift_card_transactions'],
  marketing: ['customers', 'whatsapp_messages', 'whatsapp_templates', 'whatsapp_segments', 'whatsapp_segment_members'],
  nomina: ['employees', 'payroll_periods', 'payroll_entries', 'payroll_payments', 'payroll_adjustments', 'advances', 'production_bonuses', 'delivery_assignments', 'financial_accounts'],
  creditos: ['customers', 'orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'payments', 'credits', 'credit_payments', 'financial_accounts'],
  auditoria: ['audit_logs', 'order_event_logs', 'order_adjustments', 'system_activity_logs', 'profiles'],
  mas: ['customers', 'credits', 'credit_payments', 'financial_accounts', 'financial_operations'],
  promociones: ['promotions'],
  reportes: ['orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'payments', 'customers', 'sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'menu_categories', 'legacy_sales', 'legacy_deleted_orders', 'legacy_purchase_orders', 'expenses', 'expense_payments', 'purchases', 'purchase_items', 'purchase_expense_items', 'purchase_payments', 'suppliers', 'financial_accounts', 'credits', 'credit_payments', 'daily_closes', 'daily_close_financials', 'ingredients', 'ingredient_costs', 'units', 'unit_conversions', 'stock_movements', 'recipe_components', 'portion_recipes', 'preparation_batches', 'preparation_batch_items', 'preparation_batch_costs', 'order_event_logs', 'order_adjustments', 'employee_attendance', 'inventory_requisitions', 'gift_cards', 'gift_card_transactions', 'financial_operations', 'payroll_periods', 'payroll_entries', 'payroll_payments', 'payroll_adjustments', 'advances', 'audit_logs', 'weekly_menu_items', 'delivery_config', 'delivery_zones', 'delivery_assignments'],
}

const AUXILIARY_TABLES: Record<string, readonly string[]> = {
  'busqueda-global': ['sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'menu_categories', 'modifiers', 'modifier_options', 'customers', 'orders', 'order_items', 'order_item_modifiers', 'payments', 'suppliers'],
  'selector-productos': ['sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'menu_categories', 'modifiers', 'modifier_options'],
}

export function moduleUsesTable(moduleId: string, table: string) {
  const tables = MODULE_TABLES[moduleId] ?? AUXILIARY_TABLES[moduleId]
  return table === '*' || !tables || tables.includes('*') || tables.includes(table)
}

/** Refresh the mounted module only when one of its source tables changes. */
export function useLiveDataRefresh(moduleId: string, refresh: () => void | Promise<unknown>) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let active = true
    let refreshRunning = false
    let refreshQueued = false
    const isPageVisible = () => document.visibilityState === 'visible'
    const runRefresh = async () => {
      if (!active || !isPageVisible()) return
      if (refreshRunning) {
        // A newer database event arrived while this request was in flight.
        // Run one more read after it finishes so the older snapshot cannot be
        // the last value applied to the mounted module.
        refreshQueued = true
        return
      }

      refreshRunning = true
      do {
        refreshQueued = false
        try {
          await refreshRef.current()
        } catch (error) {
          console.error(`No se pudo actualizar el módulo ${moduleId} en tiempo real:`, error)
        }
      } while (active && refreshQueued && isPageVisible())
      refreshRunning = false
    }

    const unsubscribe = subscribeToDataChanges((changedTable) => {
      if (!moduleUsesTable(moduleId, changedTable)) return
      if (!isPageVisible()) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void runRefresh()
      }, 180)
    })

    return () => {
      active = false
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [moduleId])
}
