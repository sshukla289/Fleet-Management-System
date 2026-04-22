import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useDriverInbox } from '../hooks/useDriverInbox'
import { acknowledgeAlert, fetchTrips, fetchVehicles, resolveAlert } from '../services/apiService'
import type { Alert, AlertLifecycleStatus, AlertSeverity, Trip, TripStatus, Vehicle } from '../types'
import './AlertsCenter.css'

type StatusFilter = AlertLifecycleStatus | 'ALL'
type SeverityFilter = AlertSeverity | 'ALL'
type EnrichedAlert = {
  alert: Alert
  trip: Trip | null
  vehicle: Vehicle | null
  region: string
  tripId: string
  routeId: string
  tripStatus: TripStatus | null
  vehicleId: string
  vehicleName: string
}

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const SEVERITY_FILTERS: SeverityFilter[] = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const UNKNOWN_REGION = 'Unassigned region'
const OPEN_ALERT_STATUSES: AlertLifecycleStatus[] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
const RESOLVABLE_ALERT_STATUSES: AlertLifecycleStatus[] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
const ALERT_SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

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

function tripStatusTone(status: TripStatus | null) {
  switch (status) {
    case 'COMPLETED':
      return 'status-pill status-pill--mint'
    case 'DISPATCHED':
    case 'IN_PROGRESS':
      return 'status-pill status-pill--blue'
    case 'PAUSED':
    case 'BLOCKED':
      return 'status-pill status-pill--amber'
    case 'CANCELLED':
      return 'status-pill status-pill--rose'
    default:
      return 'status-pill status-pill--violet'
  }
}

function formatCategory(category: Alert['category']) {
  return category.replace(/_/g, ' ')
}

function formatAlertTimestamp(value: string) {
  return new Date(value).toLocaleString()
}

function sortAlertsByPriority<T extends { alert: Alert }>(items: T[]) {
  return [...items].sort((left, right) => {
    const severityDifference = ALERT_SEVERITY_RANK[right.alert.severity] - ALERT_SEVERITY_RANK[left.alert.severity]
    if (severityDifference !== 0) {
      return severityDifference
    }

    return new Date(right.alert.updatedAt ?? right.alert.createdAt).getTime()
      - new Date(left.alert.updatedAt ?? left.alert.createdAt).getTime()
  })
}

function isOpenAlert(status: AlertLifecycleStatus) {
  return OPEN_ALERT_STATUSES.includes(status)
}

function AlertActionButtons({
  alert,
  isDriver,
  workingId,
  onAction,
}: {
  alert: Alert
  isDriver: boolean
  workingId: string | null
  onAction: (id: string, action: 'acknowledge' | 'resolve') => Promise<void>
}) {
  return (
    <div className="driver-alert-card__actions">
      <button
        className="secondary-button"
        disabled={workingId === alert.id || alert.status !== 'OPEN'}
        onClick={() => { void onAction(alert.id, 'acknowledge') }}
        type="button"
      >
        {workingId === alert.id ? 'Working...' : 'Acknowledge'}
      </button>
      {!isDriver ? (
        <button
          className="driver-inbox-primary-button"
          disabled={workingId === alert.id || !RESOLVABLE_ALERT_STATUSES.includes(alert.status)}
          onClick={() => { void onAction(alert.id, 'resolve') }}
          type="button"
        >
          {workingId === alert.id ? 'Working...' : 'Resolve'}
        </button>
      ) : null}
    </div>
  )
}

function DriverAlertsFeed({
  alerts,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  isDriver,
  workingId,
  onAction,
}: {
  alerts: Alert[]
  severityFilter: SeverityFilter
  setSeverityFilter: (value: SeverityFilter) => void
  statusFilter: StatusFilter
  setStatusFilter: (value: StatusFilter) => void
  isDriver: boolean
  workingId: string | null
  onAction: (id: string, action: 'acknowledge' | 'resolve') => Promise<void>
}) {
  const filteredAlerts = useMemo(() => {
    return sortAlertsByPriority(
      alerts
        .filter((alert) => {
          const matchesStatus = statusFilter === 'ALL' || alert.status === statusFilter
          const matchesSeverity = severityFilter === 'ALL' || alert.severity === severityFilter
          return matchesStatus && matchesSeverity
        })
        .map((alert) => ({ alert })),
    ).map((item) => item.alert)
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

  return (
    <>
      <section className="driver-inbox-toolbar">
        <div className="driver-inbox-filter-group">
          <small className="driver-inbox-filter-label">Lifecycle status</small>
          <div className="trip-detail__chips">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                className={`dashboard-chip${statusFilter === status ? ' dashboard-chip--info' : ''}`}
                onClick={() => setStatusFilter(status)}
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
            {SEVERITY_FILTERS.map((severity) => (
              <button
                key={severity}
                className={`dashboard-chip${severityFilter === severity ? ' dashboard-chip--warn' : ''}`}
                onClick={() => setSeverityFilter(severity)}
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
                        <span className="dashboard-card-header__eyebrow">{formatCategory(alert.category)}</span>
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
                      <span>{formatAlertTimestamp(alert.createdAt)}</span>
                    </div>

                    <AlertActionButtons alert={alert} isDriver={isDriver} onAction={onAction} workingId={workingId} />
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
    </>
  )
}

function AdminAlertsGovernance({
  alerts,
  trips,
  vehicles,
  adminContextError,
  adminContextLoading,
  connectionState,
  lastSyncedAt,
  refresh,
  isDriver,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  workingId,
  onAction,
}: {
  alerts: Alert[]
  trips: Trip[]
  vehicles: Vehicle[]
  adminContextError: string | null
  adminContextLoading: boolean
  connectionState: string
  lastSyncedAt: string | null
  refresh: () => void
  isDriver: boolean
  severityFilter: SeverityFilter
  setSeverityFilter: (value: SeverityFilter) => void
  statusFilter: StatusFilter
  setStatusFilter: (value: StatusFilter) => void
  workingId: string | null
  onAction: (id: string, action: 'acknowledge' | 'resolve') => Promise<void>
}) {
  const [tripFilter, setTripFilter] = useState('ALL')
  const [regionFilter, setRegionFilter] = useState('ALL')

  const tripLookup = useMemo(() => new Map(trips.map((trip) => [trip.tripId, trip])), [trips])
  const vehicleLookup = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles])

  const enrichedAlerts = useMemo<EnrichedAlert[]>(() => {
    return alerts.map((alert) => {
      const trip = alert.relatedTripId ? tripLookup.get(alert.relatedTripId) ?? null : null
      const vehicleId = alert.relatedVehicleId || trip?.assignedVehicleId || ''
      const vehicle = vehicleId ? vehicleLookup.get(vehicleId) ?? null : null
      const region = vehicle?.assignedRegion?.trim() || UNKNOWN_REGION

      return {
        alert,
        trip,
        vehicle,
        region,
        tripId: alert.relatedTripId || trip?.tripId || '',
        routeId: trip?.routeId || '',
        tripStatus: trip?.status ?? null,
        vehicleId,
        vehicleName: vehicle?.name || vehicleId || 'No linked vehicle',
      }
    })
  }, [alerts, tripLookup, vehicleLookup])

  const filteredAlerts = useMemo(() => {
    return sortAlertsByPriority(
      enrichedAlerts.filter((item) => {
        const matchesStatus = statusFilter === 'ALL' || item.alert.status === statusFilter
        const matchesSeverity = severityFilter === 'ALL' || item.alert.severity === severityFilter
        const matchesTrip = tripFilter === 'ALL' || item.tripId === tripFilter
        const matchesRegion = regionFilter === 'ALL' || item.region === regionFilter
        return matchesStatus && matchesSeverity && matchesTrip && matchesRegion
      }),
    )
  }, [enrichedAlerts, regionFilter, severityFilter, statusFilter, tripFilter])

  const criticalWatchlist = useMemo(
    () =>
      sortAlertsByPriority(
        enrichedAlerts.filter((item) => item.alert.severity === 'CRITICAL' && isOpenAlert(item.alert.status)),
      ),
    [enrichedAlerts],
  )

  const tripOptions = useMemo(() => {
    const seen = new Map<string, string>()
    enrichedAlerts.forEach((item) => {
      if (!item.tripId || seen.has(item.tripId)) {
        return
      }

      const pieces = [item.tripId]
      if (item.routeId) {
        pieces.push(item.routeId)
      }
      if (item.tripStatus) {
        pieces.push(item.tripStatus)
      }
      seen.set(item.tripId, pieces.join(' - '))
    })
    return Array.from(seen.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [enrichedAlerts])

  const regionOptions = useMemo(
    () => [...new Set(enrichedAlerts.map((item) => item.region).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [enrichedAlerts],
  )

  const stats = {
    total: alerts.length,
    open: alerts.filter((alert) => alert.status === 'OPEN').length,
    critical: criticalWatchlist.length,
    resolved: alerts.filter((alert) => alert.status === 'RESOLVED').length,
  }

  return (
    <>
      <section className="admin-alerts-hero">
        <div>
          <span className="admin-alerts-hero__eyebrow">Admin governance</span>
          <h2>Admin Alert Governance</h2>
          <p>
            Monitor the live alert stream, isolate issues by severity, trip, and region, and drive
            acknowledgement or resolution without leaving the control tower.
          </p>
        </div>
        <div className="admin-alerts-hero__meta">
          <span className={`driver-inbox-live-pill driver-inbox-live-pill--${connectionState}`}>
            Live {connectionState}
          </span>
          <strong>Real-time alert system</strong>
          <p>
            {lastSyncedAt
              ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Waiting for first sync.'}
          </p>
        </div>
      </section>

      <section className="dashboard-stats">
        <article className="stat-card">
          <span>Total alerts</span>
          <strong>{stats.total}</strong>
          <small>Full admin-visible operational stream</small>
        </article>
        <article className="stat-card">
          <span>Open</span>
          <strong>{stats.open}</strong>
          <small>Still waiting for acknowledgement</small>
        </article>
        <article className="stat-card stat-card--critical">
          <span>Critical</span>
          <strong>{stats.critical}</strong>
          <small>Prominently pinned until cleared</small>
        </article>
        <article className="stat-card">
          <span>Resolved</span>
          <strong>{stats.resolved}</strong>
          <small>Closed out by operations leadership</small>
        </article>
      </section>

      {adminContextError ? (
        <section className="driver-inbox-banner driver-inbox-banner--error">
          {adminContextError}
        </section>
      ) : null}

      <section className="admin-alerts-filter-panel">
        <div className="admin-alerts-filter-panel__header">
          <div>
            <h3>Governance filters</h3>
            <p>Filter the alert queue by severity, linked trip, operating region, or lifecycle state.</p>
          </div>
          <button className="secondary-button" onClick={refresh} type="button">
            Refresh queue
          </button>
        </div>

        <div className="admin-alerts-filter-grid">
          <label>
            <span>Lifecycle status</span>
            <select onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Severity</span>
            <select onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} value={severityFilter}>
              {SEVERITY_FILTERS.map((severity) => (
                <option key={severity} value={severity}>
                  {severity === 'ALL' ? 'All severities' : severity}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Trip focus</span>
            <select
              disabled={adminContextLoading || tripOptions.length === 0}
              onChange={(event) => setTripFilter(event.target.value)}
              value={tripFilter}
            >
              <option value="ALL">All trips</option>
              {tripOptions.map(([tripId, label]) => (
                <option key={tripId} value={tripId}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Region</span>
            <select
              disabled={adminContextLoading || regionOptions.length === 0}
              onChange={(event) => setRegionFilter(event.target.value)}
              value={regionFilter}
            >
              <option value="ALL">All regions</option>
              {regionOptions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="admin-alerts-critical-board">
        <div className="admin-alerts-critical-board__header">
          <div>
            <h3>Critical watchlist</h3>
            <p>Critical alerts stay pinned here until they are acknowledged or resolved.</p>
          </div>
          <span className="admin-alerts-critical-board__count">{criticalWatchlist.length}</span>
        </div>

        {criticalWatchlist.length > 0 ? (
          <div className="admin-alerts-critical-board__grid">
            {criticalWatchlist.slice(0, 3).map((item) => (
              <article key={item.alert.id} className="admin-alert-critical-card">
                <div className="admin-alert-critical-card__header">
                  <div>
                    <span className="dashboard-card-header__eyebrow">{formatCategory(item.alert.category)}</span>
                    <h4>{item.alert.title}</h4>
                  </div>
                  <span className={severityTone(item.alert.severity)}>{item.alert.severity}</span>
                </div>

                <p>{item.alert.description}</p>

                <div className="admin-alert-critical-card__meta">
                  <span>{item.tripId ? `Trip ${item.tripId}` : 'No linked trip'}</span>
                  <span>{item.routeId ? `Route ${item.routeId}` : 'No route context'}</span>
                  <span>{item.region}</span>
                  <span>{formatAlertTimestamp(item.alert.updatedAt ?? item.alert.createdAt)}</span>
                </div>

                <AlertActionButtons alert={item.alert} isDriver={isDriver} onAction={onAction} workingId={workingId} />
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-alerts-critical-board__empty">
            <strong>Critical watchlist is clear.</strong>
            <p>High, medium, and low alerts still continue to stream in real time below.</p>
          </div>
        )}
      </section>

      <section className="admin-alerts-queue">
        <div className="admin-alerts-queue__header">
          <div>
            <h3>Alert queue</h3>
            <p>{filteredAlerts.length} alerts match the current governance filters.</p>
          </div>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className="admin-alerts-list">
            {filteredAlerts.map((item) => (
              <article
                key={item.alert.id}
                className={`admin-alert-card admin-alert-card--${item.alert.severity.toLowerCase()}`}
              >
                <div className="admin-alert-card__header">
                  <div>
                    <span className="dashboard-card-header__eyebrow">{formatCategory(item.alert.category)}</span>
                    <h3>{item.alert.title}</h3>
                  </div>
                  <div className="admin-alert-card__chips">
                    <span className={severityTone(item.alert.severity)}>{item.alert.severity}</span>
                    <span className={statusTone(item.alert.status)}>{item.alert.status}</span>
                    {item.tripStatus ? <span className={tripStatusTone(item.tripStatus)}>{item.tripStatus}</span> : null}
                  </div>
                </div>

                <p className="muted">{item.alert.description}</p>

                <div className="admin-alert-card__meta">
                  <span>{item.tripId ? `Trip ${item.tripId}` : 'No linked trip'}</span>
                  <span>{item.routeId ? `Route ${item.routeId}` : 'No route context'}</span>
                  <span>{item.region}</span>
                  <span>{item.vehicleName}</span>
                  <span>{formatAlertTimestamp(item.alert.updatedAt ?? item.alert.createdAt)}</span>
                </div>

                <AlertActionButtons alert={item.alert} isDriver={isDriver} onAction={onAction} workingId={workingId} />
              </article>
            ))}
          </div>
        ) : (
          <section className="table-container--flat driver-inbox-empty">
            <h3>No alerts match the current governance filters</h3>
            <p className="muted">Try broadening the trip, region, or severity scope.</p>
          </section>
        )}
      </section>
    </>
  )
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
  const [adminTrips, setAdminTrips] = useState<Trip[]>([])
  const [adminVehicles, setAdminVehicles] = useState<Vehicle[]>([])
  const [adminContextLoading, setAdminContextLoading] = useState(false)
  const [adminContextError, setAdminContextError] = useState<string | null>(null)
  const role = session?.profile.role
  const isDriver = role === 'DRIVER'
  const isAdmin = role === 'ADMIN'

  const loadAdminContext = useCallback(async () => {
    if (!isAdmin) {
      setAdminTrips([])
      setAdminVehicles([])
      setAdminContextError(null)
      setAdminContextLoading(false)
      return
    }

    setAdminContextLoading(true)
    setAdminContextError(null)

    try {
      const [tripResponse, vehicleResponse] = await Promise.all([fetchTrips(), fetchVehicles()])
      setAdminTrips(tripResponse)
      setAdminVehicles(
        vehicleResponse.map((vehicle) => ({
          ...vehicle,
          assignedRegion: vehicle.assignedRegion ?? '',
          driverId: vehicle.driverId ?? '',
        })),
      )
    } catch (contextError) {
      setAdminContextError(
        contextError instanceof Error
          ? `${contextError.message} Trip and region filters are temporarily limited.`
          : 'Trip and region filters are temporarily limited.',
      )
    } finally {
      setAdminContextLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void loadAdminContext()
  }, [loadAdminContext])

  useEffect(() => {
    if (!message) {
      return undefined
    }

    const timer = window.setTimeout(() => setMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  const stats = {
    total: alerts.length,
    open: alerts.filter((alert) => alert.status === 'OPEN').length,
    critical: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
    acknowledged: alerts.filter((alert) => alert.status === 'ACKNOWLEDGED').length,
  }

  const handleRefresh = useCallback(() => {
    void refresh()
    if (isAdmin) {
      void loadAdminContext()
    }
  }, [isAdmin, loadAdminContext, refresh])

  async function handleAction(id: string, action: 'acknowledge' | 'resolve') {
    setWorkingId(id)

    try {
      const updated = action === 'acknowledge'
        ? await acknowledgeAlert(id)
        : await resolveAlert(id)

      replaceAlert(updated)
      setMessage(`Alert ${action === 'acknowledge' ? 'acknowledged' : 'resolved'} successfully.`)
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'Unable to update alert.')
    } finally {
      setWorkingId(null)
    }
  }

  if (loading && alerts.length === 0) {
    return (
      <div className="dd-loading">
        {isAdmin ? 'Syncing the live admin alert governance stream...' : 'Syncing operational alert stream...'}
      </div>
    )
  }

  return (
    <div className={`page-shell driver-inbox-page${isAdmin ? ' admin-alerts-page' : ''}`}>
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
        {!isAdmin ? (
          <button className="secondary-button" onClick={handleRefresh} type="button">
            Refresh feed
          </button>
        ) : null}
      </div>

      {message ? <div className="driver-inbox-banner driver-inbox-banner--success">{message}</div> : null}
      {error ? <div className="driver-inbox-banner driver-inbox-banner--error">{error}</div> : null}

      {isAdmin ? (
        <AdminAlertsGovernance
          adminContextError={adminContextError}
          adminContextLoading={adminContextLoading}
          alerts={alerts}
          connectionState={connectionState}
          isDriver={isDriver}
          lastSyncedAt={lastSyncedAt}
          onAction={handleAction}
          refresh={handleRefresh}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          trips={adminTrips}
          vehicles={adminVehicles}
          workingId={workingId}
        />
      ) : (
        <>
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

          <DriverAlertsFeed
            alerts={alerts}
            isDriver={isDriver}
            onAction={handleAction}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            workingId={workingId}
          />
        </>
      )}
    </div>
  )
}
