import { AUTH_STORAGE_KEY } from '../context/auth-context'
import { readViteEnv } from '../lib/readViteEnv'
import type {
  AdminUser,
  AdminUserMutationResult,
  AdminUsersPage,
  CreateAdminUserInput,
  AssignShiftInput,
  AuditLogEntry,
  AuthSession,
  Alert,
  ChangePasswordInput,
  ChecklistType,
  CompleteTripInput,
  ComplianceCheckResult,
  CreateFuelLogInput,
  CreatePodInput,
  CreateDriverInput,
  CreateMaintenanceAlertInput,
  CreateMaintenanceScheduleInput,
  CreateRoutePlanInput,
  CreateTripInput,
  CreateVehicleInput,
  DashboardActionQueueItem,
  DashboardAnalytics,
  DashboardExceptionItem,
  CreateIssueInput,
  CreateSosInput,
  Driver,
  DriverIssue,
  DriverPerformanceDashboard,
  DriverTripHistory,
  DriverProfile,
  DriverAnalytics,
  FuelLog,
  LoginCredentials,
  MaintenanceAlert,
  MaintenanceSchedule,
  Notification,
  ProofOfDelivery,
  RoutePlan,
  SosAlert,
  SyncBatchResponse,
  SyncOperationType,
  Trip,
  TripChecklist,
  TripOtpSummary,
  TripAnalytics,
  TripOptimizationResult,
  TripStatus,
  TripTelemetryPoint,
  TripValidationResult,
  UpdateAdminUserInput,
  UpdateUserRoleInput,
  UpdateDriverInput,
  UpdateDriverProfileInput,
  UpdateMaintenanceAlertInput,
  UpdateProfileInput,
  UpdateRoutePlanInput,
  UpdateTripInput,
  UpdateTripChecklistInput,
  UpdateVehicleInput,
  ValidateTripOtpInput,
  UserProfile,
  Vehicle,
  VehicleAnalytics,
} from '../types'
import type { StopStatus } from '../types'


const DEFAULT_API_BASE_URL = readViteEnv('VITE_API_BASE_URL') ?? 'http://localhost:8080/api'

type AnalyticsFilters = {
  startDate?: string
  endDate?: string
  status?: TripStatus
}

type AuditFilters = {
  from?: string
  to?: string
}

type AdminUsersFilters = {
  page?: number
  size?: number
  search?: string
  role?: string
  status?: string
}

type RequestOptions = {
  auth?: boolean
  allow404?: boolean
}

function getApiBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  return (runtimeConfig.__API_BASE_URL__ ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

export function resolveApiAssetUrl(path: string | null | undefined) {
  if (!path) {
    return ''
  }

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const apiBaseUrl = getApiBaseUrl()
  const apiOrigin = apiBaseUrl.replace(/\/api$/, '')
  return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`
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

function shouldInvalidateSessionOnUnauthorized(path: string, message: string) {
  const normalizedMessage = message.trim().toLowerCase()

  if (path === '/auth/me') {
    return true
  }

  return normalizedMessage.includes('invalid or expired session')
}

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const shouldAttachAuth = options.auth ?? true
  const token = shouldAttachAuth ? readStoredToken() : null
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData

  let headers: HeadersInit = {
    ...(init?.headers ?? {}),
  }

  if (!isFormDataBody) {
    headers = {
      'Content-Type': 'application/json',
      ...headers,
    }
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
    const errorMessage = await parseError(response)

    if (response.status === 401 && (options.auth ?? true)) {
      if (typeof window !== 'undefined' && shouldInvalidateSessionOnUnauthorized(path, errorMessage)) {
        window.dispatchEvent(new CustomEvent('fleet:auth:unauthorized'))
      }
    }
    throw new Error(errorMessage)
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

function buildAdminUsersQuery(filters: AdminUsersFilters = {}) {
  const params = new URLSearchParams()

  params.set('page', String(filters.page ?? 0))
  params.set('size', String(filters.size ?? 25))

  if (filters.search?.trim()) {
    params.set('search', filters.search.trim())
  }
  if (filters.role?.trim() && filters.role.trim() !== 'ALL') {
    params.set('role', filters.role.trim())
  }
  if (filters.status?.trim() && filters.status.trim() !== 'ALL') {
    params.set('status', filters.status.trim())
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

function buildDriverScopeQuery(driverId?: string) {
  if (!driverId || !driverId.trim()) {
    return ''
  }

  const params = new URLSearchParams()
  params.set('driverId', driverId.trim())
  return `?${params.toString()}`
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

export function resendTripOtp(tripId: string): Promise<TripOtpSummary> {
  return request<TripOtpSummary>(`/trips/${tripId}/resend-otp`, { method: 'POST' })
}

export function validateTripOtp(tripId: string, input: ValidateTripOtpInput): Promise<TripOtpSummary> {
  return request<TripOtpSummary>(`/trips/${tripId}/otp/validate`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function pauseTrip(tripId: string, reason?: string): Promise<Trip> {
  const query = reason && reason.trim()
    ? `?reason=${encodeURIComponent(reason.trim())}`
    : ''
  return request<Trip>(`/trips/${tripId}/pause${query}`, { method: 'POST' })
}

export function resumeTrip(tripId: string): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}/resume`, { method: 'POST' })
}

export function completeTrip(tripId: string, input: CompleteTripInput): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}/complete`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createPod(input: CreatePodInput): Promise<ProofOfDelivery> {
  const formData = new FormData()
  formData.set('signatureDataUrl', input.signatureDataUrl)
  formData.set('photo', input.photo)

  return request<ProofOfDelivery>(`/trips/${input.tripId}/pod`, {
    method: 'POST',
    body: formData,
  })
}

export function createFuelLog(input: CreateFuelLogInput): Promise<FuelLog> {
  const formData = new FormData()
  formData.set('tripId', input.tripId)
  formData.set('amount', String(input.amount))
  formData.set('cost', String(input.cost))
  if (input.clientRequestId?.trim()) {
    formData.set('clientRequestId', input.clientRequestId.trim())
  }
  if (input.loggedAt?.trim()) {
    formData.set('loggedAt', input.loggedAt.trim())
  }
  if (input.receipt) {
    formData.set('receipt', input.receipt)
  }

  return request<FuelLog>('/fuel-log', {
    method: 'POST',
    body: formData,
  })
}

export function fetchTripFuelLogs(tripId: string): Promise<FuelLog[]> {
  return request<FuelLog[]>(`/trips/${tripId}/fuel-log`)
}

export function fetchTripPod(tripId: string): Promise<ProofOfDelivery | undefined> {
  return request<ProofOfDelivery>(`/trips/${tripId}/pod`, undefined, { allow404: true })
}

export function fetchTripChecklists(tripId: string): Promise<TripChecklist[]> {
  return request<TripChecklist[]>(`/trips/${tripId}/checklists`)
}

export function updateTripChecklist(
  tripId: string,
  type: ChecklistType,
  input: UpdateTripChecklistInput,
): Promise<TripChecklist> {
  return request<TripChecklist>(`/trips/${tripId}/checklists/${type}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function updateStopStatus(tripId: string, sequence: number, status: StopStatus): Promise<Trip> {
  return request<Trip>(`/trips/${tripId}/stops/${sequence}/status?status=${status}`, { method: 'POST' })
}

export function fetchTripTelemetry(tripId: string): Promise<TripTelemetryPoint[]> {
  return request<TripTelemetryPoint[]>(`/trips/${tripId}/telemetry`)
}

export function publishTripLocationUpdate(input: {
  tripId: string
  latitude: number
  longitude: number
  speed: number
  fuel: number
  currentStop?: string | null
  status?: StopStatus
  timestamp?: string
}): Promise<void> {
  return request<void>('/trips/location/update', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function submitTripTelemetry(input: {
  vehicleId?: string
  tripId?: string
  latitude: number
  longitude: number
  speed: number
  fuelLevel: number
  timestamp?: string
}): Promise<void> {
  return request<void>('/telemetry', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function syncOfflineBatch(input: {
  operations: Array<{
    clientRequestId: string
    type: SyncOperationType
    clientRecordedAt?: string
    conflictPolicy?: string
    payload: Record<string, unknown>
  }>
}): Promise<SyncBatchResponse> {
  return request<SyncBatchResponse>('/sync', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchVehicleTelemetry(vehicleId: string): Promise<TripTelemetryPoint[]> {
  return request<TripTelemetryPoint[]>(`/telemetry/${vehicleId}`)
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

export function fetchAdminUsers(filters: AdminUsersFilters = {}): Promise<AdminUsersPage> {
  return request<AdminUsersPage>(`/admin/users${buildAdminUsersQuery(filters)}`)
}

export function createAdminUser(input: CreateAdminUserInput): Promise<AdminUserMutationResult> {
  return request<AdminUserMutationResult>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAdminUser(id: string, input: UpdateAdminUserInput): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function updateUserRole(id: string, input: UpdateUserRoleInput): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function resetAdminUserPassword(id: string): Promise<AdminUserMutationResult> {
  return request<AdminUserMutationResult>(`/admin/users/${id}/reset-password`, {
    method: 'POST',
  })
}

export function deleteAdminUser(id: string): Promise<void> {
  return request<void>(`/admin/users/${id}`, {
    method: 'DELETE',
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

export function fetchDriverProfile(): Promise<DriverProfile> {
  return request<DriverProfile>('/driver/profile')
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

export function fetchAlerts(driverId?: string): Promise<Alert[]> {
  return request<Alert[]>(`/alerts${buildDriverScopeQuery(driverId)}`)
}

export function reportIssue(input: CreateIssueInput): Promise<DriverIssue> {
  const formData = new FormData()
  formData.set('type', input.type)
  formData.set('description', input.description)
  if (input.tripId?.trim()) {
    formData.set('tripId', input.tripId.trim())
  }
  if (typeof input.lat === 'number') {
    formData.set('lat', String(input.lat))
  }
  if (typeof input.lng === 'number') {
    formData.set('lng', String(input.lng))
  }
  if (input.image) {
    formData.set('image', input.image)
  }

  return request<DriverIssue>('/issues', {
    method: 'POST',
    body: formData,
  })
}

export function sendSos(input: CreateSosInput): Promise<SosAlert> {
  return request<SosAlert>('/sos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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

export function fetchNotifications(driverId?: string): Promise<Notification[]> {
  return request<Notification[]>(`/notifications${buildDriverScopeQuery(driverId)}`)
}

export function fetchNotificationCount(driverId?: string): Promise<number> {
  return request<number>(`/notifications/unread-count${buildDriverScopeQuery(driverId)}`)
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

export function fetchDriverPerformance(filters: AnalyticsFilters = {}): Promise<DriverPerformanceDashboard> {
  return request<DriverPerformanceDashboard>(`/driver/performance${buildAnalyticsQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
  })}`)
}

export function fetchDriverTripHistory(filters: AnalyticsFilters = {}): Promise<DriverTripHistory> {
  return request<DriverTripHistory>(`/driver/trips/history${buildAnalyticsQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    status: filters.status,
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

export function updateDriverProfile(input: UpdateDriverProfileInput): Promise<DriverProfile> {
  return request<DriverProfile>('/driver/profile', {
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
