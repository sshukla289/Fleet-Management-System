import { readViteEnv } from './readViteEnv'

const DEFAULT_BACKEND_PORT = '8081'

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function stripApiSuffix(value: string) {
  return trimTrailingSlash(value).replace(/\/api$/, '')
}

function readRuntimeApiOverride() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  const value = runtimeConfig.__API_BASE_URL__
  return typeof value === 'string' && value.trim() ? trimTrailingSlash(value.trim()) : undefined
}

function inferBackendOrigin() {
  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_BACKEND_PORT}`
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  const hostname = window.location.hostname || 'localhost'
  return `${protocol}//${hostname}:${DEFAULT_BACKEND_PORT}`
}

export function resolveHttpBaseUrl() {
  const apiOverride = readRuntimeApiOverride()
  if (apiOverride) {
    return stripApiSuffix(apiOverride)
  }

  const envHttpBaseUrl = readViteEnv('VITE_HTTP_BASE_URL')
  if (envHttpBaseUrl) {
    return trimTrailingSlash(envHttpBaseUrl)
  }

  const envApiBaseUrl = readViteEnv('VITE_API_BASE_URL')
  if (envApiBaseUrl) {
    return stripApiSuffix(envApiBaseUrl)
  }

  return inferBackendOrigin()
}

export function resolveApiBaseUrl() {
  const apiOverride = readRuntimeApiOverride()
  if (apiOverride) {
    return apiOverride
  }

  const envApiBaseUrl = readViteEnv('VITE_API_BASE_URL')
  if (envApiBaseUrl) {
    return trimTrailingSlash(envApiBaseUrl)
  }

  const envHttpBaseUrl = readViteEnv('VITE_HTTP_BASE_URL')
  if (envHttpBaseUrl) {
    return `${trimTrailingSlash(envHttpBaseUrl)}/api`
  }

  return `${inferBackendOrigin()}/api`
}
