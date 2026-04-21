import { create } from 'zustand'
import type { StopStatus, Trip } from '../types'

interface TripRealtimePayload {
  tripId: string
  tripStatus?: Trip['status']
  latitude?: number | null
  longitude?: number | null
  speed?: number | null
  fuelLevel?: number | null
  currentStop?: string | null
  currentStopStatus?: StopStatus | null
  timestamp: string
}

interface TripState {
  activeTrip: Trip | null
  telemetry: {
    lat: number
    lng: number
    speed: number
    fuel: number
    timestamp: string
  } | null
  setActiveTrip: (trip: Trip | null) => void
  updateTripFromSocket: (payload: TripRealtimePayload) => void
}

export const useTripStore = create<TripState>((set) => ({
  activeTrip: null,
  telemetry: null,

  setActiveTrip: (trip) => set({ activeTrip: trip }),

  updateTripFromSocket: (payload) =>
    set((state) => {
      if (!state.activeTrip || state.activeTrip.tripId !== payload.tripId) {
        return state
      }

      const updatedTrip = {
        ...state.activeTrip,
        status: payload.tripStatus ?? state.activeTrip.status,
        stops: state.activeTrip.stops.map((stop) => {
          if (stop.name !== payload.currentStop || !payload.currentStopStatus) {
            return stop
          }

          return {
            ...stop,
            status: payload.currentStopStatus,
          }
        }),
      }

      const nextTelemetry = payload.latitude != null && payload.longitude != null
        ? {
            lat: payload.latitude,
            lng: payload.longitude,
            speed: payload.speed ?? state.telemetry?.speed ?? 0,
            fuel: payload.fuelLevel ?? state.telemetry?.fuel ?? 0,
            timestamp: payload.timestamp,
          }
        : state.telemetry

      return {
        activeTrip: updatedTrip,
        telemetry: nextTelemetry,
      }
    }),
}))
