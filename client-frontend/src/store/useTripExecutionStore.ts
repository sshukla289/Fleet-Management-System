import { create } from 'zustand'
import type { DriverPosition, ExecutionTrip, ExecutionTripStatus } from '../types/tripExecution'

interface TripExecutionState {
  activeTrip: ExecutionTrip | null
  tripStatus: ExecutionTripStatus | null
  currentStopId: string | null
  driverPosition: DriverPosition | null
  actionInProgress: string | null
  setTrip: (trip: ExecutionTrip | null) => void
  setDriverPosition: (position: DriverPosition | null) => void
  setActionInProgress: (action: string | null) => void
  reset: () => void
}

function getCurrentStopId(trip: ExecutionTrip | null): string | null {
  if (!trip) {
    return null
  }

  return [...trip.stops]
    .sort((left, right) => left.sequence - right.sequence)
    .find((stop) => stop.status !== 'COMPLETED')
    ?.id ?? null
}

export const useTripExecutionStore = create<TripExecutionState>((set) => ({
  activeTrip: null,
  tripStatus: null,
  currentStopId: null,
  driverPosition: null,
  actionInProgress: null,
  setTrip: (activeTrip) =>
    set({
      activeTrip,
      tripStatus: activeTrip?.status ?? null,
      currentStopId: getCurrentStopId(activeTrip),
    }),
  setDriverPosition: (driverPosition) => set({ driverPosition }),
  setActionInProgress: (actionInProgress) => set({ actionInProgress }),
  reset: () =>
    set({
      activeTrip: null,
      tripStatus: null,
      currentStopId: null,
      driverPosition: null,
      actionInProgress: null,
    }),
}))
