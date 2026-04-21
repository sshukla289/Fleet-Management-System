import { AUTH_STORAGE_KEY } from '../context/auth-context'
import { readViteEnv } from '../lib/readViteEnv'

const DEFAULT_HTTP_BASE_URL = readViteEnv('VITE_HTTP_BASE_URL') ?? 'http://localhost:8080'

function getRuntimeBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  const apiBaseUrl = runtimeConfig.__API_BASE_URL__ ?? `${DEFAULT_HTTP_BASE_URL}/api`
  return apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '')
}

export function getWebSocketHttpUrl() {
  return `${getRuntimeBaseUrl()}/ws`
}

export function getWebSocketBrokerUrl() {
  return getWebSocketHttpUrl().replace(/^http/i, 'ws')
}

export function readStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as { token?: string }
    return typeof session.token === 'string' && session.token.trim() ? session.token.trim() : null
  } catch {
    return null
  }
}
