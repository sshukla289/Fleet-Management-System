import type {
  AssignShiftInput,
  AuthSession,
  CompleteTripInput,
  ChangePasswordInput,
  CreateMaintenanceAlertInput,
  CreateDriverInput,
  CreateTripInput,
  CreateRoutePlanInput,
  CreateVehicleInput,
  Driver,
  LoginCredentials,
  MaintenanceAlert,
  Trip,
  TripOptimizationResult,
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
