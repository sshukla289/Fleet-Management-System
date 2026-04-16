import { useEffect, useCallback, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useTripStore } from '../store/useTripStore'

const WS_URL = 'http://localhost:8080/ws'

export function useTripWebSocket(tripId: string | undefined) {
  const updateTrip = useTripStore((state) => state.updateTripFromSocket)
  const stompClient = useRef<Client | null>(null)

  const connect = useCallback(() => {
    if (!tripId) return

    const client = new Client({
      brokerURL: 'ws://localhost:8080/ws', // Fallback if SockJS fails or not needed
      webSocketFactory: () => new SockJS(WS_URL),
      debug: (msg) => console.log('STOMP:', msg),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    })

    client.onConnect = () => {
      console.log('Connected to WebSocket')
      client.subscribe(`/topic/trip/${tripId}`, (message) => {
        if (message.body) {
          try {
            const payload = JSON.parse(message.body)
            updateTrip(payload)
          } catch (err) {
            console.error('Failed to parse WS message', err)
          }
        }
      })
    }

    client.onStompError = (frame) => {
      console.error('STOMP error:', frame.headers['message'])
    }

    client.activate()
    stompClient.current = client
  }, [tripId, updateTrip])

  const disconnect = useCallback(() => {
    if (stompClient.current) {
      stompClient.current.deactivate()
      stompClient.current = null
    }
  }, [])

  useEffect(() => {
    if (tripId) {
      connect()
    }
    return () => disconnect()
  }, [tripId, connect, disconnect])

  return { isConnected: stompClient.current?.connected }
}
