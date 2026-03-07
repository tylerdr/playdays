"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | null = null

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function createClientSupabaseClient() {
  if (!hasSupabaseEnv()) {
    return null
  }

  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClient
}
