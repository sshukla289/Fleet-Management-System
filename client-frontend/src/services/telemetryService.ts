import { AUTH_STORAGE_KEY } from '../context/auth-context'
import { readViteEnv } from '../lib/readViteEnv'
import type { CreateTelemetryInput, TelemetryData } from '../types'

const DEFAULT_API_BASE_URL = readViteEnv('VITE_API_BASE_URL') ?? 'http://localhost:8080/api'

interface ApiTelemetryPoint {
  vehicleId: string
  latitude: number
  longitude: number
  speed: number
  fuelLevel: number
  timestamp?: string
}

function getApiBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  return (runtimeConfig.__API_BASE_URL__ ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

function getToken() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as { token?: string }
    return session.token ?? null
  } catch {
    return null
  }
}

function mapTelemetryPoint(point: ApiTelemetryPoint, index: number): TelemetryData {
  return {
    timestamp: point.timestamp
      ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : `${8 + index}:00`,
    speed: Math.round(point.speed),
    fuelUsage: Math.max(6, Math.round((100 - point.fuelLevel) / 3)),
    engineTemperature: 78 + ((Math.round(point.speed) + index * 3) % 25),
  }
}

function mapSubmittedTelemetry(input: CreateTelemetryInput): TelemetryData {
  const timestampLabel = input.timestamp
    ? new Date(input.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return {
    timestamp: timestampLabel,
    speed: Math.round(input.speed),
    fuelUsage: Math.max(6, Math.round((100 - input.fuelLevel) / 3)),
    engineTemperature: 78 + (Math.round(input.speed) % 25),
  }
}

export async function fetchVehicleTelemetry(vehicleId: string): Promise<TelemetryData[]> {
  const token = getToken()
  const response = await fetch(`${getApiBaseUrl()}/telemetry/${vehicleId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  const data = (await response.json()) as ApiTelemetryPoint[]
  return data.map(mapTelemetryPoint)
}

export async function submitVehicleTelemetry(input: CreateTelemetryInput): Promise<TelemetryData> {
  const token = getToken()
  const response = await fetch(`${getApiBaseUrl()}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return mapSubmittedTelemetry(input)
}
