import { supabase } from '../supabase'

const API_URL = import.meta.env.VITE_API_URL

export async function getSuperadminToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function verifySuperadminSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, session: null, email: null }
  }

  try {
    const response = await fetch(`${API_URL}/superadmin/stats`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!response.ok) {
      return { ok: false, session: null, email: session.user?.email ?? null }
    }
    return { ok: true, session, email: session.user?.email ?? null }
  } catch {
    return { ok: false, session: null, email: session.user?.email ?? null }
  }
}

export async function superadminFetch(path, options = {}) {
  const token = await getSuperadminToken()
  if (!token) {
    throw new Error('No session')
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })
}
