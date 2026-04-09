export type VehicleStatus = 'Active' | 'Idle' | 'Maintenance'
export type TripStatus = 'DRAFT' | 'VALIDATED' | 'OPTIMIZED' | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED'
export type TripPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type TripDispatchStatus = 'NOT_DISPATCHED' | 'QUEUED' | 'DISPATCHED' | 'RELEASED'
export type TripComplianceStatus = 'PENDING' | 'COMPLIANT' | 'REVIEW_REQUIRED' | 'BLOCKED'
export type TripOptimizationStatus = 'NOT_STARTED' | 'READY' | 'OPTIMIZED' | 'FAILED'
export type AlertCategory =
  | 'MAINTENANCE'
  | 'SAFETY'
  | 'COMPLIANCE'
  | 'DISPATCH_EXCEPTION'
  | 'TRIP_DELAY'
  | 'ROUTE_DEVIATION'
  | 'LOW_FUEL'
  | 'TELEMETRY_OFFLINE'
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AlertLifecycleStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type MaintenanceScheduleStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

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
  delayMinutes?: number | null
  fuelUsed?: number | null
  completionProcessedAt?: string | null
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
  fuelUsed?: number
  actualDuration?: string
  remarks?: string
}

export interface AuditLogEntry {
  id: string
  actor: string
  action: string
  entityType: string
  entityId: string
  summary: string
  detailsJson?: string | null
  createdAt: string
}

export interface Alert {
  id: string
  category: AlertCategory
  severity: AlertSeverity
  status: AlertLifecycleStatus
  title: string
  description: string
  sourceType?: string | null
  sourceId?: string | null
  relatedTripId?: string | null
  relatedVehicleId?: string | null
  metadataJson?: string | null
  createdAt: string
  updatedAt: string
  acknowledgedAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null
}

export interface CreateAlertInput {
  category: AlertCategory
  severity: AlertSeverity
  title: string
  description: string
  sourceType?: string
  sourceId?: string
  relatedTripId?: string
  relatedVehicleId?: string
  metadataJson?: string
}

export interface MaintenanceSchedule {
  id: string
  vehicleId: string
  title: string
  status: MaintenanceScheduleStatus
  plannedStartDate: string
  plannedEndDate: string
  blockDispatch: boolean
  reasonCode?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMaintenanceScheduleInput {
  vehicleId: string
  title: string
  status: MaintenanceScheduleStatus
  plannedStartDate: string
  plannedEndDate: string
  blockDispatch: boolean
  reasonCode?: string
  notes?: string
}

export interface ComplianceCheck {
  code: string
  label: string
  passed: boolean
  blocking: boolean
  message: string
}

export interface ComplianceCheckResult {
  tripId: string
  compliant: boolean
  complianceStatus: TripComplianceStatus
  checks: ComplianceCheck[]
  blockingReasons: string[]
  warnings: string[]
  recommendedAction: string
}

export interface DashboardKpi {
  key: string
  label: string
  value: string
  note: string
  tone: 'blue' | 'mint' | 'amber' | 'violet' | 'rose' | 'teal'
}

export interface DashboardTripDelay {
  tripId: string
  routeId: string
  vehicleId: string
  driverId: string
  status: TripStatus
  minutesLate: number
  plannedEndTime: string
  reason: string
}

export interface DashboardAlertSummary {
  id: string
  category: AlertCategory
  severity: AlertSeverity
  status: AlertLifecycleStatus
  title: string
  relatedTripId?: string | null
  relatedVehicleId?: string | null
  createdAt: string
}

export interface DashboardResource {
  id: string
  title: string
  subtitle: string
  status: string
  note: string
  actionPath: string
}

export interface DashboardActionQueueItem {
  id: string
  category: string
  title: string
  status: string
  priority: string
  note: string
  relatedTripId?: string | null
  relatedVehicleId?: string | null
  actionLabel: string
  actionPath: string
}

export interface DashboardExceptionItem {
  id: string
  category: string
  severity: string
  title: string
  message: string
  status: string
  relatedTripId?: string | null
  relatedVehicleId?: string | null
  updatedAt?: string | null
}

export interface AnalyticsTrend {
  label: string
  count: number
  note: string
}

export interface TripAnalyticsRow {
  tripId: string
  routeId: string
  vehicleId: string
  driverId: string
  status: TripStatus
  plannedEndTime?: string | null
  actualEndTime?: string | null
  delayMinutes?: number | null
  actualDistance: number
  fuelUsed?: number | null
  completionProcessedAt?: string | null
}

export interface TripAnalytics {
  generatedAt: string
  startDate: string | null
  endDate: string | null
  statusFilter: string
  kpis: DashboardKpi[]
  onTimeDeliveryRate: number
  tripSuccessRate: number
  averageDelayMinutes: number
  fuelEfficiencyKmPerFuelUnit: number
  completedTrips: number
  cancelledTrips: number
  delayedTrips: number
  delayTrends: AnalyticsTrend[]
  alertFrequencyByCategory: AnalyticsTrend[]
  recentTrips: TripAnalyticsRow[]
}

export interface VehicleAnalyticsRow {
  vehicleId: string
  name: string
  status: string
  location: string
  mileage: number
  maintenanceDue: boolean
  totalTrips: number
  completedTrips: number
  activeTrips: number
  utilizationPercent: number
  note: string
}

export interface VehicleAnalytics {
  generatedAt: string
  startDate: string | null
  endDate: string | null
  kpis: DashboardKpi[]
  averageUtilizationPercent: number
  utilizationByVehicle: VehicleAnalyticsRow[]
  maintenanceTrends: AnalyticsTrend[]
}

export interface DriverAnalyticsRow {
  driverId: string
  name: string
  status: string
  licenseType: string
  assignedVehicleId?: string | null
  hoursDrivenToday: number
  totalTrips: number
  completedTrips: number
  productivityPercent: number
  note: string
}

export interface DriverAnalytics {
  generatedAt: string
  startDate: string | null
  endDate: string | null
  kpis: DashboardKpi[]
  averageProductivityPercent: number
  productivityByDriver: DriverAnalyticsRow[]
  dutyTrend: AnalyticsTrend[]
}

export interface DashboardAnalytics {
  generatedAt: string
  kpis: DashboardKpi[]
  activeTrips: number
  delayedTrips: number
  criticalAlerts: number
  availableVehicles: number
  vehiclesInMaintenance: number
  driversOnDuty: number
  fleetReadinessPercent: number
  delayedTripsSummary: DashboardTripDelay[]
  criticalAlertSummary: DashboardAlertSummary[]
  blockedVehicles: DashboardResource[]
  driversOnDutySnapshot: DashboardResource[]
}

export type NotificationCategory =
  | 'CRITICAL_ALERT'
  | 'TRIP_DISPATCH'
  | 'TRIP_COMPLETION'
  | 'MAINTENANCE_REMINDER'
  | 'COMPLIANCE_REMINDER'

export type NotificationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Notification {
  id: string
  category: NotificationCategory
  severity: NotificationSeverity
  title: string
  message: string
  entityType: string
  entityId: string
  tripId?: string | null
  vehicleId?: string | null
  metadataJson?: string | null
  createdAt: string
  readAt?: string | null
  read: boolean
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
