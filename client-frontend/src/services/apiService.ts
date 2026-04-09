import type {
  AssignShiftInput,
  AuditLogEntry,
  AuthSession,
  Alert,
  CompleteTripInput,
  ChangePasswordInput,
  ComplianceCheckResult,
  CreateMaintenanceAlertInput,
  CreateMaintenanceScheduleInput,
  CreateDriverInput,
  CreateTripInput,
  CreateRoutePlanInput,
  CreateVehicleInput,
  DriverAnalytics,
  Driver,
  DashboardActionQueueItem,
  DashboardAnalytics,
  DashboardExceptionItem,
  LoginCredentials,
  MaintenanceAlert,
  MaintenanceSchedule,
  Notification,
  Trip,
  TripAnalytics,
  TripOptimizationResult,
  TripStatus,
  TripValidationResult,
  RoutePlan,
  TripTelemetryPoint,
  UpdateRoutePlanInput,
  UpdateDriverInput,
  UpdateMaintenanceAlertInput,
  UpdateProfileInput,
  UpdateVehicleInput,
  UserProfile,
  Vehicle,
  VehicleAnalytics,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api'
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'

function getApiBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  return (runtimeConfig.__API_BASE_URL__ ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

let vehicles: Vehicle[] = [
  {
    id: 'VH-101',
    name: 'Atlas Prime',
    type: 'Heavy Truck',
    status: 'Active',
    location: 'Mumbai Hub',
    fuelLevel: 72,
    mileage: 128_540,
    driverId: 'DR-201',
  },
  {
    id: 'VH-102',
    name: 'Coastal Runner',
    type: 'Reefer Van',
    status: 'Idle',
    location: 'Pune Depot',
    fuelLevel: 54,
    mileage: 87_920,
    driverId: 'DR-202',
  },
  {
    id: 'VH-103',
    name: 'Northline Carrier',
    type: 'Flatbed',
    status: 'Maintenance',
    location: 'Nagpur Service Bay',
    fuelLevel: 31,
    mileage: 165_210,
    driverId: 'DR-203',
  },
  {
    id: 'VH-104',
    name: 'Urban Sprint',
    type: 'Light Commercial',
    status: 'Active',
    location: 'Bengaluru Last-Mile Center',
    fuelLevel: 81,
    mileage: 43_180,
    driverId: 'DR-204',
  },
]

let drivers: Driver[] = [
  {
    id: 'DR-201',
    name: 'Aarav Sharma',
    status: 'On Duty',
    licenseType: 'HMV',
    assignedVehicleId: 'VH-101',
    hoursDrivenToday: 5.2,
  },
  {
    id: 'DR-202',
    name: 'Nisha Patel',
    status: 'Resting',
    licenseType: 'LMV',
    assignedVehicleId: 'VH-102',
    hoursDrivenToday: 3.4,
  },
  {
    id: 'DR-203',
    name: 'Rohan Verma',
    status: 'Off Duty',
    licenseType: 'HMV',
    assignedVehicleId: 'VH-103',
    hoursDrivenToday: 0,
  },
  {
    id: 'DR-204',
    name: 'Ishita Mehra',
    status: 'On Duty',
    licenseType: 'Transport',
    assignedVehicleId: 'VH-104',
    hoursDrivenToday: 6.1,
  },
]

let maintenanceAlerts: MaintenanceAlert[] = [
  {
    id: 'MA-1',
    vehicleId: 'VH-103',
    title: 'Brake pad replacement',
    severity: 'Critical',
    dueDate: '2026-04-04',
    description: 'Brake wear threshold exceeded during latest inspection.',
  },
  {
    id: 'MA-2',
    vehicleId: 'VH-101',
    title: 'Oil pressure inspection',
    severity: 'Medium',
    dueDate: '2026-04-06',
    description: 'Oil pressure trend dipped below preferred baseline.',
  },
  {
    id: 'MA-3',
    vehicleId: 'VH-102',
    title: 'Refrigeration calibration',
    severity: 'Low',
    dueDate: '2026-04-08',
    description: 'Temperature drift detected during cold-chain simulation.',
  },
]

const alerts: Alert[] = [
  {
    id: 'AL-1',
    category: 'MAINTENANCE',
    severity: 'CRITICAL',
    status: 'OPEN',
    title: 'Brake pad replacement',
    description: 'Brake wear threshold exceeded during latest inspection.',
    sourceType: 'maintenance',
    sourceId: 'MA-1',
    relatedTripId: null,
    relatedVehicleId: 'VH-103',
    metadataJson: '{"reasonCode":"BRAKE_INSPECTION"}',
    createdAt: '2026-04-09T07:00:00',
    updatedAt: '2026-04-09T07:00:00',
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
  },
  {
    id: 'AL-2',
    category: 'COMPLIANCE',
    severity: 'HIGH',
    status: 'ACKNOWLEDGED',
    title: 'Driver hour review',
    description: 'Trip TRIP-1002 is blocked by duty-hour and license checks.',
    sourceType: 'compliance',
    sourceId: 'TRIP-1002',
    relatedTripId: 'TRIP-1002',
    relatedVehicleId: 'VH-103',
    metadataJson: '{"blockingReasons":["Driver is off duty and cannot be dispatched.","Vehicle is in maintenance and cannot be dispatched."]}',
    createdAt: '2026-04-09T08:00:00',
    updatedAt: '2026-04-09T08:30:00',
    acknowledgedAt: '2026-04-09T08:15:00',
    resolvedAt: null,
    closedAt: null,
  },
  {
    id: 'AL-3',
    category: 'LOW_FUEL',
    severity: 'MEDIUM',
    status: 'OPEN',
    title: 'Fuel reserve warning',
    description: 'Vehicle VH-102 fuel level dropped below the preferred threshold.',
    sourceType: 'telemetry',
    sourceId: 'VH-102',
    relatedTripId: null,
    relatedVehicleId: 'VH-102',
    metadataJson: '{"fuelLevel":18}',
    createdAt: '2026-04-09T08:45:00',
    updatedAt: '2026-04-09T08:45:00',
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
  },
]

const notifications: Notification[] = [
  {
    id: 'NT-1',
    category: 'CRITICAL_ALERT',
    severity: 'CRITICAL',
    title: 'Critical alert: Brake pad replacement',
    message: 'Brake wear threshold exceeded during latest inspection.',
    entityType: 'ALERT',
    entityId: 'AL-1',
    tripId: null,
    vehicleId: 'VH-103',
    metadataJson: '{"reasonCode":"BRAKE_INSPECTION"}',
    createdAt: '2026-04-09T07:00:00',
    readAt: null,
    read: false,
  },
  {
    id: 'NT-2',
    category: 'TRIP_DISPATCH',
    severity: 'MEDIUM',
    title: 'Trip dispatched: TRIP-1001',
    message: 'Trip TRIP-1001 has been dispatched and is ready for live tracking.',
    entityType: 'TRIP',
    entityId: 'TRIP-1001',
    tripId: 'TRIP-1001',
    vehicleId: 'VH-101',
    metadataJson: null,
    createdAt: '2026-04-09T08:25:00',
    readAt: null,
    read: false,
  },
  {
    id: 'NT-3',
    category: 'MAINTENANCE_REMINDER',
    severity: 'MEDIUM',
    title: 'Maintenance reminder: Brake inspection bay visit',
    message: 'Blocks dispatch until brake system inspection is signed off.',
    entityType: 'MAINTENANCE_SCHEDULE',
    entityId: 'MS-1',
    tripId: null,
    vehicleId: 'VH-103',
    metadataJson: '{"reasonCode":"BRAKE_INSPECTION","blockDispatch":true}',
    createdAt: '2026-04-09T06:00:00',
    readAt: '2026-04-09T06:40:00',
    read: true,
  },
  {
    id: 'NT-4',
    category: 'COMPLIANCE_REMINDER',
    severity: 'HIGH',
    title: 'Compliance reminder: TRIP-1002',
    message: 'Trip TRIP-1002 is blocked by duty-hour and license checks.',
    entityType: 'TRIP',
    entityId: 'TRIP-1002',
    tripId: 'TRIP-1002',
    vehicleId: 'VH-103',
    metadataJson: '{"blockingReasons":["Driver is off duty and cannot be dispatched.","Vehicle is in maintenance and cannot be dispatched."]}',
    createdAt: '2026-04-09T08:15:00',
    readAt: null,
    read: false,
  },
]

let maintenanceSchedules: MaintenanceSchedule[] = [
  {
    id: 'MS-1',
    vehicleId: 'VH-103',
    title: 'Brake inspection bay visit',
    status: 'PLANNED',
    plannedStartDate: '2026-04-09',
    plannedEndDate: '2026-04-10',
    blockDispatch: true,
    reasonCode: 'BRAKE_INSPECTION',
    notes: 'Blocks dispatch until brake system inspection is signed off.',
    createdAt: '2026-04-09T06:00:00',
    updatedAt: '2026-04-09T06:00:00',
  },
  {
    id: 'MS-2',
    vehicleId: 'VH-102',
    title: 'Refrigeration recalibration',
    status: 'IN_PROGRESS',
    plannedStartDate: '2026-04-09',
    plannedEndDate: '2026-04-11',
    blockDispatch: true,
    reasonCode: 'COLD_CHAIN',
    notes: 'Cold chain unit requires recalibration before release.',
    createdAt: '2026-04-09T06:30:00',
    updatedAt: '2026-04-09T06:30:00',
  },
]

let routePlans: RoutePlan[] = [
  {
    id: 'RT-501',
    name: 'Western Corridor Morning Run',
    status: 'In Progress',
    distanceKm: 342,
    estimatedDuration: '6h 15m',
    stops: ['Mumbai Hub', 'Lonavala', 'Pune Depot', 'Satara Crossdock'],
  },
  {
    id: 'RT-502',
    name: 'Central Maintenance Loop',
    status: 'Scheduled',
    distanceKm: 184,
    estimatedDuration: '3h 40m',
    stops: ['Nagpur Service Bay', 'Wardha', 'Amravati'],
  },
  {
    id: 'RT-503',
    name: 'Southern Last-Mile Sweep',
    status: 'Completed',
    distanceKm: 96,
    estimatedDuration: '2h 10m',
    stops: ['Bengaluru Center', 'Indiranagar', 'Whitefield', 'Yelahanka'],
  },
]

let trips: Trip[] = [
  {
    tripId: 'TRIP-1001',
    routeId: 'RT-501',
    assignedVehicleId: 'VH-101',
    assignedDriverId: 'DR-201',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    source: 'Mumbai Hub',
    destination: 'Pune Depot',
    stops: ['Mumbai Hub', 'Lonavala', 'Pune Depot', 'Satara Crossdock'],
    plannedStartTime: '2026-04-09T08:00:00',
    plannedEndTime: '2026-04-09T14:15:00',
    actualStartTime: '2026-04-09T08:25:00',
    actualEndTime: null,
    estimatedDistance: 342,
    actualDistance: 128,
    estimatedDuration: '6h 15m',
    actualDuration: '2h 10m',
    dispatchStatus: 'DISPATCHED',
    complianceStatus: 'COMPLIANT',
    optimizationStatus: 'OPTIMIZED',
    remarks: 'Morning dispatch in motion.',
  },
]

const profile: UserProfile = {
  id: 'USR-1',
  name: 'Shreya Operations',
  role: 'Fleet Operations Manager',
  email: 'shreya.ops@fleetcontrol.dev',
  assignedRegion: 'West and South India',
}

const auditLogs: AuditLogEntry[] = [
  {
    id: 'AU-1',
    actor: 'system',
    action: 'TRIP_CREATED',
    entityType: 'TRIP',
    entityId: 'TRIP-1001',
    summary: 'Trip created.',
    detailsJson: '{"routeId":"RT-501","vehicleId":"VH-101","driverId":"DR-201","priority":"HIGH"}',
    createdAt: '2026-04-09T07:45:00',
  },
  {
    id: 'AU-2',
    actor: 'system',
    action: 'TRIP_DISPATCHED',
    entityType: 'TRIP',
    entityId: 'TRIP-1001',
    summary: 'Trip dispatched.',
    detailsJson: '{"vehicleId":"VH-101","driverId":"DR-201","dispatchStatus":"DISPATCHED"}',
    createdAt: '2026-04-09T08:25:00',
  },
  {
    id: 'AU-3',
    actor: 'system',
    action: 'ALERT_ACKNOWLEDGED',
    entityType: 'ALERT',
    entityId: 'AL-2',
    summary: 'Alert acknowledged.',
    detailsJson: '{"category":"COMPLIANCE","severity":"HIGH","status":"ACKNOWLEDGED"}',
    createdAt: '2026-04-09T08:30:00',
  },
]

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function withFallback<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  if (!USE_MOCK_API) {
    return loader()
  }

  if (typeof fetch !== 'function') {
    return fallback
  }

  try {
    return await loader()
  } catch (error) {
    console.warn('Falling back to mock API data:', error)
    return fallback
  }
}

function cloneVehicle(vehicle: Vehicle): Vehicle {
  return { ...vehicle }
}

function nextVehicleId() {
  const maxVehicleNumber = vehicles.reduce((max, vehicle) => {
    const vehicleNumber = Number(vehicle.id.replace('VH-', ''))
    return Number.isFinite(vehicleNumber) ? Math.max(max, vehicleNumber) : max
  }, 100)

  return `VH-${maxVehicleNumber + 1}`
}

function cloneDriver(driver: Driver): Driver {
  return { ...driver }
}

function nextDriverId() {
  const maxDriverNumber = drivers.reduce((max, driver) => {
    const driverNumber = Number(driver.id.replace('DR-', ''))
    return Number.isFinite(driverNumber) ? Math.max(max, driverNumber) : max
  }, 200)

  return `DR-${maxDriverNumber + 1}`
}

function cloneMaintenanceAlert(alert: MaintenanceAlert): MaintenanceAlert {
  return { ...alert }
}

function nextMaintenanceAlertId() {
  const maxAlertNumber = maintenanceAlerts.reduce((max, alert) => {
    const alertNumber = Number(alert.id.replace('MA-', ''))
    return Number.isFinite(alertNumber) ? Math.max(max, alertNumber) : max
  }, 0)

  return `MA-${maxAlertNumber + 1}`
}

function cloneAlert(alert: Alert): Alert {
  return { ...alert }
}

function cloneNotification(notification: Notification): Notification {
  return { ...notification }
}

function cloneAuditLog(entry: AuditLogEntry): AuditLogEntry {
  return { ...entry }
}

function cloneMaintenanceSchedule(schedule: MaintenanceSchedule): MaintenanceSchedule {
  return { ...schedule }
}

function nextMaintenanceScheduleId() {
  const maxScheduleNumber = maintenanceSchedules.reduce((max, schedule) => {
    const scheduleNumber = Number(schedule.id.replace('MS-', ''))
    return Number.isFinite(scheduleNumber) ? Math.max(max, scheduleNumber) : max
  }, 0)

  return `MS-${maxScheduleNumber + 1}`
}

function cloneRoutePlan(route: RoutePlan): RoutePlan {
  return {
    ...route,
    stops: [...route.stops],
  }
}

function statusPriority(status: RoutePlan['status']) {
  switch (status) {
    case 'In Progress':
      return 0
    case 'Scheduled':
      return 1
    default:
      return 2
  }
}

function optimizeRouteStops(stops: string[]) {
  if (stops.length <= 2) {
    return [...stops]
  }

  const start = stops[0]
  const end = stops[stops.length - 1]
  const middleStops = stops.slice(1, -1).sort((left, right) => left.localeCompare(right))

  return [start, ...middleStops, end]
}

function optimizeRouteDistance(distanceKm: number, stopCount: number) {
  if (distanceKm <= 0) {
    return distanceKm
  }

  const reductionFactor = Math.min(0.04 + Math.max(stopCount - 2, 0) * 0.02, 0.18)
  const optimizedDistance = Math.round(distanceKm * (1 - reductionFactor))
  return Math.max(1, Math.min(distanceKm, optimizedDistance))
}

function parseRouteDurationMinutes(estimatedDuration: string) {
  const normalized = estimatedDuration.trim().toLowerCase()
  if (!normalized) {
    return 0
  }

  const hourMarker = normalized.indexOf('h')
  const minuteMarker = normalized.indexOf('m')
  const hours =
    hourMarker >= 0 ? Number.parseInt(normalized.slice(0, hourMarker).trim(), 10) || 0 : 0
  const minutes =
    minuteMarker >= 0
      ? Number.parseInt(normalized.slice(hourMarker >= 0 ? hourMarker + 1 : 0, minuteMarker).trim(), 10) || 0
      : 0

  return hours * 60 + minutes
}

function formatRouteDurationMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes)
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

function optimizeRouteDuration(
  estimatedDuration: string,
  currentDistance: number,
  optimizedDistance: number,
  stopCount: number,
) {
  const currentMinutes = parseRouteDurationMinutes(estimatedDuration)
  if (currentMinutes <= 0) {
    return estimatedDuration
  }

  const distanceRatio = currentDistance > 0 ? optimizedDistance / currentDistance : 1
  let optimizedMinutes = Math.round(currentMinutes * distanceRatio)

  if (stopCount > 2) {
    optimizedMinutes = Math.max(20, optimizedMinutes - Math.min((stopCount - 2) * 4, 18))
  }

  return formatRouteDurationMinutes(optimizedMinutes)
}

function optimizeRoutePlanData(route: RoutePlan): RoutePlan {
  const optimizedStops = optimizeRouteStops(route.stops)
  const optimizedDistance = optimizeRouteDistance(route.distanceKm, optimizedStops.length)

  return {
    ...route,
    distanceKm: optimizedDistance,
    estimatedDuration: optimizeRouteDuration(
      route.estimatedDuration,
      route.distanceKm,
      optimizedDistance,
      optimizedStops.length,
    ),
    stops: optimizedStops,
  }
}

function nextRoutePlanId() {
  const maxRouteNumber = routePlans.reduce((max, route) => {
    const routeNumber = Number(route.id.replace('RT-', ''))
    return Number.isFinite(routeNumber) ? Math.max(max, routeNumber) : max
  }, 500)

  return `RT-${maxRouteNumber + 1}`
}

function cloneTrip(trip: Trip): Trip {
  return {
    ...trip,
    stops: [...trip.stops],
  }
}

function nextTripId() {
  const maxTripNumber = trips.reduce((max, trip) => {
    const tripNumber = Number(trip.tripId.replace('TRIP-', ''))
    return Number.isFinite(tripNumber) ? Math.max(max, tripNumber) : max
  }, 1000)

  return `TRIP-${maxTripNumber + 1}`
}

function normalizeTripStops(stops: string[]) {
  return stops.filter((stop) => stop.trim().length > 0)
}

function parseTripDurationMinutes(duration: string) {
  const normalized = duration.trim().toLowerCase()
  if (!normalized) {
    return 0
  }

  const hourMarker = normalized.indexOf('h')
  const minuteMarker = normalized.indexOf('m')
  const hours =
    hourMarker >= 0 ? Number.parseInt(normalized.slice(0, hourMarker).trim(), 10) || 0 : 0
  const minutes =
    minuteMarker >= 0
      ? Number.parseInt(normalized.slice(hourMarker >= 0 ? hourMarker + 1 : 0, minuteMarker).trim(), 10) || 0
      : 0

  return hours * 60 + minutes
}

function formatTripDurationMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes)
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

function optimizeTripStops(stops: string[]) {
  if (stops.length <= 2) {
    return [...stops]
  }

  const start = stops[0]
  const end = stops[stops.length - 1]
  const middleStops = stops.slice(1, -1).sort((left, right) => left.localeCompare(right))
  return [start, ...middleStops, end]
}

function optimizeTripDistance(distance: number, stopCount: number) {
  if (distance <= 0) {
    return distance
  }

  const reductionFactor = Math.min(0.04 + Math.max(stopCount - 2, 0) * 0.02, 0.18)
  const optimizedDistance = Math.round(distance * (1 - reductionFactor))
  return Math.max(1, Math.min(distance, optimizedDistance))
}

function optimizeTripDuration(duration: string, currentDistance: number, optimizedDistance: number) {
  const currentMinutes = parseTripDurationMinutes(duration)
  if (currentMinutes <= 0 || currentDistance <= 0 || optimizedDistance <= 0) {
    return duration
  }

  const distanceRatio = optimizedDistance / currentDistance
  const optimizedMinutes = Math.round(currentMinutes * distanceRatio)
  return formatTripDurationMinutes(Math.max(15, optimizedMinutes))
}

function parseDateTime(value?: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

type AnalyticsFilters = {
  startDate?: string
  endDate?: string
  status?: TripStatus
}

type AuditFilters = {
  from?: string
  to?: string
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

function isWithinDateRange(
  value: string | Date | null | undefined,
  startDate?: string,
  endDate?: string,
) {
  const timestamp = value instanceof Date ? value : parseDateTime(value)
  if (!timestamp) {
    return false
  }

  const start = parseDateTime(startDate)
  const end = parseDateTime(endDate)

  if (start && timestamp < start) {
    return false
  }

  if (end && timestamp > end) {
    return false
  }

  return true
}

function tripReferenceTime(trip: Trip) {
  return parseDateTime(trip.actualEndTime) ?? parseDateTime(trip.actualStartTime) ?? parseDateTime(trip.plannedStartTime)
}

function filterTripsForAnalytics(filters: AnalyticsFilters) {
  return trips
    .filter((trip) => !filters.status || trip.status === filters.status)
    .filter((trip) => {
      if (!filters.startDate && !filters.endDate) {
        return true
      }

      const reference = tripReferenceTime(trip)
      return reference ? isWithinDateRange(reference, filters.startDate, filters.endDate) : false
    })
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10
}

function formatPercent(value: number) {
  return `${roundOneDecimal(value).toFixed(1)}%`
}

function formatMinutes(value: number) {
  return `${roundOneDecimal(value).toFixed(1)} min`
}

function calculateDelayMinutes(trip: Trip, now = new Date()) {
  const plannedEnd = parseDateTime(trip.plannedEndTime)
  if (!plannedEnd) {
    return 0
  }

  const reference = parseDateTime(trip.actualEndTime) ?? now
  return Math.max(0, Math.round((reference.getTime() - plannedEnd.getTime()) / 60000))
}

function buildTripTrendBuckets(filteredTrips: Trip[]) {
  const delayedTrips = filteredTrips.filter((trip) => isTripDelayed(trip))
  const buckets: Record<string, number> = {
    '0-15 min': 0,
    '16-30 min': 0,
    '31-60 min': 0,
    '60+ min': 0,
  }

  delayedTrips.forEach((trip) => {
    const minutes = calculateDelayMinutes(trip)
    const bucket = minutes <= 15 ? '0-15 min' : minutes <= 30 ? '16-30 min' : minutes <= 60 ? '31-60 min' : '60+ min'
    buckets[bucket] += 1
  })

  return [
    { label: '0-15 min', count: buckets['0-15 min'], note: 'Short delays' },
    { label: '16-30 min', count: buckets['16-30 min'], note: 'Moderate delays' },
    { label: '31-60 min', count: buckets['31-60 min'], note: 'Material delays' },
    { label: '60+ min', count: buckets['60+ min'], note: 'Severe delays' },
  ]
}

function buildCategoryTrends(counts: Record<string, number>, noteSuffix: string) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({
      label,
      count,
      note: `Counted from persisted ${noteSuffix}`,
    }))
}

function buildTripAnalyticsFallback(filters: AnalyticsFilters): TripAnalytics {
  const now = new Date()
  const filteredTrips = filterTripsForAnalytics(filters)
  const completedTrips = filteredTrips.filter((trip) => trip.status === 'COMPLETED')
  const cancelledTrips = filteredTrips.filter((trip) => trip.status === 'CANCELLED')
  const delayedTrips = filteredTrips.filter((trip) => isTripDelayed(trip, now))
  const onTimeCompleted = completedTrips.filter((trip) => {
    const actualEnd = parseDateTime(trip.actualEndTime)
    const plannedEnd = parseDateTime(trip.plannedEndTime)
    return actualEnd && plannedEnd ? actualEnd <= plannedEnd : false
  }).length
  const terminalTrips = completedTrips.length + cancelledTrips.length
  const onTimeDeliveryRate = completedTrips.length ? roundOneDecimal((onTimeCompleted * 100) / completedTrips.length) : 0
  const tripSuccessRate = terminalTrips ? roundOneDecimal((completedTrips.length * 100) / terminalTrips) : 0
  const averageDelayMinutes =
    delayedTrips.length > 0
      ? roundOneDecimal(delayedTrips.reduce((sum, trip) => sum + calculateDelayMinutes(trip, now), 0) / delayedTrips.length)
      : 0

  const alertCounts = alerts
    .filter((alert) => !filters.startDate && !filters.endDate ? true : isWithinDateRange(alert.createdAt, filters.startDate, filters.endDate))
    .reduce<Record<string, number>>((counts, alert) => {
      counts[alert.category] = (counts[alert.category] ?? 0) + 1
      return counts
    }, {})

  return {
    generatedAt: now.toISOString(),
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null,
    statusFilter: filters.status ?? 'ALL',
    kpis: [
      {
        key: 'completed-trips',
        label: 'Completed trips',
        value: String(completedTrips.length),
        note: 'Trips finished in the selected range',
        tone: 'mint',
      },
      {
        key: 'cancelled-trips',
        label: 'Cancelled trips',
        value: String(cancelledTrips.length),
        note: 'Trips closed before delivery',
        tone: 'rose',
      },
      {
        key: 'on-time-rate',
        label: 'On-time delivery',
        value: formatPercent(onTimeDeliveryRate),
        note: 'Completed trips finished on or before plan',
        tone: 'blue',
      },
      {
        key: 'success-rate',
        label: 'Trip success',
        value: formatPercent(tripSuccessRate),
        note: 'Completed versus terminal trips',
        tone: 'teal',
      },
      {
        key: 'avg-delay',
        label: 'Average delay',
        value: formatMinutes(averageDelayMinutes),
        note: 'Delay among late trips only',
        tone: 'amber',
      },
      {
        key: 'fuel-efficiency',
        label: 'Fuel efficiency',
        value: 'N/A',
        note: 'Derived from telemetry fuel delta',
        tone: 'violet',
      },
    ],
    onTimeDeliveryRate,
    tripSuccessRate,
    averageDelayMinutes,
    fuelEfficiencyKmPerFuelUnit: 0,
    completedTrips: completedTrips.length,
    cancelledTrips: cancelledTrips.length,
    delayedTrips: delayedTrips.length,
    delayTrends: buildTripTrendBuckets(filteredTrips),
    alertFrequencyByCategory: buildCategoryTrends(alertCounts, 'alerts'),
    recentTrips: filteredTrips
      .slice()
      .sort((left, right) => {
        const leftTime = tripReferenceTime(left)?.getTime() ?? 0
        const rightTime = tripReferenceTime(right)?.getTime() ?? 0
        return rightTime - leftTime
      })
      .slice(0, 12)
      .map((trip) => ({
        tripId: trip.tripId,
        routeId: trip.routeId,
        vehicleId: trip.assignedVehicleId,
        driverId: trip.assignedDriverId,
        status: trip.status,
        plannedEndTime: trip.plannedEndTime ?? null,
        actualEndTime: trip.actualEndTime ?? null,
        delayMinutes: calculateDelayMinutes(trip, now),
        actualDistance: trip.actualDistance,
        fuelUsed: null,
        completionProcessedAt: trip.actualEndTime ?? null,
      })),
  }
}

function buildVehicleAnalyticsFallback(filters: AnalyticsFilters): VehicleAnalytics {
  const filteredTrips = filterTripsForAnalytics(filters)
  const blockingSchedules = maintenanceSchedules.filter(
    (schedule) => schedule.blockDispatch && ['PLANNED', 'IN_PROGRESS'].includes(schedule.status),
  )
  const blockingByVehicle = new Map(blockingSchedules.map((schedule) => [schedule.vehicleId, schedule]))
  const rows = vehicles
    .map((vehicle) => {
      const vehicleTrips = filteredTrips.filter((trip) => trip.assignedVehicleId === vehicle.id)
      const completedTrips = vehicleTrips.filter((trip) => trip.status === 'COMPLETED').length
      const activeTrips = vehicleTrips.filter((trip) => ['DISPATCHED', 'IN_PROGRESS'].includes(trip.status)).length
      const utilizationPercent = vehicleTrips.length ? roundOneDecimal(((completedTrips + activeTrips) * 100) / vehicleTrips.length) : 0
      const blockingSchedule = blockingByVehicle.get(vehicle.id)

      return {
        vehicleId: vehicle.id,
        name: vehicle.name,
        status: vehicle.status,
        location: vehicle.location,
        mileage: vehicle.mileage,
        maintenanceDue: Boolean(blockingSchedule) || vehicle.status === 'Maintenance',
        totalTrips: vehicleTrips.length,
        completedTrips,
        activeTrips,
        utilizationPercent,
        note: blockingSchedule ? `Blocked by ${blockingSchedule.reasonCode ?? 'maintenance'}` : 'Fleet-ready',
      }
    })
    .sort((left, right) => right.utilizationPercent - left.utilizationPercent)

  const averageUtilizationPercent = rows.length
    ? roundOneDecimal(rows.reduce((sum, row) => sum + row.utilizationPercent, 0) / rows.length)
    : 0
  const availableVehicles = rows.filter((row) => !row.maintenanceDue && row.status !== 'Maintenance').length
  const blockedVehicles = rows.length - availableVehicles
  const maintenanceCounts = maintenanceSchedules
    .filter((schedule) => !filters.startDate && !filters.endDate ? true : isWithinDateRange(schedule.createdAt, filters.startDate, filters.endDate))
    .reduce<Record<string, number>>((counts, schedule) => {
      counts[schedule.status] = (counts[schedule.status] ?? 0) + 1
      return counts
    }, {})

  return {
    generatedAt: new Date().toISOString(),
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null,
    kpis: [
      {
        key: 'fleet-size',
        label: 'Fleet size',
        value: String(rows.length),
        note: 'Registered vehicles in the fleet',
        tone: 'blue',
      },
      {
        key: 'available',
        label: 'Available',
        value: String(availableVehicles),
        note: 'Vehicles cleared for dispatch',
        tone: 'mint',
      },
      {
        key: 'blocked',
        label: 'Blocked',
        value: String(blockedVehicles),
        note: 'Vehicles in maintenance or hold',
        tone: 'rose',
      },
      {
        key: 'avg-utilization',
        label: 'Utilization',
        value: formatPercent(averageUtilizationPercent),
        note: 'Average trip utilization by vehicle',
        tone: 'teal',
      },
    ],
    averageUtilizationPercent,
    utilizationByVehicle: rows,
    maintenanceTrends: buildCategoryTrends(maintenanceCounts, 'maintenance'),
  }
}

function buildDriverAnalyticsFallback(filters: AnalyticsFilters): DriverAnalytics {
  const filteredTrips = filterTripsForAnalytics(filters)
  const rows = drivers
    .map((driver) => {
      const driverTrips = filteredTrips.filter((trip) => trip.assignedDriverId === driver.id)
      const completedTrips = driverTrips.filter((trip) => trip.status === 'COMPLETED').length
      const activeTrips = driverTrips.filter((trip) => ['DISPATCHED', 'IN_PROGRESS'].includes(trip.status)).length
      const productivityPercent = driverTrips.length ? roundOneDecimal((completedTrips * 100) / driverTrips.length) : 0

      return {
        driverId: driver.id,
        name: driver.name,
        status: driver.status,
        licenseType: driver.licenseType,
        assignedVehicleId: driver.assignedVehicleId ?? null,
        hoursDrivenToday: driver.hoursDrivenToday,
        totalTrips: driverTrips.length,
        completedTrips,
        productivityPercent,
        note: activeTrips > 0 ? 'Live trip assigned' : completedTrips > 0 ? 'Completed in selected range' : 'Idle in selected range',
      }
    })
    .sort((left, right) => right.productivityPercent - left.productivityPercent)

  const averageProductivityPercent = rows.length
    ? roundOneDecimal(rows.reduce((sum, row) => sum + row.productivityPercent, 0) / rows.length)
    : 0
  const dutyCounts = drivers.reduce<Record<string, number>>((counts, driver) => {
    counts[driver.status] = (counts[driver.status] ?? 0) + 1
    return counts
  }, {})

  return {
    generatedAt: new Date().toISOString(),
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null,
    kpis: [
      {
        key: 'driver-count',
        label: 'Drivers',
        value: String(rows.length),
        note: 'Registered drivers in the fleet',
        tone: 'blue',
      },
      {
        key: 'on-duty',
        label: 'On duty',
        value: String(rows.filter((row) => row.status === 'On Duty').length),
        note: 'Drivers ready for live work',
        tone: 'mint',
      },
      {
        key: 'avg-hours',
        label: 'Avg hours',
        value: `${roundOneDecimal(rows.reduce((sum, row) => sum + row.hoursDrivenToday, 0) / Math.max(rows.length, 1)).toFixed(1)} h`,
        note: "Today's duty load",
        tone: 'amber',
      },
      {
        key: 'avg-productivity',
        label: 'Productivity',
        value: formatPercent(averageProductivityPercent),
        note: 'Completed trips versus assigned trips',
        tone: 'teal',
      },
    ],
    averageProductivityPercent,
    productivityByDriver: rows,
    dutyTrend: buildCategoryTrends(dutyCounts, 'drivers'),
  }
}

function isTripDelayed(trip: Trip, now = new Date()) {
  const plannedEnd = parseDateTime(trip.plannedEndTime)
  if (!plannedEnd) {
    return false
  }

  if (trip.status === 'COMPLETED' && trip.actualEndTime) {
    const actualEnd = parseDateTime(trip.actualEndTime)
    return actualEnd ? actualEnd > plannedEnd : false
  }

  return ['DRAFT', 'VALIDATED', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS'].includes(trip.status) && plannedEnd < now
}

function buildDashboardAnalyticsFallback(): DashboardAnalytics {
  const now = new Date()
  const openCriticalAlerts = alerts.filter(
    (alert) => alert.severity === 'CRITICAL' && ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(alert.status),
  )
  const blockingVehicleIds = new Set(
    maintenanceSchedules
      .filter((schedule) => schedule.blockDispatch && ['PLANNED', 'IN_PROGRESS'].includes(schedule.status))
      .map((schedule) => schedule.vehicleId),
  )
  const activeTrips = trips.filter((trip) => ['DISPATCHED', 'IN_PROGRESS'].includes(trip.status))
  const delayedTrips = trips.filter((trip) => isTripDelayed(trip, now))
  const availableVehicles = vehicles.filter(
    (vehicle) => vehicle.status !== 'Maintenance' && !blockingVehicleIds.has(vehicle.id),
  )
  const driversOnDuty = drivers.filter((driver) => driver.status === 'On Duty')

  return {
    generatedAt: now.toISOString(),
    kpis: [
      {
        key: 'active-trips',
        label: 'Active trips',
        value: String(activeTrips.length),
        note: 'Trips currently in motion',
        tone: 'blue',
      },
      {
        key: 'delayed-trips',
        label: 'Delayed trips',
        value: String(delayedTrips.length),
        note: 'Trips beyond their planned window',
        tone: 'rose',
      },
      {
        key: 'critical-alerts',
        label: 'Critical alerts',
        value: String(openCriticalAlerts.length),
        note: 'Open items requiring intervention',
        tone: 'amber',
      },
      {
        key: 'available-vehicles',
        label: 'Available vehicles',
        value: String(availableVehicles.length),
        note: 'Fleet units cleared for dispatch',
        tone: 'mint',
      },
      {
        key: 'blocked-vehicles',
        label: 'Blocked vehicles',
        value: String(vehicles.length - availableVehicles.length),
        note: 'Vehicles under maintenance or hold',
        tone: 'violet',
      },
      {
        key: 'drivers-on-duty',
        label: 'Drivers on duty',
        value: String(driversOnDuty.length),
        note: 'Available crew for active trips',
        tone: 'teal',
      },
    ],
    activeTrips: activeTrips.length,
    delayedTrips: delayedTrips.length,
    criticalAlerts: openCriticalAlerts.length,
    availableVehicles: availableVehicles.length,
    vehiclesInMaintenance: vehicles.length - availableVehicles.length,
    driversOnDuty: driversOnDuty.length,
    fleetReadinessPercent: vehicles.length ? Math.round((availableVehicles.length / vehicles.length) * 1000) / 10 : 0,
    delayedTripsSummary: delayedTrips.slice(0, 5).map((trip) => ({
      tripId: trip.tripId,
      routeId: trip.routeId,
      vehicleId: trip.assignedVehicleId,
      driverId: trip.assignedDriverId,
      status: trip.status,
      minutesLate: Math.max(0, Math.round((now.getTime() - (parseDateTime(trip.plannedEndTime)?.getTime() ?? now.getTime())) / 60000)),
      plannedEndTime: trip.plannedEndTime ?? now.toISOString(),
      reason: 'Trip is still active beyond its planned end time.',
    })),
    criticalAlertSummary: openCriticalAlerts.slice(0, 5).map((alert) => ({
      id: alert.id,
      category: alert.category,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      relatedTripId: alert.relatedTripId,
      relatedVehicleId: alert.relatedVehicleId,
      createdAt: alert.createdAt,
    })),
    blockedVehicles: vehicles
      .filter((vehicle) => vehicle.status === 'Maintenance' || blockingVehicleIds.has(vehicle.id))
      .slice(0, 5)
      .map((vehicle) => ({
        id: vehicle.id,
        title: vehicle.name,
        subtitle: vehicle.location,
        status: vehicle.status,
        note: vehicle.status === 'Maintenance' ? 'Vehicle status is Maintenance' : 'Blocked by maintenance schedule',
        actionPath: `/vehicles/${vehicle.id}`,
      })),
    driversOnDutySnapshot: driversOnDuty.slice(0, 5).map((driver) => ({
      id: driver.id,
      title: driver.name,
      subtitle: driver.licenseType,
      status: driver.status,
      note: driver.assignedVehicleId ? `Vehicle ${driver.assignedVehicleId}` : 'No vehicle assigned',
      actionPath: '/drivers',
    })),
  }
}

function buildActionQueueFallback(): DashboardActionQueueItem[] {
  const queue: DashboardActionQueueItem[] = []

  trips
    .filter((trip) => ['DRAFT', 'VALIDATED', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'BLOCKED'].includes(trip.status))
    .forEach((trip) => {
      if (trip.status === 'DRAFT') {
        queue.push({
          id: trip.tripId,
          category: 'TRIP',
          title: `Validate trip ${trip.tripId}`,
          status: trip.status,
          priority: trip.priority,
          note: 'Planner input is ready for validation.',
          relatedTripId: trip.tripId,
          relatedVehicleId: trip.assignedVehicleId,
          actionLabel: 'Validate',
          actionPath: '/trips',
        })
      } else if (trip.status === 'VALIDATED') {
        queue.push({
          id: trip.tripId,
          category: 'TRIP',
          title: `Optimize trip ${trip.tripId}`,
          status: trip.status,
          priority: trip.priority,
          note: 'Validation passed and optimization can run.',
          relatedTripId: trip.tripId,
          relatedVehicleId: trip.assignedVehicleId,
          actionLabel: 'Optimize',
          actionPath: '/trips',
        })
      } else if (trip.status === 'OPTIMIZED') {
        queue.push({
          id: trip.tripId,
          category: 'TRIP',
          title: `Dispatch trip ${trip.tripId}`,
          status: trip.status,
          priority: trip.priority,
          note: 'Route plan is optimized and ready for dispatch.',
          relatedTripId: trip.tripId,
          relatedVehicleId: trip.assignedVehicleId,
          actionLabel: 'Dispatch',
          actionPath: '/trips',
        })
      } else if (trip.status === 'DISPATCHED') {
        queue.push({
          id: trip.tripId,
          category: 'TRIP',
          title: `Start trip ${trip.tripId}`,
          status: trip.status,
          priority: trip.priority,
          note: 'Vehicle is dispatched and waiting for trip start confirmation.',
          relatedTripId: trip.tripId,
          relatedVehicleId: trip.assignedVehicleId,
          actionLabel: 'Start',
          actionPath: '/trips',
        })
      } else if (trip.status === 'IN_PROGRESS') {
        queue.push({
          id: trip.tripId,
          category: 'TRIP',
          title: `Monitor trip ${trip.tripId}`,
          status: trip.status,
          priority: trip.priority,
          note: 'Trip is live and telemetry is available.',
          relatedTripId: trip.tripId,
          relatedVehicleId: trip.assignedVehicleId,
          actionLabel: 'View trip',
          actionPath: '/trips',
        })
      } else {
        queue.push({
          id: trip.tripId,
          category: 'TRIP',
          title: `Review blocked trip ${trip.tripId}`,
          status: trip.status,
          priority: trip.priority,
          note: 'Trip is blocked by compliance, maintenance, or assignment checks.',
          relatedTripId: trip.tripId,
          relatedVehicleId: trip.assignedVehicleId,
          actionLabel: 'Review',
          actionPath: '/trips',
        })
      }
    })

  alerts
    .filter((alert) => alert.severity === 'CRITICAL' && ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(alert.status))
    .forEach((alert) => {
      queue.push({
        id: alert.id,
        category: alert.category,
        title: alert.title,
        status: alert.status,
        priority: alert.severity,
        note: alert.description,
        relatedTripId: alert.relatedTripId,
        relatedVehicleId: alert.relatedVehicleId,
        actionLabel: 'Acknowledge',
        actionPath: '/alerts',
      })
    })

  maintenanceSchedules
    .filter((schedule) => schedule.blockDispatch && ['PLANNED', 'IN_PROGRESS'].includes(schedule.status))
    .forEach((schedule) => {
      queue.push({
        id: schedule.id,
        category: 'MAINTENANCE',
        title: schedule.title,
        status: schedule.status,
        priority: 'HIGH',
        note: schedule.notes ?? 'Maintenance block requires review.',
        relatedTripId: null,
        relatedVehicleId: schedule.vehicleId,
        actionLabel: 'Review schedule',
        actionPath: '/maintenance',
      })
    })

  return queue
    .sort((left, right) => {
      const priorityRank = (priority: string) => {
        switch (priority.toUpperCase()) {
          case 'CRITICAL':
            return 0
          case 'HIGH':
            return 1
          case 'MEDIUM':
            return 2
          case 'LOW':
            return 3
          default:
            return 99
        }
      }

      return priorityRank(left.priority) - priorityRank(right.priority) || left.title.localeCompare(right.title)
    })
    .slice(0, 12)
}

function buildExceptionFallback(): DashboardExceptionItem[] {
  const items: DashboardExceptionItem[] = []
  const now = new Date()

  trips.forEach((trip) => {
    if (trip.status === 'BLOCKED') {
      items.push({
        id: trip.tripId,
        category: 'TRIP_BLOCKED',
        severity: 'HIGH',
        title: `Trip ${trip.tripId} blocked`,
        message: 'Trip is blocked by compliance, maintenance, or assignment checks.',
        status: trip.status,
        relatedTripId: trip.tripId,
        relatedVehicleId: trip.assignedVehicleId,
        updatedAt: trip.actualEndTime ?? trip.plannedEndTime ?? null,
      })
    }

    if (isTripDelayed(trip, now)) {
      items.push({
        id: `${trip.tripId}-delay`,
        category: 'TRIP_DELAY',
        severity: 'HIGH',
        title: `Trip ${trip.tripId} delayed`,
        message: 'Trip is still active beyond its planned end time.',
        status: trip.status,
        relatedTripId: trip.tripId,
        relatedVehicleId: trip.assignedVehicleId,
        updatedAt: trip.actualEndTime ?? trip.plannedEndTime ?? null,
      })
    }
  })

  alerts
    .filter((alert) => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(alert.status))
    .forEach((alert) => {
      items.push({
        id: alert.id,
        category: alert.category,
        severity: alert.severity,
        title: alert.title,
        message: alert.description,
        status: alert.status,
        relatedTripId: alert.relatedTripId,
        relatedVehicleId: alert.relatedVehicleId,
        updatedAt: alert.updatedAt,
      })
    })

  maintenanceSchedules
    .filter((schedule) => schedule.blockDispatch && ['PLANNED', 'IN_PROGRESS'].includes(schedule.status))
    .forEach((schedule) => {
      items.push({
        id: schedule.id,
        category: 'MAINTENANCE_BLOCK',
        severity: 'HIGH',
        title: schedule.title,
        message: schedule.notes ?? 'Dispatch is blocked until the schedule is cleared.',
        status: schedule.status,
        relatedTripId: null,
        relatedVehicleId: schedule.vehicleId,
        updatedAt: schedule.updatedAt,
      })
    })

  return items
    .sort((left, right) => {
      const severityRank = (severity: string) => {
        switch (severity.toUpperCase()) {
          case 'CRITICAL':
            return 0
          case 'HIGH':
            return 1
          case 'MEDIUM':
            return 2
          case 'LOW':
            return 3
          default:
            return 99
        }
      }

      const leftUpdated = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
      const rightUpdated = right.updatedAt ? new Date(right.updatedAt).getTime() : 0
      return severityRank(left.severity) - severityRank(right.severity) || rightUpdated - leftUpdated
    })
    .slice(0, 20)
}

function cloneTripList() {
  return trips.map(cloneTrip)
}

export function fetchTrips(): Promise<Trip[]> {
  return withFallback(() => request<Trip[]>('/trips'), cloneTripList())
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  try {
    return await request<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }

    console.warn('Falling back to mock API data:', error)
    const createdTrip: Trip = {
      tripId: nextTripId(),
      routeId: input.routeId,
      assignedVehicleId: input.assignedVehicleId,
      assignedDriverId: input.assignedDriverId,
      status: 'DRAFT',
      priority: input.priority,
      source: input.source,
      destination: input.destination,
      stops: normalizeTripStops(input.stops),
      plannedStartTime: input.plannedStartTime,
      plannedEndTime: input.plannedEndTime,
      actualStartTime: null,
      actualEndTime: null,
      estimatedDistance: input.estimatedDistance,
      actualDistance: 0,
      estimatedDuration: input.estimatedDuration,
      actualDuration: null,
      dispatchStatus: 'NOT_DISPATCHED',
      complianceStatus: 'PENDING',
      optimizationStatus: 'NOT_STARTED',
      remarks: input.remarks ?? null,
    }
    trips = [...trips, createdTrip]
    return cloneTrip(createdTrip)
  }
}

export async function validateTrip(tripId: string): Promise<TripValidationResult> {
  try {
    return await request<TripValidationResult>(`/trips/${tripId}/validate`, {
      method: 'POST',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }

    console.warn('Falling back to mock API data:', error)
    const trip = trips.find((item) => item.tripId === tripId)
    if (!trip) {
      throw new Error('Trip not found')
    }

    trip.status = 'VALIDATED'
    trip.complianceStatus = 'COMPLIANT'

    return {
      tripId,
      valid: true,
      complianceStatus: 'COMPLIANT',
      checks: [
        { code: 'vehicle-availability', label: 'Vehicle availability', passed: true, message: 'Vehicle is available.' },
        { code: 'driver-availability', label: 'Driver availability', passed: true, message: 'Driver is available.' },
        { code: 'maintenance-block', label: 'Maintenance block', passed: true, message: 'No maintenance block detected.' },
      ],
      blockingReasons: [],
      warnings: ['Mock validation mode enabled.'],
      recommendedAction: 'Proceed to optimization and dispatch.',
    }
  }
}

export async function optimizeTrip(tripId: string): Promise<TripOptimizationResult> {
  try {
    return await request<TripOptimizationResult>(`/trips/${tripId}/optimize`, {
      method: 'POST',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }

    console.warn('Falling back to mock API data:', error)
    const trip = trips.find((item) => item.tripId === tripId)
    if (!trip) {
      throw new Error('Trip not found')
    }

    const optimizedStops = optimizeTripStops(trip.stops)
    const estimatedDistance = optimizeTripDistance(trip.estimatedDistance, optimizedStops.length)
    const estimatedDuration = optimizeTripDuration(trip.estimatedDuration, trip.estimatedDistance, estimatedDistance)

    trip.stops = optimizedStops
    trip.estimatedDistance = estimatedDistance
    trip.estimatedDuration = estimatedDuration
    trip.optimizationStatus = 'OPTIMIZED'
    trip.status = 'OPTIMIZED'

    return {
      tripId,
      optimizationStatus: 'OPTIMIZED',
      optimizedStops,
      estimatedDistance,
      estimatedDuration,
      routeScore: 82,
      notes: 'Mock optimization completed locally.',
    }
  }
}

export async function dispatchTrip(tripId: string): Promise<Trip> {
  try {
    return await request<Trip>(`/trips/${tripId}/dispatch`, {
      method: 'POST',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }

    console.warn('Falling back to mock API data:', error)
    const trip = trips.find((item) => item.tripId === tripId)
    if (!trip) {
      throw new Error('Trip not found')
    }

    trip.dispatchStatus = 'DISPATCHED'
    trip.status = 'DISPATCHED'
    return cloneTrip(trip)
  }
}

export async function startTrip(tripId: string): Promise<Trip> {
  try {
    return await request<Trip>(`/trips/${tripId}/start`, {
      method: 'POST',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }

    console.warn('Falling back to mock API data:', error)
    const trip = trips.find((item) => item.tripId === tripId)
    if (!trip) {
      throw new Error('Trip not found')
    }

    trip.status = 'IN_PROGRESS'
    trip.actualStartTime = trip.actualStartTime ?? new Date().toISOString()
    return cloneTrip(trip)
  }
}

export async function completeTrip(tripId: string, input: CompleteTripInput): Promise<Trip> {
  try {
    return await request<Trip>(`/trips/${tripId}/complete`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }

    console.warn('Falling back to mock API data:', error)
    const trip = trips.find((item) => item.tripId === tripId)
    if (!trip) {
      throw new Error('Trip not found')
    }

    trip.status = 'COMPLETED'
    trip.dispatchStatus = 'RELEASED'
    trip.actualEndTime = input.actualEndTime
    trip.actualDistance = input.actualDistance
    trip.actualDuration = input.actualDuration ?? trip.actualDuration ?? trip.estimatedDuration
    trip.remarks = input.remarks ?? trip.remarks
    trip.delayMinutes = (() => {
      const plannedEnd = parseDateTime(trip.plannedEndTime)
      const actualEnd = parseDateTime(trip.actualEndTime)
      if (!plannedEnd || !actualEnd) {
        return 0
      }
      return Math.max(0, Math.round((actualEnd.getTime() - plannedEnd.getTime()) / 60000))
    })()
    trip.fuelUsed = input.fuelUsed ?? trip.fuelUsed ?? null
    trip.completionProcessedAt = new Date().toISOString()

    vehicles = vehicles.map((vehicle) =>
      vehicle.id === trip.assignedVehicleId
        ? { ...vehicle, status: 'Idle', driverId: '' }
        : vehicle,
    )
    drivers = drivers.map((driver) =>
      driver.id === trip.assignedDriverId
        ? {
            ...driver,
            status: 'Resting',
            assignedVehicleId: undefined,
            hoursDrivenToday: driver.hoursDrivenToday + (parseTripDurationMinutes(trip.actualDuration ?? '0m') / 60),
          }
        : driver,
    )
    return cloneTrip(trip)
  }
}

export function fetchTripTelemetry(tripId: string): Promise<TripTelemetryPoint[]> {
  return withFallback(() => request<TripTelemetryPoint[]>(`/trips/${tripId}/telemetry`), [])
}

const fallbackSession: AuthSession = {
  token: 'local-demo-session',
  profile,
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  if (USE_MOCK_API && typeof fetch !== 'function') {
    if (
      credentials.email === 'manager@fleetcontrol.dev' &&
      credentials.password === 'password123'
    ) {
      return fallbackSession
    }

    throw new Error('Invalid credentials')
  }

  try {
    return await request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  } catch (error) {
    if (
      USE_MOCK_API &&
      credentials.email === 'manager@fleetcontrol.dev' &&
      credentials.password === 'password123'
    ) {
      return fallbackSession
    }

    throw error
  }
}

export function fetchVehicles(): Promise<Vehicle[]> {
  return withFallback(
    () => request<Vehicle[]>('/vehicles'),
    vehicles.map(cloneVehicle),
  )
}

export async function fetchVehicleById(id: string): Promise<Vehicle | undefined> {
  return withFallback(
    () => request<Vehicle>(`/vehicles/${id}`),
    (() => {
      const vehicle = vehicles.find((item) => item.id === id)
      return vehicle ? cloneVehicle(vehicle) : undefined
    })(),
  )
}

export function fetchDrivers(): Promise<Driver[]> {
  return withFallback(
    () => request<Driver[]>('/drivers'),
    drivers.map(cloneDriver),
  )
}

export function fetchMaintenanceAlerts(): Promise<MaintenanceAlert[]> {
  return withFallback(
    () => request<MaintenanceAlert[]>('/maintenance-alerts'),
    maintenanceAlerts.map(cloneMaintenanceAlert),
  )
}

export function fetchRoutePlans(): Promise<RoutePlan[]> {
  return withFallback(
    () => request<RoutePlan[]>('/routes'),
    routePlans.map(cloneRoutePlan),
  )
}

export function fetchProfile(): Promise<UserProfile> {
  return withFallback(() => request<UserProfile>('/profile'), profile)
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  try {
    return await request<Vehicle>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const createdVehicle = {
      id: nextVehicleId(),
      ...input,
    }
    vehicles = [...vehicles, createdVehicle]
    return cloneVehicle(createdVehicle)
  }
}

export async function updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
  try {
    return await request<Vehicle>(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const updatedVehicle = {
      id,
      ...input,
    }
    vehicles = vehicles.map((vehicle) => (vehicle.id === id ? updatedVehicle : vehicle))
    return cloneVehicle(updatedVehicle)
  }
}

export async function deleteVehicle(id: string): Promise<void> {
  try {
    await request<void>(`/vehicles/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    vehicles = vehicles.filter((vehicle) => vehicle.id !== id)
  }
}

export async function createDriver(input: CreateDriverInput): Promise<Driver> {
  try {
    return await request<Driver>('/drivers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const createdDriver = {
      id: nextDriverId(),
      ...input,
      assignedVehicleId: input.assignedVehicleId || undefined,
    }
    drivers = [...drivers, createdDriver]
    return cloneDriver(createdDriver)
  }
}

export async function createMaintenanceAlert(
  input: CreateMaintenanceAlertInput,
): Promise<MaintenanceAlert> {
  try {
    return await request<MaintenanceAlert>('/maintenance-alerts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const createdAlert = {
      id: nextMaintenanceAlertId(),
      ...input,
    }
    maintenanceAlerts = [...maintenanceAlerts, createdAlert]
    return cloneMaintenanceAlert(createdAlert)
  }
}

export async function updateMaintenanceAlert(
  id: string,
  input: UpdateMaintenanceAlertInput,
): Promise<MaintenanceAlert> {
  try {
    return await request<MaintenanceAlert>(`/maintenance-alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const updatedAlert = {
      id,
      ...input,
    }
    maintenanceAlerts = maintenanceAlerts.map((alert) => (alert.id === id ? updatedAlert : alert))
    return cloneMaintenanceAlert(updatedAlert)
  }
}

export async function deleteMaintenanceAlert(id: string): Promise<void> {
  try {
    await request<void>(`/maintenance-alerts/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    maintenanceAlerts = maintenanceAlerts.filter((alert) => alert.id !== id)
  }
}

export function fetchAlerts(): Promise<Alert[]> {
  return withFallback(() => request<Alert[]>('/alerts'), alerts.map(cloneAlert))
}

export function fetchAlertById(id: string): Promise<Alert> {
  return withFallback(
    () => request<Alert>(`/alerts/${id}`),
    (() => {
      const alert = alerts.find((item) => item.id === id)
      if (!alert) {
        throw new Error('Alert not found')
      }
      return cloneAlert(alert)
    })(),
  )
}

export async function acknowledgeAlert(id: string): Promise<Alert> {
  try {
    return await request<Alert>(`/alerts/${id}/acknowledge`, {
      method: 'POST',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const updatedAlert = alerts.find((alert) => alert.id === id)
    if (!updatedAlert) {
      throw new Error('Alert not found')
    }
    updatedAlert.status = 'ACKNOWLEDGED'
    updatedAlert.acknowledgedAt = updatedAlert.acknowledgedAt ?? new Date().toISOString()
    updatedAlert.updatedAt = new Date().toISOString()
    return cloneAlert(updatedAlert)
  }
}

export async function resolveAlert(id: string): Promise<Alert> {
  try {
    return await request<Alert>(`/alerts/${id}/resolve`, {
      method: 'POST',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const updatedAlert = alerts.find((alert) => alert.id === id)
    if (!updatedAlert) {
      throw new Error('Alert not found')
    }
    updatedAlert.status = 'RESOLVED'
    updatedAlert.resolvedAt = new Date().toISOString()
    updatedAlert.updatedAt = new Date().toISOString()
    return cloneAlert(updatedAlert)
  }
}

export function fetchNotifications(): Promise<Notification[]> {
  return withFallback(
    () => request<Notification[]>('/notifications'),
    notifications.map(cloneNotification),
  )
}

export async function markNotificationRead(id: string): Promise<Notification> {
  try {
    return await request<Notification>(`/notifications/${id}/read`, {
      method: 'POST',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const notification = notifications.find((item) => item.id === id)
    if (!notification) {
      throw new Error('Notification not found')
    }

    notification.read = true
    notification.readAt = notification.readAt ?? new Date().toISOString()
    return cloneNotification(notification)
  }
}

export function fetchAuditLogs(filters: AuditFilters = {}): Promise<AuditLogEntry[]> {
  return withFallback(
    () => request<AuditLogEntry[]>(`/audit-logs${buildAuditQuery(filters)}`),
    auditLogs
      .filter((entry) => {
        if (!filters.from && !filters.to) {
          return true
        }

        return isWithinDateRange(entry.createdAt, filters.from, filters.to)
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map(cloneAuditLog),
  )
}

export function fetchAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
  return withFallback(
    () => request<AuditLogEntry[]>(`/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`),
    auditLogs
      .filter(
        (entry) =>
          entry.entityType.toLowerCase() === entityType.toLowerCase() &&
          entry.entityId.toLowerCase() === entityId.toLowerCase(),
      )
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map(cloneAuditLog),
  )
}

export function fetchMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
  return withFallback(
    () => request<MaintenanceSchedule[]>('/maintenance/schedules'),
    maintenanceSchedules.map(cloneMaintenanceSchedule),
  )
}

export async function createMaintenanceSchedule(
  input: CreateMaintenanceScheduleInput,
): Promise<MaintenanceSchedule> {
  try {
    return await request<MaintenanceSchedule>('/maintenance/schedules', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const createdSchedule: MaintenanceSchedule = {
      id: nextMaintenanceScheduleId(),
      ...input,
      reasonCode: input.reasonCode ?? null,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    maintenanceSchedules = [...maintenanceSchedules, createdSchedule]
    return cloneMaintenanceSchedule(createdSchedule)
  }
}

export function fetchDashboardAnalytics(): Promise<DashboardAnalytics> {
  return withFallback(() => request<DashboardAnalytics>('/analytics/dashboard'), buildDashboardAnalyticsFallback())
}

export function fetchDashboardActionQueue(): Promise<DashboardActionQueueItem[]> {
  return withFallback(
    () => request<DashboardActionQueueItem[]>('/dashboard/action-queue'),
    buildActionQueueFallback(),
  )
}

export function fetchDashboardExceptions(): Promise<DashboardExceptionItem[]> {
  return withFallback(
    () => request<DashboardExceptionItem[]>('/dashboard/exceptions'),
    buildExceptionFallback(),
  )
}

export function fetchTripAnalytics(filters: AnalyticsFilters): Promise<TripAnalytics> {
  return withFallback(
    () => request<TripAnalytics>(`/analytics/trips${buildAnalyticsQuery(filters)}`),
    buildTripAnalyticsFallback(filters),
  )
}

export function fetchVehicleAnalytics(filters: AnalyticsFilters): Promise<VehicleAnalytics> {
  return withFallback(
    () =>
      request<VehicleAnalytics>(
        `/analytics/vehicles${buildAnalyticsQuery({
          startDate: filters.startDate,
          endDate: filters.endDate,
        })}`,
      ),
    buildVehicleAnalyticsFallback(filters),
  )
}

export function fetchDriverAnalytics(filters: AnalyticsFilters): Promise<DriverAnalytics> {
  return withFallback(
    () =>
      request<DriverAnalytics>(
        `/analytics/drivers${buildAnalyticsQuery({
          startDate: filters.startDate,
          endDate: filters.endDate,
        })}`,
      ),
    buildDriverAnalyticsFallback(filters),
  )
}

export function fetchComplianceCheck(tripId: string): Promise<ComplianceCheckResult> {
  return withFallback(
    () => request<ComplianceCheckResult>(`/compliance/checks/${tripId}`),
    (() => {
      const trip = trips.find((item) => item.tripId === tripId)
      if (!trip) {
        throw new Error('Trip not found')
      }

      const vehicle = vehicles.find((item) => item.id === trip.assignedVehicleId)
      const driver = drivers.find((item) => item.id === trip.assignedDriverId)
      const maintenanceBlocked = maintenanceSchedules.some(
        (schedule) => schedule.vehicleId === trip.assignedVehicleId && schedule.blockDispatch && ['PLANNED', 'IN_PROGRESS'].includes(schedule.status),
      )
      const blockingReasons: string[] = []
      const checks: ComplianceCheckResult['checks'] = []

      const vehicleAvailable = vehicle ? vehicle.status !== 'Maintenance' : false
      checks.push({
        code: 'vehicle-availability',
        label: 'Vehicle availability',
        passed: vehicleAvailable,
        blocking: !vehicleAvailable,
        message: vehicleAvailable ? 'Vehicle is available.' : 'Vehicle is in maintenance and cannot be dispatched.',
      })
      if (!vehicleAvailable) blockingReasons.push('Vehicle is in maintenance and cannot be dispatched.')

      const driverAvailable = driver ? driver.status !== 'Off Duty' : false
      checks.push({
        code: 'driver-availability',
        label: 'Driver availability',
        passed: driverAvailable,
        blocking: !driverAvailable,
        message: driverAvailable ? 'Driver is available.' : 'Driver is off duty and cannot be dispatched.',
      })
      if (!driverAvailable) blockingReasons.push('Driver is off duty and cannot be dispatched.')

      checks.push({
        code: 'maintenance-block',
        label: 'Maintenance block',
        passed: !maintenanceBlocked,
        blocking: maintenanceBlocked,
        message: maintenanceBlocked ? 'Vehicle has a blocking maintenance schedule.' : 'No maintenance block detected.',
      })
      if (maintenanceBlocked) blockingReasons.push('Vehicle has a blocking maintenance schedule.')

      const compliant = blockingReasons.length === 0
      return {
        tripId,
        compliant,
        complianceStatus: compliant ? 'COMPLIANT' : 'BLOCKED',
        checks,
        blockingReasons,
        warnings: compliant ? ['Mock compliance mode enabled.'] : [],
        recommendedAction: compliant ? 'Proceed to optimization and dispatch.' : 'Resolve blockers before dispatch.',
      }
    })(),
  )
}

export async function assignShift(input: AssignShiftInput): Promise<Driver> {
  try {
    return await request<Driver>('/drivers/assign-shift', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const updatedDriver = {
      ...(drivers.find((driver) => driver.id === input.driverId) ?? drivers[0]),
      assignedVehicleId: input.assignedVehicleId,
      status: input.status,
    }
    drivers = drivers.map((driver) => (driver.id === updatedDriver.id ? updatedDriver : driver))
    return cloneDriver(updatedDriver)
  }
}

export async function updateDriver(id: string, input: UpdateDriverInput): Promise<Driver> {
  try {
    return await request<Driver>(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const updatedDriver = {
      id,
      ...input,
      assignedVehicleId: input.assignedVehicleId || undefined,
    }
    drivers = drivers.map((driver) => (driver.id === id ? updatedDriver : driver))
    return cloneDriver(updatedDriver)
  }
}

export async function deleteDriver(id: string): Promise<void> {
  try {
    await request<void>(`/drivers/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    drivers = drivers.filter((driver) => driver.id !== id)
  }
}

export async function optimizeRoutes(): Promise<RoutePlan[]> {
  return withFallback(
    () =>
      request<RoutePlan[]>('/routes/optimize', {
        method: 'POST',
      }),
    (() => {
      routePlans = routePlans
        .map(optimizeRoutePlanData)
        .sort(
          (left, right) =>
            statusPriority(left.status) - statusPriority(right.status) ||
            left.distanceKm - right.distanceKm,
        )

      return routePlans.map(cloneRoutePlan)
    })(),
  )
}

export async function createRoutePlan(input: CreateRoutePlanInput): Promise<RoutePlan> {
  try {
    return await request<RoutePlan>('/routes', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const createdRoute = {
      id: nextRoutePlanId(),
      ...input,
    }
    routePlans = [...routePlans, createdRoute]
    return cloneRoutePlan(createdRoute)
  }
}

export async function updateRoutePlan(id: string, input: UpdateRoutePlanInput): Promise<RoutePlan> {
  try {
    return await request<RoutePlan>(`/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    const updatedRoute = {
      id,
      ...input,
    }
    routePlans = routePlans.map((route) => (route.id === id ? updatedRoute : route))
    return cloneRoutePlan(updatedRoute)
  }
}

export async function deleteRoutePlan(id: string): Promise<void> {
  try {
    await request<void>(`/routes/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    if (!USE_MOCK_API) {
      throw error
    }
    console.warn('Falling back to mock API data:', error)
    routePlans = routePlans.filter((route) => route.id !== id)
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  return withFallback(
    () =>
      request<UserProfile>('/profile', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    {
      id: profile.id,
      ...input,
    },
  )
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  return withFallback(
    () =>
      request<void>('/profile/change-password', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    undefined,
  )
}
