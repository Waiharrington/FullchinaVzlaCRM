import { client } from './client'
import type { AuthUser } from './types'

export async function listAuthUsers(): Promise<AuthUser[]> {
  const { data, error } = await client().rpc('fn_admin_list_users')
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    email: String(r.email),
    fullName: r.full_name ? String(r.full_name) : '',
    role: String(r.role) as AuthUser['role'],
    isActive: Boolean(r.is_active),
    allowedModules: Array.isArray(r.allowed_modules) ? (r.allowed_modules as string[]) : null,
    createdAt: String(r.created_at),
    lastSignInAt: r.last_sign_in_at ? String(r.last_sign_in_at) : null,
  }))
}

// p_modules null -> vuelve a los defaults del rol; array -> sólo esos módulos.
export async function adminSetUserModules(userId: string, modules: string[] | null): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_modules', { p_user_id: userId, p_modules: modules })
  if (error) throw error
}

export async function adminSetUserPassword(userId: string, password: string): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_password', { p_user_id: userId, p_password: password })
  if (error) throw error
}

export async function adminSetUserEmail(userId: string, email: string): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_email', { p_user_id: userId, p_email: email })
  if (error) throw error
}

export async function adminSetUserRole(userId: string, role: AuthUser['role']): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_role', { p_user_id: userId, p_role: role })
  if (error) throw error
}

export async function adminSetUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_active', { p_user_id: userId, p_active: isActive })
  if (error) throw error
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const { error } = await client().rpc('fn_admin_delete_user', { p_user_id: userId })
  if (error) throw error
}

const PIN_ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'No autorizado para cambiar el PIN.',
  pin_must_have_at_least_four_characters: 'El PIN debe tener al menos 4 caracteres.',
  active_profile_not_found: 'El usuario no está activo o no existe.',
  pin_already_in_use: 'Ese PIN ya lo usa otro usuario. Elige otro.',
}

export async function adminSetUserPin(userId: string, pin: string): Promise<void> {
  const { error } = await client().rpc('fn_set_user_pin', { p_user_id: userId, p_pin: pin })
  if (error) {
    const key = (error.message || '').trim()
    throw new Error(PIN_ERROR_MESSAGES[key] ?? error.message)
  }
}

export async function adminCreateUser(params: {
  email: string
  password: string
  fullName: string
  role: AuthUser['role']
}): Promise<string> {
  const { data, error } = await client().rpc('fn_admin_create_user', {
    p_email: params.email,
    p_password: params.password,
    p_full_name: params.fullName,
    p_role: params.role,
  })
  if (error) throw error
  return String(data)
}

