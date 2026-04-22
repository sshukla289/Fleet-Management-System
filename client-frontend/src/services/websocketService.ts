import { AUTH_STORAGE_KEY } from '../context/auth-context'
import { resolveHttpBaseUrl } from '../lib/runtimeUrls'

function getRuntimeBaseUrl() {
  return resolveHttpBaseUrl()
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
