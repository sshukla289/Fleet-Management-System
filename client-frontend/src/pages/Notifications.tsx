import { useEffect, useMemo, useState } from 'react'
import { fetchNotifications, markNotificationRead } from '../services/apiService'
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

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
    const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL')

  async function loadNotifications() {
    setLoading(true)

    try {
      const data = await fetchNotifications()
      setNotifications(data)
    } catch (error: unknown) { console.error(error);  console.error(); } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
  }, [])

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

  const unreadCount = notifications.filter((notification) => !notification.read).length
  const criticalCount = notifications.filter((notification) => notification.severity === 'CRITICAL').length

  async function handleRead(id: string) {
    setWorking(true)

    try {
      const updated = await markNotificationRead(id)
      setNotifications((current) => current.map((item) => (item.id === id ? updated : item)))
    } catch (error: unknown) { console.error(error);  console.error(); } finally {
      setWorking(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="page-top-actions">
        <button className="secondary-button" disabled={loading} onClick={() => { void loadNotifications(); }} type="button">
          Refresh
        </button>
      </div>



      <section className="dashboard-stats">
        {[
          { label: 'Total', value: notifications.length, note: 'Notifications in the active stream' },
          { label: 'Unread', value: unreadCount, note: 'Items awaiting review' },
          { label: 'Critical', value: criticalCount, note: 'High-priority event notifications' },
          { label: 'Read', value: notifications.length - unreadCount, note: 'Items already acknowledged' },
        ].map((stat) => (
          <article key={stat.label} className="stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
          </article>
        ))}
      </section>

      <section className="table-container--flat">
        <div className="panel__header">
          <div>
            <h3>Notification stream</h3>
            <p className="muted">Filter by read state and acknowledge individual events when reviewed.</p>
          </div>
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

        <div className="notification-list">
          {visibleNotifications.length ? (
            visibleNotifications.map((notification) => (
              <article key={notification.id} className={`notification-card${notification.read ? ' notification-card--read' : ''}`}>
                <div className="notification-card__header">
                  <div>
                    <span className="dashboard-card-header__eyebrow">{notification.category}</span>
                    <h3>{notification.title}</h3>
                  </div>
                  <span className={toneClass(notification.severity)}>{notification.severity}</span>
                </div>
                <p className="muted">{notification.message}</p>
                <div className="notification-card__meta">
                  <span>{notification.entityType} {notification.entityId}</span>
                  <span>{formatDateTime(notification.createdAt)}</span>
                  <span>{notification.read ? 'Read' : 'Unread'}</span>
                </div>
                <div className="notification-card__actions">
                  {!notification.read ? (
                    <button className="secondary-button" disabled={working} onClick={() => void handleRead(notification.id)} type="button">
                      Mark read
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <p className="muted">No notifications match the selected filter.</p>
          )}
        </div>
      </section>
    </div>
  )
}
