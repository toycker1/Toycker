import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { cookies as nextCookies } from "next/headers"

type AuthClaims = {
  sub?: string
}

const getSupabaseProjectRef = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    return null
  }

  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null
  } catch {
    return null
  }
}

export const hasSupabaseAuthCookie = cache(async () => {
  const projectRef = getSupabaseProjectRef()

  if (!projectRef) {
    return false
  }

  const authCookiePrefix = `sb-${projectRef}-auth-token`
  const cookieStore = await nextCookies()

  return cookieStore
    .getAll()
    .some((cookie) => cookie.name === authCookiePrefix || cookie.name.startsWith(`${authCookiePrefix}.`))
})

export const getAuthClaims = cache(async (): Promise<AuthClaims | null> => {
  if (!(await hasSupabaseAuthCookie())) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) {
    return null
  }

  return {
    sub: data.claims.sub,
  }
})

export const getAuthUserId = cache(async () => {
  const claims = await getAuthClaims()

  return claims?.sub ?? null
})

/**
 * Deduplicated auth user fetcher. 
 * React cache() ensures this only hits the network once per request, 
 * even if called in middleware, root layout, and page.
 */
export const getAuthUser = cache(async () => {
  if (!(await hasSupabaseAuthCookie())) {
    return null
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
})
