import {
  completeTrip as apiCompleteTrip,
  fetchTripChecklists as apiFetchTripChecklists,
  fetchTripTelemetry,
  fetchTrips,
  pauseTrip as apiPauseTrip,
  resumeTrip as apiResumeTrip,
  startTrip as apiStartTrip,
  updateTripChecklist as apiUpdateTripChecklist,
  updateStopStatus as apiUpdateStopStatus,
} from './apiService'
import type { ChecklistType, CompleteTripInput, StopStatus, Trip, TripChecklist, TripTelemetryPoint, UpdateTripChecklistInput } from '../types'
import type { ExecutionStop, ExecutionStopStatus, ExecutionTrip } from '../types/tripExecution'

const ACTIVE_EXECUTION_STATUSES = new Set<Trip['status']>(['DISPATCHED', 'IN_PROGRESS', 'PAUSED'])
const EXECUTION_STATUS_PRIORITY: Record<ExecutionTrip['status'], number> = {
  IN_PROGRESS: 0,
  PAUSED: 1,
  DISPATCHED: 2,
  COMPLETED: 3,
}

function formatEta(trip: Trip) {
  return trip.plannedEndTime ?? trip.actualEndTime ?? new Date().toISOString()
}

function formatDurationFromIso(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) {
    return undefined
  }

  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return undefined
  }

  const totalMinutes = Math.max(1, Math.round((end - start) / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

function inferStopAddress(stop: Trip['stops'][number]) {
  const coordinates = stop.latitude != null && stop.longitude != null
    ? `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`
    : 'Coordinates unavailable'

  const timeLabel = stop.departureTime ?? stop.arrivalTime
  if (!timeLabel) {
    return coordinates
  }

  return `${coordinates} - ${new Date(timeLabel).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function mapStopStatus(status: StopStatus): ExecutionStopStatus {
  return status
}

function mapTripStop(tripId: string, stop: Trip['stops'][number]): ExecutionStop {
  return {
    id: `${tripId}-stop-${stop.sequence}`,
    name: stop.name,
    address: inferStopAddress(stop),
    lat: stop.latitude ?? 0,
    lng: stop.longitude ?? 0,
    status: mapStopStatus(stop.status),
    sequence: stop.sequence,
    arrivedAt: stop.arrivalTime ?? null,
    completedAt: stop.departureTime ?? null,
  }
}

function getProgressDistance(trip: Trip) {
  const totalDistance = Math.max(0, trip.estimatedDistance ?? 0)
  const stops = [...trip.stops].sort((left, right) => left.sequence - right.sequence)
  if (stops.length === 0) {
    return { totalDistance, distanceRemaining: totalDistance }
  }

  const completedStops = stops.filter((stop) => stop.status === 'COMPLETED').length
  const remainingRatio = Math.max(0, 1 - completedStops / stops.length)
  return {
    totalDistance,
    distanceRemaining: Math.round(totalDistance * remainingRatio * 10) / 10,
  }
}

export function mapTripToExecutionTrip(trip: Trip): ExecutionTrip {
  const { totalDistance, distanceRemaining } = getProgressDistance(trip)

  return {
    id: trip.tripId,
    status: trip.status as ExecutionTrip['status'],
    vehicleNumber: trip.assignedVehicleId,
    driverName: trip.assignedDriverId,
    eta: formatEta(trip),
    distanceRemaining,
    totalDistance,
    source: trip.source,
    destination: trip.destination,
    stops: trip.stops.map((stop) => mapTripStop(trip.tripId, stop)),
    startedAt: trip.actualStartTime ?? null,
    pausedAt: trip.pausedAt ?? null,
    pauseReason: trip.pauseReason ?? null,
    completedAt: trip.actualEndTime ?? null,
  }
}

function mapTelemetryPointToTrackingUpdate(point: TripTelemetryPoint, tripId: string) {
  return {
    tripId,
    vehicleId: point.vehicleId,
    driverId: null,
    tripStatus: null,
    currentStop: null,
    currentStopSequence: null,
    currentStopStatus: null,
    latitude: point.latitude,
    longitude: point.longitude,
    speed: point.speed,
    fuelLevel: point.fuelLevel,
    timestamp: point.timestamp,
    overspeed: point.speed > 80,
    idle: false,
    routeDeviation: false,
    routeDeviationDistanceMeters: null,
    source: 'REST_HISTORY',
  } as const
}

export async function fetchActiveTrip(): Promise<ExecutionTrip> {
  const trips = await fetchTrips()
  const activeTrip = trips
    .filter((trip) => ACTIVE_EXECUTION_STATUSES.has(trip.status))
    .sort((left, right) => {
      const statusDifference = (EXECUTION_STATUS_PRIORITY[left.status as ExecutionTrip['status']] ?? 99)
        - (EXECUTION_STATUS_PRIORITY[right.status as ExecutionTrip['status']] ?? 99)
      if (statusDifference !== 0) {
        return statusDifference
      }

      const rightStart = new Date(right.plannedStartTime ?? 0).getTime()
      const leftStart = new Date(left.plannedStartTime ?? 0).getTime()
      return rightStart - leftStart
    })[0]

  if (!activeTrip) {
    throw new Error('No active trip assigned')
  }

  return mapTripToExecutionTrip(activeTrip)
}

export async function fetchLatestTripTelemetry(tripId: string) {
  const telemetry = await fetchTripTelemetry(tripId)
  const latestPoint = telemetry.at(-1)
  return latestPoint ? mapTelemetryPointToTrackingUpdate(latestPoint, tripId) : null
}

export async function fetchTripChecklists(tripId: string): Promise<TripChecklist[]> {
  return apiFetchTripChecklists(tripId)
}

export async function startTrip(tripId: string): Promise<ExecutionTrip> {
  return mapTripToExecutionTrip(await apiStartTrip(tripId))
}

export async function pauseTrip(tripId: string, reason?: string): Promise<ExecutionTrip> {
  return mapTripToExecutionTrip(await apiPauseTrip(tripId, reason))
}

export async function resumeTrip(tripId: string): Promise<ExecutionTrip> {
  return mapTripToExecutionTrip(await apiResumeTrip(tripId))
}

export async function completeTrip(trip: ExecutionTrip): Promise<ExecutionTrip> {
  const completionPayload: CompleteTripInput = {
    actualEndTime: new Date().toISOString(),
    actualDistance: Math.max(0, Math.round(trip.totalDistance)),
    actualDuration: formatDurationFromIso(trip.startedAt, new Date().toISOString()),
    remarks: 'Completed from driver trip execution console.',
  }

  return mapTripToExecutionTrip(await apiCompleteTrip(trip.id, completionPayload))
}

export async function updateTripChecklist(
  tripId: string,
  type: ChecklistType,
  input: UpdateTripChecklistInput,
): Promise<TripChecklist> {
  return apiUpdateTripChecklist(tripId, type, input)
}

export async function updateStopStatus(
  tripId: string,
  stopSequence: number,
  status: ExecutionStopStatus,
): Promise<ExecutionTrip> {
  return mapTripToExecutionTrip(await apiUpdateStopStatus(tripId, stopSequence, status))
}
