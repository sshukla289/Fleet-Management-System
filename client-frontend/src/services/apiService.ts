import { AUTH_STORAGE_KEY } from '../context/auth-context'
import type {
  AdminUser,
  AssignShiftInput,
  AuditLogEntry,
  AuthSession,
  Alert,
  ChangePasswordInput,
  CompleteTripInput,
  ComplianceCheckResult,
  CreateDriverInput,
  CreateMaintenanceAlertInput,
  CreateMaintenanceScheduleInput,
  CreateRoutePlanInput,
  CreateTripInput,
  CreateVehicleInput,
  DashboardActionQueueItem,
  DashboardAnalytics,
  DashboardExceptionItem,
  Driver,
  DriverAnalytics,
  LoginCredentials,
  MaintenanceAlert,
  MaintenanceSchedule,
  Notification,
  RoutePlan,
  Trip,
  TripAnalytics,
  TripOptimizationResult,
  TripStatus,
  TripTelemetryPoint,
  TripValidationResult,
  UpdateUserRoleInput,
  UpdateDriverInput,
  UpdateMaintenanceAlertInput,
  UpdateProfileInput,
  UpdateRoutePlanInput,
  UpdateTripInput,
  UpdateVehicleInput,
  UserProfile,
  Vehicle,
  VehicleAnalytics,
} from '../types'
import type { StopStatus } from '../types'


const DEFAULT_API_BASE_URL = 'http://localhost:8080/api'

type AnalyticsFilters = {
  startDate?: string
  endDate?: string
  status?: TripStatus
}

type AuditFilters = {
  from?: string
  to?: string
}

type RequestOptions = {
  auth?: boolean
  allow404?: boolean
}

function getApiBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  return (runtimeConfig.__API_BASE_URL__ ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

function readStoredToken() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as Partial<AuthSession>
    return typeof session.token === 'string' && session.token.trim() ? session.token.trim() : null
  } catch {
    return null
  }
}

async function parseError(response: Response) {
  const fallback = `Request failed with status ${response.status}`

  try {
    const contentType = response.headers.get('Content-Type') ?? ''
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      return text || fallback
    }

    const body = (await response.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const shouldAttachAuth = options.auth ?? true
  const token = shouldAttachAuth ? readStoredToken() : null

  let headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init?.headers ?? {}),
  }

  if (token) {
    headers = {
      ...headers,
      Authorization: `Bearer ${token}`,
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  if (options.allow404 && response.status === 404) {
    return undefined as T
  }

  if (!response.ok) {
    if (response.status === 401 && (options.auth ?? true)) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fleet:auth:unauthorized'))
      }
    }
    throw new Error(await parseError(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function normalizeApiDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value
}

function buildAnalyticsQuery(filters: AnalyticsFilters) {
  const params = new URLSearchParams()

  if (filters.startDate) {
    params.set('startDate', normalizeApiDateTime(filters.startDate))
  }
  if (filters.endDate) {
    params.set('endDate', normalizeApiDateTime(filters.endDate))
  }
  if (filters.status) {
    params.set('status', filters.status)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

function buildAuditQuery(filters: AuditFilters) {
  const params = new URLSearchParams()

  if (filters.from) {
    params.set('from', normalizeApiDateTime(filters.from))
  }
  if (filters.to) {
    params.set('to', normalizeApiDateTime(filters.to))
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

export function fetchTrips(): Promise<Trip[]> {
  return request<Trip[]>('/trips')
}

export function createTrip(input: CreateTripInput): Promise<Trip> {
  return request<Trip>('/trips', { method: 'POST', body: JSON.stringify(input) })
}

export function updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function validateTrip(tripId: string): Promise<TripValidationResult> {
  return request<TripValidationResult>(`/trips/${tripId}/validate`, { method: 'POST' })
}

export function optimizeTrip(tripId: string): Promise<TripOptimizationResult> {
  return request<TripOptimizationResult>(`/trips/${tripId}/optimize`, { method: 'POST' })
}

export function dispatchTrip(tripId: string): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}/dispatch`, { method: 'POST' })
}

export function startTrip(tripId: string): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}/start`, { method: 'POST' })
}

export function completeTrip(tripId: string, input: CompleteTripInput): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}/complete`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateStopStatus(tripId: string, sequence: number, status: StopStatus): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}/stops/${sequence}/status?status=${status}`, { method: 'POST' })
}

export function fetchTripTelemetry(tripId: string): Promise<TripTelemetryPoint[]> {
  return request<TripTelemetryPoint[]>(`/trips/${tripId}/telemetry`)
}

export function login(credentials: LoginCredentials): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }, { auth: false })
}

export function fetchCurrentUser(): Promise<UserProfile> {
  return request<UserProfile>('/auth/me')
}

export function logoutRequest(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' })
}

export function fetchAdminUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>('/admin/users')
}

export function updateUserRole(id: string, input: UpdateUserRoleInput): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${id}/roles`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function fetchVehicles(): Promise<Vehicle[]> {
  return request<Vehicle[]>('/vehicles')
}

export function fetchVehicleById(id: string): Promise<Vehicle | undefined> {
  return request<Vehicle>(`/vehicles/${id}`, undefined, { allow404: true })
}

export function fetchDrivers(): Promise<Driver[]> {
  return request<Driver[]>('/drivers')
}

export function fetchMaintenanceAlerts(): Promise<MaintenanceAlert[]> {
  return request<MaintenanceAlert[]>('/maintenance-alerts')
}

export function fetchRoutePlans(): Promise<RoutePlan[]> {
  return request<RoutePlan[]>('/routes')
}

export function fetchProfile(): Promise<UserProfile> {
  return request<UserProfile>('/profile')
}

export function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(input) })
}

export function updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
  return request<Vehicle>(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteVehicle(id: string): Promise<void> {
  return request<void>(`/vehicles/${id}`, { method: 'DELETE' })
}

export function createDriver(input: CreateDriverInput): Promise<Driver> {
  return request<Driver>('/drivers', { method: 'POST', body: JSON.stringify(input) })
}

export function createMaintenanceAlert(input: CreateMaintenanceAlertInput): Promise<MaintenanceAlert> {
  return request<MaintenanceAlert>('/maintenance-alerts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMaintenanceAlert(id: string, input: UpdateMaintenanceAlertInput): Promise<MaintenanceAlert> {
  return request<MaintenanceAlert>(`/maintenance-alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteMaintenanceAlert(id: string): Promise<void> {
  return request<void>(`/maintenance-alerts/${id}`, { method: 'DELETE' })
}

export function fetchAlerts(): Promise<Alert[]> {
  return request<Alert[]>('/alerts')
}

export function fetchAlertById(id: string): Promise<Alert> {
  return request<Alert>(`/alerts/${id}`)
}

export function acknowledgeAlert(id: string): Promise<Alert> {
  return request<Alert>(`/alerts/${id}/acknowledge`, { method: 'POST' })
}

export function resolveAlert(id: string): Promise<Alert> {
  return request<Alert>(`/alerts/${id}/resolve`, { method: 'POST' })
}

export function fetchNotifications(): Promise<Notification[]> {
  return request<Notification[]>('/notifications')
}

export function fetchNotificationCount(): Promise<number> {
  return request<number>('/notifications/unread-count')
}

export function markNotificationRead(id: string): Promise<Notification> {
  return request<Notification>(`/notifications/${id}/read`, { method: 'POST' })
}

export function fetchAuditLogs(filters: AuditFilters = {}): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>(`/audit-logs${buildAuditQuery(filters)}`)
}

export function fetchAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>(`/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)
}

export function fetchMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
  return request<MaintenanceSchedule[]>('/maintenance/schedules')
}

export function createMaintenanceSchedule(input: CreateMaintenanceScheduleInput): Promise<MaintenanceSchedule> {
  return request<MaintenanceSchedule>('/maintenance/schedules', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchDashboardAnalytics(): Promise<DashboardAnalytics> {
  return request<DashboardAnalytics>('/analytics/dashboard')
}

export function fetchDashboardActionQueue(): Promise<DashboardActionQueueItem[]> {
  return request<DashboardActionQueueItem[]>('/dashboard/action-queue')
}

export function fetchDashboardExceptions(): Promise<DashboardExceptionItem[]> {
  return request<DashboardExceptionItem[]>('/dashboard/exceptions')
}

export function fetchTripAnalytics(filters: AnalyticsFilters = {}): Promise<TripAnalytics> {
  return request<TripAnalytics>(`/analytics/trips${buildAnalyticsQuery(filters)}`)
}

export function fetchVehicleAnalytics(filters: AnalyticsFilters): Promise<VehicleAnalytics> {
  return request<VehicleAnalytics>(`/analytics/vehicles${buildAnalyticsQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
  })}`)
}

export function fetchDriverAnalytics(filters: AnalyticsFilters): Promise<DriverAnalytics> {
  return request<DriverAnalytics>(`/analytics/drivers${buildAnalyticsQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
  })}`)
}

export function fetchComplianceCheck(tripId: string): Promise<ComplianceCheckResult> {
  return request<ComplianceCheckResult>(`/compliance/checks/${tripId}`)
}

export function assignShift(input: AssignShiftInput): Promise<Driver> {
  return request<Driver>('/drivers/assign-shift', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateDriver(id: string, input: UpdateDriverInput): Promise<Driver> {
  return request<Driver>(`/drivers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteDriver(id: string): Promise<void> {
  return request<void>(`/drivers/${id}`, { method: 'DELETE' })
}

export function optimizeRoutes(): Promise<RoutePlan[]> {
  return request<RoutePlan[]>('/routes/optimize', { method: 'POST' })
}

export function createRoutePlan(input: CreateRoutePlanInput): Promise<RoutePlan> {
  return request<RoutePlan>('/routes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateRoutePlan(id: string, input: UpdateRoutePlanInput): Promise<RoutePlan> {
  return request<RoutePlan>(`/routes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteRoutePlan(id: string): Promise<void> {
  return request<void>(`/routes/${id}`, { method: 'DELETE' })
}

export function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  return request<UserProfile>('/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return request<void>('/profile/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
