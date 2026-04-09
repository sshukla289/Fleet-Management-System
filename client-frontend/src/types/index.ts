export type VehicleStatus = 'Active' | 'Idle' | 'Maintenance'
export type TripStatus = 'DRAFT' | 'VALIDATED' | 'OPTIMIZED' | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED'
export type TripPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type TripDispatchStatus = 'NOT_DISPATCHED' | 'QUEUED' | 'DISPATCHED' | 'RELEASED'
export type TripComplianceStatus = 'PENDING' | 'COMPLIANT' | 'REVIEW_REQUIRED' | 'BLOCKED'
export type TripOptimizationStatus = 'NOT_STARTED' | 'READY' | 'OPTIMIZED' | 'FAILED'

export interface Vehicle {
  id: string
  name: string
  type: string
  status: VehicleStatus
  location: string
  fuelLevel: number
  mileage: number
  driverId: string
}

export interface Driver {
  id: string
  name: string
  status: 'On Duty' | 'Off Duty' | 'Resting'
  licenseType: string
  assignedVehicleId?: string
  hoursDrivenToday: number
}

export interface TelemetryData {
  timestamp: string
  speed: number
  fuelUsage: number
  engineTemperature: number
}

export interface TripTelemetryPoint {
  vehicleId: string
  tripId?: string
  latitude: number
  longitude: number
  speed: number
  fuelLevel: number
  timestamp: string
}

export interface CreateTelemetryInput {
  vehicleId: string
  tripId?: string
  latitude: number
  longitude: number
  speed: number
  fuelLevel: number
  timestamp?: string
}

export interface Trip {
  tripId: string
  routeId: string
  assignedVehicleId: string
  assignedDriverId: string
  status: TripStatus
  priority: TripPriority
  source: string
  destination: string
  stops: string[]
  plannedStartTime?: string
  plannedEndTime?: string
  actualStartTime?: string | null
  actualEndTime?: string | null
  estimatedDistance: number
  actualDistance: number
  estimatedDuration: string
  actualDuration?: string | null
  dispatchStatus: TripDispatchStatus
  complianceStatus: TripComplianceStatus
  optimizationStatus: TripOptimizationStatus
  remarks?: string | null
}

export interface ValidationCheck {
  code: string
  label: string
  passed: boolean
  message: string
}

export interface TripValidationResult {
  tripId: string
  valid: boolean
  complianceStatus: TripComplianceStatus
  checks: ValidationCheck[]
  blockingReasons: string[]
  warnings: string[]
  recommendedAction: string
}

export interface TripOptimizationResult {
  tripId: string
  optimizationStatus: TripOptimizationStatus
  optimizedStops: string[]
  estimatedDistance: number
  estimatedDuration: string
  routeScore: number
  notes: string
}

export interface CreateTripInput {
  routeId: string
  assignedVehicleId: string
  assignedDriverId: string
  source: string
  destination: string
  stops: string[]
  plannedStartTime: string
  plannedEndTime: string
  estimatedDistance: number
  estimatedDuration: string
  priority: TripPriority
  remarks?: string
}

export interface CompleteTripInput {
  actualEndTime: string
  actualDistance: number
  actualDuration?: string
  remarks?: string
}

export interface MaintenanceAlert {
  id: string
  vehicleId: string
  title: string
  severity: 'Low' | 'Medium' | 'Critical'
  dueDate: string
  description: string
}

export interface RoutePlan {
  id: string
  name: string
  status: 'Scheduled' | 'In Progress' | 'Completed'
  distanceKm: number
  estimatedDuration: string
  stops: string[]
}

export interface CreateRoutePlanInput {
  name: string
  status: RoutePlan['status']
  distanceKm: number
  estimatedDuration: string
  stops: string[]
}

export type UpdateRoutePlanInput = CreateRoutePlanInput

export interface UserProfile {
  id: string
  name: string
  role: string
  email: string
  assignedRegion: string
}

export interface AuthSession {
  token: string
  profile: UserProfile
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface CreateVehicleInput {
  name: string
  type: string
  status: VehicleStatus
  location: string
  fuelLevel: number
  mileage: number
  driverId: string
}

export type UpdateVehicleInput = CreateVehicleInput

export interface CreateDriverInput {
  name: string
  status: Driver['status']
  licenseType: string
  assignedVehicleId: string
  hoursDrivenToday: number
}

export type UpdateDriverInput = CreateDriverInput

export interface CreateMaintenanceAlertInput {
  vehicleId: string
  title: string
  severity: MaintenanceAlert['severity']
  dueDate: string
  description: string
}

export type UpdateMaintenanceAlertInput = CreateMaintenanceAlertInput

export interface AssignShiftInput {
  driverId: string
  assignedVehicleId: string
  status: Driver['status']
}

export interface UpdateProfileInput {
  name: string
  role: string
  email: string
  assignedRegion: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
