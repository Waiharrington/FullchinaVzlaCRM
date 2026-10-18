import { customerSupabase } from './supabase'

export type CustomerOrderProfile = {
  firstName: string
  lastName: string
  fullName: string
  identification: string
  phone: string
  email: string
}

/** Reads the signed-in customer's own checkout details through an authenticated RPC. */
export async function getCustomerOrderProfile(): Promise<CustomerOrderProfile | null> {
  if (!customerSupabase) return null
  const { data: sessionData, error: sessionError } = await customerSupabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) return null

  const { data, error } = await customerSupabase.rpc('fn_get_customer_order_profile')
  let customer: Record<string, unknown> | null = data && typeof data === 'object' ? data as Record<string, unknown> : null
  if (error || !customer) {
    // Keep name and phone autofill useful on installations before the new,
    // narrower order-profile RPC is applied. The existing RPC is also scoped
    // to auth.uid(), but does not yet return identification or email.
    const fallback = await customerSupabase.rpc('fn_get_customer_loyalty_profile', { p_page: 0, p_page_size: 1 })
    if (fallback.error) throw fallback.error
    const fallbackCustomer = (fallback.data as { customer?: Record<string, unknown> } | null)?.customer
    customer = fallbackCustomer ? { ...fallbackCustomer } : null
  }
  if (!customer) return null
  const fullName = String(customer.full_name ?? '').trim()
  return {
    firstName: String(customer.first_name ?? '').trim(),
    lastName: String(customer.last_name ?? '').trim(),
    fullName,
    identification: String(customer.identification ?? '').trim(),
    phone: String(customer.phone ?? '').trim(),
    email: String(customer.email ?? '').trim(),
  }
}
