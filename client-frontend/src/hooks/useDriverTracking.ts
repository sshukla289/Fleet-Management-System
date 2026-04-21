import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getWebSocketBrokerUrl, getWebSocketHttpUrl, readStoredAuthToken } from '../services/websocketService'
import { bufferTrackingSnapshot, processOfflineQueue } from '../services/offlineSyncService'
import { fetchLatestTripTelemetry } from '../services/tripExecutionService'
import type { TrackingConnectionState, TripTrackingUpdate } from '../types/tripExecution'
import type { StopStatus } from '../types'

function parseTrackingUpdate(message: IMessage): TripTrackingUpdate | null {
  try {
    const parsed = JSON.parse(message.body) as Partial<TripTrackingUpdate>
    if (!parsed.tripId) {
      return null
    }

    return {
      tripId: parsed.tripId,
      vehicleId: parsed.vehicleId ?? null,
      driverId: parsed.driverId ?? null,
      tripStatus: parsed.tripStatus ?? null,
      currentStop: parsed.currentStop ?? null,
      currentStopSequence: parsed.currentStopSequence ?? null,
      currentStopStatus: parsed.currentStopStatus ?? null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      speed: parsed.speed ?? null,
      fuelLevel: parsed.fuelLevel ?? null,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
      overspeed: Boolean(parsed.overspeed),
      idle: Boolean(parsed.idle),
      routeDeviation: Boolean(parsed.routeDeviation),
      routeDeviationDistanceMeters: parsed.routeDeviationDistanceMeters ?? null,
      source: typeof parsed.source === 'string' ? parsed.source : 'UNKNOWN',
    }
  } catch {
    return null
  }
}

function getSpeedKph(position: GeolocationPosition) {
  const metersPerSecond = position.coords.speed
  if (typeof metersPerSecond !== 'number' || Number.isNaN(metersPerSecond) || metersPerSecond < 0) {
    return 0
  }

  return Math.round(metersPerSecond * 3.6 * 10) / 10
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission is required for live tracking.'
    case error.POSITION_UNAVAILABLE:
      return 'GPS signal is unavailable right now.'
    case error.TIMEOUT:
      return 'Location request timed out. Retrying automatically.'
    default:
      return 'Unable to access device GPS.'
  }
}

type UseDriverTrackingOptions = {
  tripId: string | undefined
  vehicleId?: string
  publishEnabled?: boolean
  currentStop?: string | null
  currentStopStatus?: StopStatus | null
  fallbackFuelLevel?: number | null
}

export function useDriverTracking({
  tripId,
  vehicleId,
  publishEnabled = true,
  currentStop,
  currentStopStatus,
  fallbackFuelLevel,
}: UseDriverTrackingOptions) {
  const clientRef = useRef<Client | null>(null)
  const subscriptionRef = useRef<StompSubscription | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const sendIntervalRef = useRef<number | null>(null)
  const lastPositionRef = useRef<GeolocationPosition | null>(null)
  const activeTripIdRef = useRef<string | undefined>(undefined)
  const activeVehicleIdRef = useRef<string | undefined>(undefined)
  const activeCurrentStopRef = useRef<string | null | undefined>(undefined)
  const activeCurrentStopStatusRef = useRef<StopStatus | null | undefined>(undefined)
  const fallbackFuelLevelRef = useRef<number | null | undefined>(undefined)
  const latestUpdateRef = useRef<TripTrackingUpdate | null>(null)
  const [latestUpdate, setLatestUpdate] = useState<TripTrackingUpdate | null>(null)
  const [connectionState, setConnectionState] = useState<TrackingConnectionState>('idle')
  const [gpsWarning, setGpsWarning] = useState<string | null>(null)
  const [networkWarning, setNetworkWarning] = useState<string | null>(null)
  const geolocationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const handleIncomingMessage = useEffectEvent((message: IMessage) => {
    const update = parseTrackingUpdate(message)
    if (!update) {
      return
    }

    setLatestUpdate(update)
    latestUpdateRef.current = update
  })

  const bufferLatestPosition = useEffectEvent((position: GeolocationPosition) => {
    const currentTripId = activeTripIdRef.current
    if (!publishEnabled || !currentTripId) {
      return
    }

    void bufferTrackingSnapshot({
      vehicleId: activeVehicleIdRef.current,
      tripId: currentTripId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed: getSpeedKph(position),
      fuelLevel: fallbackFuelLevelRef.current ?? latestUpdateRef.current?.fuelLevel ?? 0,
      currentStop: activeCurrentStopRef.current ?? latestUpdateRef.current?.currentStop ?? null,
      status: activeCurrentStopStatusRef.current
        ?? (latestUpdateRef.current?.currentStopStatus as StopStatus | null | undefined)
        ?? null,
      timestamp: new Date().toISOString(),
    })
  })

  const publishLatestPosition = useEffectEvent(() => {
    const client = clientRef.current
    const position = lastPositionRef.current
    const currentTripId = activeTripIdRef.current

    if (!publishEnabled || !position || !currentTripId) {
      return
    }

    if (!client?.connected || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      bufferLatestPosition(position)
      return
    }

    client.publish({
      destination: `/app/trips/${currentTripId}/telemetry`,
      body: JSON.stringify({
        tripId: currentTripId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: getSpeedKph(position),
        timestamp: Date.now(),
      }),
    })
  })

  useEffect(() => {
    activeTripIdRef.current = tripId
    activeVehicleIdRef.current = vehicleId
    activeCurrentStopRef.current = currentStop
    activeCurrentStopStatusRef.current = currentStopStatus
    fallbackFuelLevelRef.current = fallbackFuelLevel
  }, [currentStop, currentStopStatus, fallbackFuelLevel, tripId, vehicleId])

  useEffect(() => {
    if (!tripId) {
      return
    }

    let cancelled = false
    void fetchLatestTripTelemetry(tripId)
      .then((update) => {
        if (!cancelled && update) {
          setLatestUpdate(update)
          latestUpdateRef.current = update
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [tripId])

  useEffect(() => {
    if (!tripId) {
      return
    }

    if (!geolocationSupported) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        lastPositionRef.current = position
        setGpsWarning(null)
      },
      (error) => {
        setGpsWarning(getGeolocationErrorMessage(error))
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3_000,
        timeout: 10_000,
      },
    )

    watchIdRef.current = watchId
    sendIntervalRef.current = window.setInterval(() => {
      publishLatestPosition()
    }, 5_000)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }

      if (sendIntervalRef.current !== null) {
        window.clearInterval(sendIntervalRef.current)
        sendIntervalRef.current = null
      }
    }
  }, [geolocationSupported, publishEnabled, tripId])

  useEffect(() => {
    const token = readStoredAuthToken()
    if (!tripId || !token) {
      return
    }

    if (clientRef.current?.active && activeTripIdRef.current === tripId) {
      return
    }

    subscriptionRef.current?.unsubscribe()
    void clientRef.current?.deactivate()

    const client = new Client({
      brokerURL: getWebSocketBrokerUrl(),
      webSocketFactory: () => new SockJS(getWebSocketHttpUrl()),
      reconnectDelay: 5_000,
      heartbeatIncoming: 4_000,
      heartbeatOutgoing: 4_000,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      beforeConnect: async () => {
        setConnectionState('connecting')
        setNetworkWarning(null)
      },
      debug: () => undefined,
    })

    client.onConnect = () => {
      setConnectionState('connected')
      setNetworkWarning(null)

      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = client.subscribe(`/topic/trip/${tripId}`, (message) => {
        handleIncomingMessage(message)
      })

      publishLatestPosition()
      void processOfflineQueue()
    }

    client.onStompError = (frame) => {
      setConnectionState('reconnecting')
      setNetworkWarning(frame.headers.message ?? 'Real-time connection error. Reconnecting...')
    }

    client.onWebSocketClose = () => {
      setConnectionState((current) => (current === 'idle' ? 'idle' : 'reconnecting'))
      setNetworkWarning('Network connection lost. Reconnecting...')
    }

    client.onDisconnect = () => {
      setConnectionState('disconnected')
    }

    client.activate()
    clientRef.current = client

    const handleOffline = () => {
      setConnectionState('reconnecting')
      setNetworkWarning('You are offline. Tracking will resume when the network returns.')
    }

    const handleOnline = () => {
      setNetworkWarning(null)
      void processOfflineQueue()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
      void client.deactivate()
      if (clientRef.current === client) {
        clientRef.current = null
      }
    }
  }, [tripId])

  return {
    latestUpdate: latestUpdate?.tripId === tripId ? latestUpdate : null,
    connectionState: tripId ? connectionState : 'idle',
    gpsWarning: tripId
      ? (geolocationSupported ? gpsWarning : 'Live GPS is not supported on this device.')
      : null,
    networkWarning: tripId ? networkWarning : null,
  }
}
