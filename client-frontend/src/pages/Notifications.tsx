import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useDriverInbox } from '../hooks/useDriverInbox'
import { markNotificationRead } from '../services/apiService'
import {
  listEmergencyDeliveryReceipts,
  QUEUE_EVENT,
  type EmergencyDeliveryReceiptSummary,
} from '../services/driverEmergencyQueue'
import type { Notification } from '../types'

function toneClass(severity: Notification['severity']) {
  switch (severity) {
    case 'CRITICAL':
      return 'status-pill status-pill--rose'
    case 'HIGH':
      return 'status-pill status-pill--amber'
    case 'MEDIUM':
      return 'status-pill status-pill--blue'
    default:
      return 'status-pill status-pill--mint'
  }
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function describeReceiptStatus(receipt: EmergencyDeliveryReceiptSummary) {
  if (receipt.status === 'DELIVERED') {
    return `Delivered successfully${receipt.deliveredAt ? ` at ${formatDateTime(receipt.deliveredAt)}` : ''}`
  }

  if (receipt.lastRetriedAt) {
    return `Retried at ${formatDateTime(receipt.lastRetriedAt)}`
  }

  return `Queued at ${formatDateTime(receipt.createdAt)}`
}

export function Notifications() {
  const { session } = useAuth()
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    connectionState,
    lastSyncedAt,
    replaceNotification,
    realtimeEnabled,
  } = useDriverInbox()
  const [working, setWorking] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL')
  const [message, setMessage] = useState<string | null>(null)
  const [deliveryReceipts, setDeliveryReceipts] = useState<EmergencyDeliveryReceiptSummary[]>([])
  const isDriver = session?.profile.role === 'DRIVER'

  const loadDeliveryReceipts = useCallback(async () => {
    if (!isDriver) {
      setDeliveryReceipts([])
      return
    }

    setDeliveryReceipts(await listEmergencyDeliveryReceipts())
  }, [isDriver])

  useEffect(() => {
    void loadDeliveryReceipts()
  }, [loadDeliveryReceipts])

  useEffect(() => {
    const handleQueueChange = () => {
      void loadDeliveryReceipts()
    }

    window.addEventListener(QUEUE_EVENT, handleQueueChange)
    return () => window.removeEventListener(QUEUE_EVENT, handleQueueChange)
  }, [loadDeliveryReceipts])

  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === 'UNREAD') {
        return !notification.read
      }

      if (filter === 'READ') {
        return notification.read
      }

      return true
    })
  }, [filter, notifications])

  const criticalCount = notifications.filter((notification) => notification.severity === 'CRITICAL').length
  const unreadNotifications = visibleNotifications.filter((notification) => !notification.read)
  const readNotifications = visibleNotifications.filter((notification) => notification.read)

  async function handleRead(id: string) {
    setWorking(true)

    try {
      const updated = await markNotificationRead(id)
      replaceNotification(updated)
      setMessage('Notification marked as read.')
      window.setTimeout(() => setMessage(null), 3000)
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'Failed to mark notification as read.')
      window.setTimeout(() => setMessage(null), 3000)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="page-shell driver-inbox-page">
      <div className="page-top-actions driver-inbox-page__topbar">
        <div className="driver-inbox-status-row">
          <span className={`driver-inbox-live-pill driver-inbox-live-pill--${connectionState}`}>
            {realtimeEnabled ? `Live ${connectionState}` : 'Snapshot mode'}
          </span>
          {lastSyncedAt ? (
            <span className="driver-inbox-meta">
              Last synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => { void refresh(); }} type="button">
          Refresh
        </button>
      </div>

      {message ? <div className="driver-inbox-banner driver-inbox-banner--success">{message}</div> : null}
      {error ? <div className="driver-inbox-banner driver-inbox-banner--error">{error}</div> : null}

      <section className="dashboard-stats">
        <article className="stat-card">
          <span>Total</span>
          <strong>{notifications.length}</strong>
          <small>Notifications in the current stream</small>
        </article>
        <article className="stat-card">
          <span>Unread</span>
          <strong>{unreadCount}</strong>
          <small>Items still waiting for review</small>
        </article>
        <article className="stat-card">
          <span>Critical</span>
          <strong>{criticalCount}</strong>
          <small>High-priority messages that need attention</small>
        </article>
        <article className="stat-card">
          <span>Read</span>
          <strong>{notifications.length - unreadCount}</strong>
          <small>Already acknowledged by the driver</small>
        </article>
      </section>

      {isDriver ? (
        <section className="table-container--flat">
          <div className="panel__header">
            <div>
              <h3>Emergency delivery receipts</h3>
              <p className="muted">Queued issue reports and SOS alerts stay visible here until they are delivered successfully.</p>
            </div>
            <span className="driver-notification-badge">{deliveryReceipts.length} tracked</span>
          </div>

          {deliveryReceipts.length ? (
            <div className="notification-list">
              {deliveryReceipts.map((receipt) => (
                <article key={receipt.id} className={`notification-card ${receipt.status === 'DELIVERED' ? 'notification-card--read' : 'notification-card--unread'}`}>
                  <div className="notification-card__header">
                    <div>
                      <span className="dashboard-card-header__eyebrow">{receipt.kind.toUpperCase()} RECEIPT</span>
                      <h3>{receipt.label}</h3>
                    </div>
                    <span className={`status-pill ${receipt.status === 'DELIVERED' ? 'status-pill--mint' : receipt.status === 'RETRYING' ? 'status-pill--blue' : 'status-pill--amber'}`}>
                      {receipt.status === 'DELIVERED' ? 'Delivered' : receipt.status === 'RETRYING' ? 'Retrying' : 'Queued'}
                    </span>
                  </div>
                  <p className="muted">{receipt.detail}</p>
                  <div className="notification-card__meta">
                    <span>{describeReceiptStatus(receipt)}</span>
                    <span>{receipt.tripId ?? 'No trip linked'}</span>
                    <span>{receipt.retryCount > 0 ? `${receipt.retryCount} retr${receipt.retryCount === 1 ? 'y' : 'ies'}` : 'Waiting for first retry'}</span>
                  </div>
                  {receipt.lastError ? <p className="muted">Last queue note: {receipt.lastError}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No queued emergency items have been recorded on this device yet.</p>
          )}
        </section>
      ) : null}

      <section className="table-container--flat">
        <div className="panel__header">
          <div>
            <h3>Notification center</h3>
            <p className="muted">Live trip updates, dispatch messages, and system guidance in one place.</p>
          </div>
          <div className="driver-notification-header__actions">
            <span className="driver-notification-badge">{unreadCount} unread</span>
            <div className="trip-detail__chips">
              {['ALL', 'UNREAD', 'READ'].map((value) => (
                <button
                  key={value}
                  className={`dashboard-chip${filter === value ? ' dashboard-chip--warn' : ''}`}
                  onClick={() => setFilter(value as 'ALL' | 'UNREAD' | 'READ')}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleNotifications.length ? (
          <div className="driver-notification-sections">
            {(filter === 'ALL' || filter === 'UNREAD') && unreadNotifications.length ? (
              <section className="driver-notification-section">
                <div className="driver-notification-section__header">
                  <h4>Unread</h4>
                  <span className="driver-notification-badge">{unreadNotifications.length}</span>
                </div>

                <div className="notification-list">
                  {unreadNotifications.map((notification) => (
                    <article key={notification.id} className="notification-card notification-card--unread">
                      <div className="notification-card__header">
                        <div>
                          <span className="dashboard-card-header__eyebrow">{notification.category.replace(/_/g, ' ')}</span>
                          <h3>{notification.title}</h3>
                        </div>
                        <span className={toneClass(notification.severity)}>{notification.severity}</span>
                      </div>
                      <p className="muted">{notification.message}</p>
                      <div className="notification-card__meta">
                        <span>{notification.entityType} {notification.entityId}</span>
                        <span>{formatDateTime(notification.createdAt)}</span>
                        <span>Unread</span>
                      </div>
                      <div className="notification-card__actions">
                        <button
                          className="secondary-button"
                          disabled={working}
                          onClick={() => { void handleRead(notification.id); }}
                          type="button"
                        >
                          Mark read
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {(filter === 'ALL' || filter === 'READ') && readNotifications.length ? (
              <section className="driver-notification-section">
                <div className="driver-notification-section__header">
                  <h4>Reviewed</h4>
                  <span className="driver-notification-badge driver-notification-badge--muted">{readNotifications.length}</span>
                </div>

                <div className="notification-list">
                  {readNotifications.map((notification) => (
                    <article key={notification.id} className="notification-card notification-card--read">
                      <div className="notification-card__header">
                        <div>
                          <span className="dashboard-card-header__eyebrow">{notification.category.replace(/_/g, ' ')}</span>
                          <h3>{notification.title}</h3>
                        </div>
                        <span className={toneClass(notification.severity)}>{notification.severity}</span>
                      </div>
                      <p className="muted">{notification.message}</p>
                      <div className="notification-card__meta">
                        <span>{notification.entityType} {notification.entityId}</span>
                        <span>{formatDateTime(notification.createdAt)}</span>
                        <span>Read</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <p className="muted">No notifications match the selected filter.</p>
        )}
      </section>
    </div>
  )
}
