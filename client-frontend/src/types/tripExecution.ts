import type { StopStatus, TripStatus } from './index'

export type ExecutionTripStatus = Extract<TripStatus, 'DISPATCHED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED'>
export type ExecutionStopStatus = StopStatus

export interface DriverPosition {
  lat: number
  lng: number
  heading?: number
}

export type TrackingConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export interface TripTrackingUpdate {
  tripId: string
  vehicleId?: string | null
  driverId?: string | null
  tripStatus?: string | null
  currentStop?: string | null
  currentStopSequence?: number | null
  currentStopStatus?: string | null
  latitude?: number | null
  longitude?: number | null
  speed?: number | null
  fuelLevel?: number | null
  timestamp: string
  overspeed: boolean
  idle: boolean
  routeDeviation: boolean
  routeDeviationDistanceMeters?: number | null
  source: string
}

export interface ExecutionStop {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  status: ExecutionStopStatus
  sequence: number
  arrivedAt?: string | null
  completedAt?: string | null
  notes?: string
}

export interface ExecutionTrip {
  id: string
  status: ExecutionTripStatus
  vehicleNumber: string
  driverName: string
  driverAvatar?: string
  eta: string
  distanceRemaining: number
  totalDistance: number
  source: string
  destination: string
  stops: ExecutionStop[]
  startedAt?: string | null
  pausedAt?: string | null
  pauseReason?: string | null
  completedAt?: string | null
}
