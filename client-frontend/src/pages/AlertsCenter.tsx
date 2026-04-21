import { useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useDriverInbox } from '../hooks/useDriverInbox'
import { acknowledgeAlert, resolveAlert } from '../services/apiService'
import type { AlertLifecycleStatus, AlertSeverity } from '../types'

type StatusFilter = AlertLifecycleStatus | 'ALL'
type SeverityFilter = AlertSeverity | 'ALL'

function severityTone(severity: AlertSeverity) {
  switch (severity) {
    case 'LOW':
      return 'status-pill status-pill--blue'
    case 'MEDIUM':
      return 'status-pill status-pill--amber'
    default:
      return 'status-pill status-pill--rose'
  }
}

function statusTone(status: AlertLifecycleStatus) {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'status-pill status-pill--mint'
    case 'ACKNOWLEDGED':
    case 'IN_PROGRESS':
      return 'status-pill status-pill--violet'
    default:
      return 'status-pill status-pill--rose'
  }
}

export function AlertsCenter() {
  const { session } = useAuth()
  const {
    alerts,
    loading,
    error,
    refresh,
    connectionState,
    lastSyncedAt,
    replaceAlert,
    realtimeEnabled,
  } = useDriverInbox()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const isDriver = session?.profile.role === 'DRIVER'

  const filteredAlerts = useMemo(() => {
    const severityRank: Record<AlertSeverity, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    }

    return alerts
      .filter((alert) => {
        const matchesStatus = statusFilter === 'ALL' || alert.status === statusFilter
        const matchesSeverity = severityFilter === 'ALL' || alert.severity === severityFilter
        return matchesStatus && matchesSeverity
      })
      .sort((left, right) => {
        const severityDifference = severityRank[right.severity] - severityRank[left.severity]
        if (severityDifference !== 0) {
          return severityDifference
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
  }, [alerts, severityFilter, statusFilter])

  const groupedAlerts = useMemo(() => {
    const order: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    return order
      .map((severity) => ({
        severity,
        items: filteredAlerts.filter((alert) => alert.severity === severity),
      }))
      .filter((group) => group.items.length > 0)
  }, [filteredAlerts])

  const stats = {
    total: alerts.length,
    open: alerts.filter((alert) => alert.status === 'OPEN').length,
    critical: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
    acknowledged: alerts.filter((alert) => alert.status === 'ACKNOWLEDGED').length,
  }

  async function handleAction(id: string, action: 'acknowledge' | 'resolve') {
    setWorkingId(id)

    try {
      const updated = action === 'acknowledge'
        ? await acknowledgeAlert(id)
        : await resolveAlert(id)

      replaceAlert(updated)
      setMessage(`Alert ${action === 'acknowledge' ? 'acknowledged' : 'resolved'} successfully.`)
      window.setTimeout(() => setMessage(null), 3000)
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'Unable to update alert.')
      window.setTimeout(() => setMessage(null), 3000)
    } finally {
      setWorkingId(null)
    }
  }

  if (loading && alerts.length === 0) {
    return <div className="dd-loading">Syncing operational alert stream...</div>
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
        <button className="secondary-button" onClick={() => { void refresh(); }} type="button">
          Refresh feed
        </button>
      </div>

      {message ? <div className="driver-inbox-banner driver-inbox-banner--success">{message}</div> : null}
      {error ? <div className="driver-inbox-banner driver-inbox-banner--error">{error}</div> : null}

      <section className="dashboard-stats">
        <article className="stat-card">
          <span>Total Alerts</span>
          <strong>{stats.total}</strong>
          <small>Current driver-visible alert stream</small>
        </article>
        <article className="stat-card">
          <span>Open</span>
          <strong>{stats.open}</strong>
          <small>Items still waiting for acknowledgement</small>
        </article>
        <article className="stat-card">
          <span>Critical</span>
          <strong>{stats.critical}</strong>
          <small>Immediate attention required</small>
        </article>
        <article className="stat-card">
          <span>Acknowledged</span>
          <strong>{stats.acknowledged}</strong>
          <small>Seen and being worked through</small>
        </article>
      </section>

      <section className="driver-inbox-toolbar">
        <div className="driver-inbox-filter-group">
          <small className="driver-inbox-filter-label">Lifecycle status</small>
          <div className="trip-detail__chips">
            {['ALL', 'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
              <button
                key={status}
                className={`dashboard-chip${statusFilter === status ? ' dashboard-chip--info' : ''}`}
                onClick={() => setStatusFilter(status as StatusFilter)}
                type="button"
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="driver-inbox-filter-group">
          <small className="driver-inbox-filter-label">Severity</small>
          <div className="trip-detail__chips">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => (
              <button
                key={severity}
                className={`dashboard-chip${severityFilter === severity ? ' dashboard-chip--warn' : ''}`}
                onClick={() => setSeverityFilter(severity as SeverityFilter)}
                type="button"
              >
                {severity}
              </button>
            ))}
          </div>
        </div>
      </section>

      {groupedAlerts.length > 0 ? (
        <div className="driver-alert-groups">
          {groupedAlerts.map((group) => (
            <section key={group.severity} className="driver-alert-group">
              <div className="driver-alert-group__header">
                <div>
                  <h3>{group.severity} severity</h3>
                  <p className="muted">{group.items.length} alerts in this group.</p>
                </div>
                <span className={`driver-alert-group__badge driver-alert-group__badge--${group.severity.toLowerCase()}`}>
                  {group.items.length}
                </span>
              </div>

              <div className="driver-alert-list">
                {group.items.map((alert) => (
                  <article key={alert.id} className={`driver-alert-card driver-alert-card--${alert.severity.toLowerCase()}`}>
                    <div className="driver-alert-card__header">
                      <div>
                        <span className="dashboard-card-header__eyebrow">{alert.category.replace(/_/g, ' ')}</span>
                        <h3>{alert.title}</h3>
                      </div>
                      <div className="driver-alert-card__chips">
                        <span className={severityTone(alert.severity)}>{alert.severity}</span>
                        <span className={statusTone(alert.status)}>{alert.status}</span>
                      </div>
                    </div>

                    <p className="muted">{alert.description}</p>

                    <div className="driver-alert-card__meta">
                      {alert.relatedTripId ? <span>Trip {alert.relatedTripId}</span> : null}
                      {alert.relatedVehicleId ? <span>Vehicle {alert.relatedVehicleId}</span> : null}
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="driver-alert-card__actions">
                      <button
                        className="secondary-button"
                        disabled={workingId === alert.id || alert.status !== 'OPEN'}
                        onClick={() => { void handleAction(alert.id, 'acknowledge'); }}
                        type="button"
                      >
                        {workingId === alert.id ? 'Working...' : 'Acknowledge'}
                      </button>
                      {!isDriver ? (
                        <button
                          className="driver-inbox-primary-button"
                          disabled={workingId === alert.id || (alert.status !== 'OPEN' && alert.status !== 'ACKNOWLEDGED')}
                          onClick={() => { void handleAction(alert.id, 'resolve'); }}
                          type="button"
                        >
                          {workingId === alert.id ? 'Working...' : 'Resolve'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="table-container--flat driver-inbox-empty">
          <h3>No alerts match the current filters</h3>
          <p className="muted">The driver alert stream is clear right now.</p>
        </section>
      )}
    </div>
  )
}
