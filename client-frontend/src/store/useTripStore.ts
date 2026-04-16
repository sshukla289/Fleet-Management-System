import { create } from 'zustand'
import type { Trip, StopStatus } from '../types'

interface TripUpdatePayload {
  tripId: string
  latitude: number
  longitude: number
  speed: number
  fuel: number
  currentStop: string
  status: StopStatus
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
  updateTripFromSocket: (payload: TripUpdatePayload) => void
}

export const useTripStore = create<TripState>((set) => ({
  activeTrip: null,
  telemetry: null,

  setActiveTrip: (trip) => set({ activeTrip: trip }),

  updateTripFromSocket: (payload) => set((state) => {
    if (!state.activeTrip || state.activeTrip.tripId !== payload.tripId) return state

    // Update the active trip status and stops if needed
    const updatedTrip = {
      ...state.activeTrip,
      status: payload.status,
      // We could also find and update the current stop in the stops array here
      stops: state.activeTrip.stops.map(stop => {
        if (stop.name === payload.currentStop) {
          return { ...stop, status: payload.status }
        }
        return stop
      })
    }

    return {
      activeTrip: updatedTrip,
      telemetry: {
        lat: payload.latitude,
        lng: payload.longitude,
        speed: payload.speed,
        fuel: payload.fuel,
        timestamp: payload.timestamp
      }
    }
  })
}))
