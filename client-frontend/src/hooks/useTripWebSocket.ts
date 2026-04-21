import { useEffect, useEffectEvent, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useTripStore } from '../store/useTripStore'
import { getWebSocketBrokerUrl, getWebSocketHttpUrl, readStoredAuthToken } from '../services/websocketService'

export function useTripWebSocket(tripId: string | undefined) {
  const updateTrip = useTripStore((state) => state.updateTripFromSocket)
  const stompClient = useRef<Client | null>(null)
  const handleIncomingMessage = useEffectEvent((body: string) => {
    try {
      updateTrip(JSON.parse(body))
    } catch (error) {
      console.error('Failed to parse trip socket payload', error)
    }
  })

  useEffect(() => {
    const token = readStoredAuthToken()
    if (!tripId || !token) {
      return undefined
    }

    const client = new Client({
      brokerURL: getWebSocketBrokerUrl(),
      webSocketFactory: () => new SockJS(getWebSocketHttpUrl()),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: () => undefined,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    })

    client.onConnect = () => {
      client.subscribe(`/topic/trip/${tripId}`, (message) => {
        if (message.body) {
          handleIncomingMessage(message.body)
        }
      })
    }

    client.onStompError = (frame) => {
      console.error('STOMP error:', frame.headers['message'])
    }

    client.activate()
    stompClient.current = client

    return () => {
      void stompClient.current?.deactivate()
      stompClient.current = null
    }
  }, [tripId])
}
