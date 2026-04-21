import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuth } from '../context/useAuth'
import { fetchAlerts, fetchNotifications } from '../services/apiService'
import { getWebSocketBrokerUrl, getWebSocketHttpUrl, readStoredAuthToken } from '../services/websocketService'
import type { Alert, Notification } from '../types'

export type DriverInboxConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function upsertById<T extends { id: string; createdAt: string }>(current: T[], incoming: T) {
  const existingIndex = current.findIndex((item) => item.id === incoming.id)
  if (existingIndex === -1) {
    return sortByCreatedAtDesc([...current, incoming])
  }

  const next = [...current]
  next[existingIndex] = incoming
  return sortByCreatedAtDesc(next)
}

function parseJson<T>(message: IMessage): T | null {
  try {
    return JSON.parse(message.body) as T
  } catch {
    return null
  }
}

export function useDriverInbox() {
  const { session } = useAuth()
  const role = session?.profile.role
  const sessionProfileId = session?.profile.id
  const driverId = role === 'DRIVER' ? sessionProfileId : undefined
  const inboxScope = useMemo(() => {
    if (role === 'DRIVER' && sessionProfileId) {
      return {
        alertsTopic: `/topic/driver/${sessionProfileId}/alerts`,
        notificationsTopic: `/topic/driver/${sessionProfileId}/notifications`,
      }
    }

    if (sessionProfileId) {
      return {
        alertsTopic: '/topic/ops/alerts',
        notificationsTopic: '/topic/ops/notifications',
      }
    }

    return null
  }, [role, sessionProfileId])
  const clientRef = useRef<Client | null>(null)
  const alertSubscriptionRef = useRef<StompSubscription | null>(null)
  const notificationSubscriptionRef = useRef<StompSubscription | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<DriverInboxConnectionState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const replaceAlert = useCallback((incoming: Alert) => {
    setAlerts((current) => upsertById(current, incoming))
    setLastSyncedAt(new Date().toISOString())
  }, [])

  const replaceNotification = useCallback((incoming: Notification) => {
    setNotifications((current) => upsertById(current, incoming))
    setLastSyncedAt(new Date().toISOString())
  }, [])

  const loadInbox = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    }

    setError(null)

    try {
      const [alertsResponse, notificationsResponse] = await Promise.all([
        fetchAlerts(driverId),
        fetchNotifications(driverId),
      ])

      setAlerts(sortByCreatedAtDesc(alertsResponse))
      setNotifications(sortByCreatedAtDesc(notificationsResponse))
      setLastSyncedAt(new Date().toISOString())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to sync the driver inbox.')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [driverId])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    const unreadCount = notifications.filter((notification) => !notification.read).length
    window.dispatchEvent(new CustomEvent('fleet:notifications:count', { detail: unreadCount }))
  }, [notifications])

  useEffect(() => {
    const token = readStoredAuthToken()
    if (!inboxScope || !token) {
      setConnectionState('idle')
      return undefined
    }

    alertSubscriptionRef.current?.unsubscribe()
    notificationSubscriptionRef.current?.unsubscribe()
    void clientRef.current?.deactivate()

    const client = new Client({
      brokerURL: getWebSocketBrokerUrl(),
      webSocketFactory: () => new SockJS(getWebSocketHttpUrl()),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5_000,
      heartbeatIncoming: 4_000,
      heartbeatOutgoing: 4_000,
      beforeConnect: async () => {
        setConnectionState('connecting')
      },
      debug: () => undefined,
    })

    client.onConnect = () => {
      setConnectionState('connected')
      setError(null)

      alertSubscriptionRef.current?.unsubscribe()
      notificationSubscriptionRef.current?.unsubscribe()

      alertSubscriptionRef.current = client.subscribe(inboxScope.alertsTopic, (message) => {
        const parsed = parseJson<Alert>(message)
        if (parsed) {
          replaceAlert(parsed)
        }
      })

      notificationSubscriptionRef.current = client.subscribe(inboxScope.notificationsTopic, (message) => {
        const parsed = parseJson<Notification>(message)
        if (parsed) {
          replaceNotification(parsed)
        }
      })
    }

    client.onStompError = (frame) => {
      setConnectionState('reconnecting')
      setError(frame.headers.message ?? 'Driver inbox connection failed. Reconnecting...')
    }

    client.onWebSocketClose = () => {
      setConnectionState((current) => (current === 'idle' ? 'idle' : 'reconnecting'))
    }

    client.onDisconnect = () => {
      setConnectionState('disconnected')
    }

    client.activate()
    clientRef.current = client

    return () => {
      alertSubscriptionRef.current?.unsubscribe()
      alertSubscriptionRef.current = null
      notificationSubscriptionRef.current?.unsubscribe()
      notificationSubscriptionRef.current = null
      void client.deactivate()
      if (clientRef.current === client) {
        clientRef.current = null
      }
    }
  }, [inboxScope, replaceAlert, replaceNotification])

  return {
    alerts,
    notifications,
    loading,
    error,
    refresh: loadInbox,
    connectionState,
    lastSyncedAt,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    replaceAlert,
    replaceNotification,
    driverId,
    realtimeEnabled: Boolean(inboxScope),
  }
}
