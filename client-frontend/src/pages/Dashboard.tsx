import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchDashboardActionQueue,
  fetchDashboardAnalytics,
  fetchDashboardExceptions,
  fetchMaintenanceSchedules,
} from '../services/apiService'
import type {
  DashboardActionQueueItem,
  DashboardAnalytics,
  DashboardExceptionItem,
  MaintenanceSchedule,
} from '../types'

function toneClass(tone: DashboardAnalytics['kpis'][number]['tone']) {
  return `dashboard-summary-card tone-${tone}`
}

function severityClass(severity: DashboardExceptionItem['severity']) {
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

function queueClass(priority: string) {
  switch (priority) {
    case 'CRITICAL':
      return 'dashboard-chip dashboard-chip--warn'
    case 'HIGH':
      return 'dashboard-chip dashboard-chip--rose'
    case 'MEDIUM':
      return 'dashboard-chip dashboard-chip--info'
    default:
      return 'dashboard-chip'
  }
}

function queueToneClass(priority: string) {
  switch (priority) {
    case 'CRITICAL':
      return 'tone-rose'
    case 'HIGH':
      return 'tone-amber'
    case 'MEDIUM':
      return 'tone-blue'
    default:
      return 'tone-mint'
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Pending'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function SectionCard({
  eyebrow,
  title,
  meta,
  children,
}: {
  eyebrow: string
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <article className="dashboard-panel--flat">
      <div className="dashboard-card-header">
        <div>
          <span className="dashboard-card-header__eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        {meta ? <span className="dashboard-chip">{meta}</span> : null}
      </div>
      {children}
    </article>
  )
}

export function Dashboard() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [actionQueue, setActionQueue] = useState<DashboardActionQueueItem[]>([])
  const [exceptions, setExceptions] = useState<DashboardExceptionItem[]>([])
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([])
  const [loading, setLoading] = useState(true)
  
  async function loadDashboard() {
    setLoading(true)

    try {
      const [analyticsData, queueData, exceptionData, scheduleData] = await Promise.all([
        fetchDashboardAnalytics(),
        fetchDashboardActionQueue(),
        fetchDashboardExceptions(),
        fetchMaintenanceSchedules(),
      ])

      setAnalytics(analyticsData)
      setActionQueue(queueData)
      setExceptions(exceptionData)
      setMaintenanceSchedules(scheduleData)
    } catch (error: unknown) { console.error(error);  console.error(); } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const blockedMaintenance = useMemo(
    () =>
      maintenanceSchedules.filter(
        (schedule) => schedule.blockDispatch && ['PLANNED', 'IN_PROGRESS'].includes(schedule.status),
      ),
    [maintenanceSchedules],
  )

  const delayedTrips = analytics?.delayedTripsSummary ?? []
  const criticalAlerts = analytics?.criticalAlertSummary ?? []
  const readiness = analytics?.fleetReadinessPercent ?? 0

  return (
    <div className="dashboard-page page-shell">
      <div className="page-top-actions">
        <button className="secondary-button" disabled={loading} onClick={() => { void loadDashboard(); }} type="button">
          Refresh control tower
        </button>
      </div>



      <section className="dashboard-section">
        <div className="dashboard-hero dashboard-hero--tower">
          <div>
            <span className="dashboard-card-header__eyebrow">Command view</span>
            <h2>Fleet control tower</h2>
            <p className="muted">
              The server aggregates active trips, delayed trips, critical alerts, blocked vehicles, and crew readiness so dispatch can react quickly.
            </p>
          </div>
          <div className="dashboard-hero__metrics">
            <div className="dashboard-hero__metric">
              <span>Fleet readiness</span>
              <strong>{readiness}%</strong>
            </div>
            <div className="dashboard-hero__metric">
              <span>Action queue</span>
              <strong>{actionQueue.length}</strong>
            </div>
            <div className="dashboard-hero__metric">
              <span>Exceptions</span>
              <strong>{exceptions.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">KPI cards</span>
            <h2 className="dashboard-section__title">Operational health</h2>
          </div>
          <span className="dashboard-section__counter">{analytics?.kpis?.length ?? 0} metrics</span>
        </div>
        <div className="dashboard-summary-grid">
          {(analytics?.kpis ?? []).map((kpi) => (
            <article key={kpi.key} className={toneClass(kpi.tone)}>
              <span className="dashboard-summary-card__label">{kpi.label}</span>
              <strong className="dashboard-summary-card__value">{kpi.value}</strong>
              <p className="dashboard-summary-card__note">{kpi.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Action queue</span>
            <h2 className="dashboard-section__title">Operational work</h2>
          </div>
          <span className="dashboard-section__counter">{actionQueue.length} tasks</span>
        </div>
        <div className="dashboard-action-grid">
          {actionQueue.map((item) => (
            <article key={item.id} className={`dashboard-action-card ${queueToneClass(item.priority)}`}>
              <span className="dashboard-action-card__eyebrow">{item.category}</span>
              <strong className="dashboard-action-card__title">{item.title}</strong>
              <div className="dashboard-action-card__count">{item.status}</div>
              <p className="dashboard-action-card__note">{item.note}</p>
              <div className="dashboard-action-card__footer">
                <span className={queueClass(item.priority)}>{item.priority}</span>
                <Link className="dashboard-action-card__link" to={item.actionPath}>
                  {item.actionLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Exceptions</span>
            <h2 className="dashboard-section__title">Critical issues</h2>
          </div>
          <span className="dashboard-section__counter">{exceptions.length} exceptions</span>
        </div>
        <div className="dashboard-exception-grid">
          {exceptions.slice(0, 8).map((item) => (
            <article key={item.id} className="dashboard-exception-card">
              <div className="dashboard-exception-card__header">
                <div>
                  <span className="dashboard-card-header__eyebrow">{item.category}</span>
                  <h3>{item.title}</h3>
                </div>
                <span className={severityClass(item.severity)}>{item.severity}</span>
              </div>
              <p className="muted">{item.message}</p>
              <div className="dashboard-exception-card__meta">
                <span>{item.status}</span>
                <span>{item.relatedTripId ? `Trip ${item.relatedTripId}` : 'No trip link'}</span>
                <span>{item.relatedVehicleId ? `Vehicle ${item.relatedVehicleId}` : 'No vehicle link'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-control-grid">
        <SectionCard
          eyebrow="Delayed trips"
          title="Trips beyond plan"
          meta={`${delayedTrips.length} delayed`}
        >
          <div className="dashboard-queue-list">
            {delayedTrips.length ? (
              delayedTrips.map((trip) => (
                <div key={trip.tripId} className="dashboard-queue-item">
                  <div>
                    <strong>{trip.tripId}</strong>
                    <p>{trip.routeId} | {trip.vehicleId} | {trip.driverId}</p>
                    <small>{trip.reason}</small>
                  </div>
                  <span className="dashboard-queue-item__status tone-rose">{trip.minutesLate} min late</span>
                </div>
              ))
            ) : (
              <p className="muted">No delayed trips are currently active.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Critical alerts"
          title="Generalized alert engine"
          meta={`${criticalAlerts.length} critical`}
        >
          <div className="dashboard-queue-list">
            {criticalAlerts.length ? (
              criticalAlerts.map((alert) => (
                <div key={alert.id} className="dashboard-queue-item">
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.category} | {alert.relatedTripId ?? alert.relatedVehicleId ?? 'Unlinked'}</p>
                    <small>{formatDateTime(alert.createdAt)}</small>
                  </div>
                  <span className="dashboard-queue-item__status tone-amber">{alert.severity}</span>
                </div>
              ))
            ) : (
              <p className="muted">No critical alerts are open right now.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Blocked vehicles"
          title="Dispatch holds"
          meta={`${analytics?.blockedVehicles?.length ?? 0} blocked`}
        >
          <div className="dashboard-queue-list">
            {(analytics?.blockedVehicles ?? []).length ? (
              (analytics?.blockedVehicles ?? []).map((vehicle) => (
                <div key={vehicle.id} className="dashboard-queue-item">
                  <div>
                    <strong>{vehicle.title}</strong>
                    <p>{vehicle.subtitle}</p>
                    <small>{vehicle.note}</small>
                  </div>
                  <Link className="dashboard-queue-item__status tone-violet" to={vehicle.actionPath}>
                    {vehicle.status}
                  </Link>
                </div>
              ))
            ) : (
              <p className="muted">No blocked vehicles are currently on hold.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Maintenance blocks"
          title="Vehicles on hold"
          meta={`${blockedMaintenance.length} blocked`}
        >
          <div className="dashboard-queue-list">
            {blockedMaintenance.length ? (
              blockedMaintenance.map((schedule) => (
                <div key={schedule.id} className="dashboard-queue-item">
                  <div>
                    <strong>{schedule.vehicleId}</strong>
                    <p>{schedule.title}</p>
                    <small>{schedule.reasonCode ?? 'BLOCKED'}</small>
                  </div>
                  <span className="dashboard-queue-item__status tone-violet">{schedule.status}</span>
                </div>
              ))
            ) : (
              <p className="muted">No blocking maintenance schedules detected.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Fleet readiness"
          title="Drivers on duty"
          meta={`${analytics?.driversOnDutySnapshot?.length ?? 0} live`}
        >
          <div className="dashboard-queue-list">
            {(analytics?.driversOnDutySnapshot ?? []).length ? (
              (analytics?.driversOnDutySnapshot ?? []).map((driver) => (
                <div key={driver.id} className="dashboard-queue-item">
                  <div>
                    <strong>{driver.title}</strong>
                    <p>{driver.subtitle}</p>
                    <small>{driver.note}</small>
                  </div>
                  <Link className="dashboard-queue-item__status tone-mint" to={driver.actionPath}>
                    {driver.status}
                  </Link>
                </div>
              ))
            ) : (
              <p className="muted">No drivers on duty were found in the current snapshot.</p>
            )}
          </div>
        </SectionCard>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Control links</span>
            <h2 className="dashboard-section__title">Fast navigation</h2>
          </div>
        </div>
        <div className="dashboard-link-grid">
          <Link className="dashboard-link-card" to="/trips">
            <strong>Trips</strong>
            <p>Plan, validate, optimize, and dispatch lifecycle work.</p>
          </Link>
          <Link className="dashboard-link-card" to="/alerts">
            <strong>Alerts Center</strong>
            <p>Review open, acknowledged, and resolved alerts.</p>
          </Link>
          <Link className="dashboard-link-card" to="/maintenance">
            <strong>Maintenance</strong>
            <p>Review service and blocking schedules.</p>
          </Link>
          <Link className="dashboard-link-card" to="/vehicles">
            <strong>Vehicles</strong>
            <p>Monitor readiness, fuel, and tracking state.</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
