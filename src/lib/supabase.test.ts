import { describe, expect, it } from 'vitest'
import { isSupabaseWriteBlocked } from './supabase'

describe('local Supabase write protection', () => {
  it('allows read requests', () => {
    expect(isSupabaseWriteBlocked('https://supabase.example.com/rest/v1/orders', { method: 'GET' })).toBe(false)
  })

  it('blocks REST inserts in development', () => {
    expect(isSupabaseWriteBlocked('https://supabase.example.com/rest/v1/orders', { method: 'POST' })).toBe(true)
  })

  it('blocks REST updates and deletes in development', () => {
    expect(isSupabaseWriteBlocked('https://supabase.example.com/rest/v1/orders?id=eq.demo', { method: 'PATCH' })).toBe(true)
    expect(isSupabaseWriteBlocked('https://supabase.example.com/rest/v1/orders?id=eq.demo', { method: 'DELETE' })).toBe(true)
  })

  it('blocks function calls that may write to the database', () => {
    expect(isSupabaseWriteBlocked('https://supabase.example.com/functions/v1/telegram-ai-intake', { method: 'POST' })).toBe(true)
  })

  it('keeps Supabase authentication and read-only RPC calls available', () => {
    expect(isSupabaseWriteBlocked('https://supabase.example.com/auth/v1/token?grant_type=password', { method: 'POST' })).toBe(false)
    expect(isSupabaseWriteBlocked('https://supabase.example.com/rest/v1/rpc/fn_get_product_ranking', { method: 'POST' })).toBe(false)
  })
})
