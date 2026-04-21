import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/useAuth'
import { fetchDriverAnalytics, fetchDriverPerformance, fetchTripAnalytics, fetchVehicleAnalytics } from '../services/apiService'
import type { DriverAnalytics, DriverPerformanceDashboard, TripAnalytics, TripStatus, VehicleAnalytics } from '../types'

const defaultStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
const defaultEnd = new Date().toISOString().slice(0, 16)

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'All time'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function toneClass(tone: string) {
  return `dashboard-summary-card tone-${tone}`
}

function statusClass(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'status-pill status-pill--mint'
    case 'DISPATCHED':
    case 'IN_PROGRESS':
      return 'status-pill status-pill--blue'
    case 'BLOCKED':
      return 'status-pill status-pill--rose'
    default:
      return 'status-pill status-pill--amber'
  }
}

function chartLabel(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0]
  }

  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`
}

function formatDecimal(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0'
}

export function AnalyticsReports() {
  const { session } = useAuth()
  const [tripAnalytics, setTripAnalytics] = useState<TripAnalytics | null>(null)
  const [vehicleAnalytics, setVehicleAnalytics] = useState<VehicleAnalytics | null>(null)
  const [driverAnalytics, setDriverAnalytics] = useState<DriverAnalytics | null>(null)
  const [driverPerformance, setDriverPerformance] = useState<DriverPerformanceDashboard | null>(null)
  const [reportError, setReportError] = useState('')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [statusFilter, setStatusFilter] = useState<'ALL' | TripStatus>('ALL')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const isDriverView = session?.profile.role === 'DRIVER'

  const loadReports = useCallback(async (filters: { startDate: string; endDate: string; statusFilter: 'ALL' | TripStatus }) => {
    setLoading(true)
    setReportError('')

    const requestFilters = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: filters.statusFilter === 'ALL' ? undefined : filters.statusFilter,
    }

    const errors: string[] = []

    if (isDriverView) {
      const [driverPerformanceResult] = await Promise.allSettled([
        fetchDriverPerformance(requestFilters),
      ] as const)

      setTripAnalytics(null)
      setVehicleAnalytics(null)
      setDriverAnalytics(null)

      if (driverPerformanceResult.status === 'fulfilled') {
        setDriverPerformance(driverPerformanceResult.value)
      } else {
        setDriverPerformance(null)
        const message = driverPerformanceResult.reason instanceof Error ? driverPerformanceResult.reason.message : 'Unable to load driver performance.'
        errors.push(`driver performance: ${message}`)
      }
    } else {
      const [tripResult, vehicleResult, driverResult, driverPerformanceResult] = await Promise.allSettled([
        fetchTripAnalytics(requestFilters),
        fetchVehicleAnalytics(requestFilters),
        fetchDriverAnalytics(requestFilters),
        fetchDriverPerformance(requestFilters),
      ] as const)

      if (tripResult.status === 'fulfilled') {
        setTripAnalytics(tripResult.value)
      } else {
        setTripAnalytics(null)
        const message = tripResult.reason instanceof Error ? tripResult.reason.message : 'Unable to load trip analytics.'
        errors.push(`trip analytics: ${message}`)
      }

      if (vehicleResult.status === 'fulfilled') {
        setVehicleAnalytics(vehicleResult.value)
      } else {
        setVehicleAnalytics(null)
        const message = vehicleResult.reason instanceof Error ? vehicleResult.reason.message : 'Unable to load vehicle analytics.'
        errors.push(`vehicle analytics: ${message}`)
      }

      if (driverResult.status === 'fulfilled') {
        setDriverAnalytics(driverResult.value)
      } else {
        setDriverAnalytics(null)
        const message = driverResult.reason instanceof Error ? driverResult.reason.message : 'Unable to load driver analytics.'
        errors.push(`driver analytics: ${message}`)
      }

      if (driverPerformanceResult.status === 'fulfilled') {
        setDriverPerformance(driverPerformanceResult.value)
      } else {
        setDriverPerformance(null)
        const message = driverPerformanceResult.reason instanceof Error ? driverPerformanceResult.reason.message : 'Unable to load driver performance.'
        errors.push(`driver performance: ${message}`)
      }
    }

    if (errors.length) {
      console.error('Failed to load analytics reports', errors)
      setReportError(`Some analytics sections could not be loaded. ${errors.join(' ')}`)
    }

    setLoading(false)
    setWorking(false)
  }, [isDriverView])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports({ startDate: defaultStart, endDate: defaultEnd, statusFilter: 'ALL' })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadReports])

  const selectedRange = useMemo(
    () => `${formatDateTime(startDate)} - ${formatDateTime(endDate)}`,
    [startDate, endDate],
  )

  const driverPerformanceChartData = useMemo(
    () => (driverPerformance?.drivers ?? []).map((driver) => ({
      ...driver,
      shortName: chartLabel(driver.name),
    })),
    [driverPerformance],
  )

  const featuredDrivers = useMemo(
    () => driverPerformance?.drivers.slice(0, 6) ?? [],
    [driverPerformance],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    await loadReports({ startDate, endDate, statusFilter })
  }

  return (
    <div className="page-shell analytics-page">
      <div className="page-top-actions">
        <button className="secondary-button" disabled={loading || working} onClick={() => { setWorking(true); void loadReports({ startDate, endDate, statusFilter }); }} type="button">
          Refresh reports
        </button>
      </div>

      <section className="analytics-filter-container">
        <form className="analytics-filter" onSubmit={handleSubmit}>
          <label>
            <span>Start date</span>
            <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="datetime-local" />
          </label>
          <label>
            <span>End date</span>
            <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="datetime-local" />
          </label>
          <label>
            <span>Trip status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | TripStatus)}>
              <option value="ALL">All</option>
              <option value="DRAFT">Draft</option>
              <option value="VALIDATED">Validated</option>
              <option value="OPTIMIZED">Optimized</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </label>
          <div className="analytics-filter__actions">
            <span className="badge">{selectedRange}</span>
            <button className="primary-button analytics-filter__submit" disabled={loading || working} type="submit">
              Apply filters
            </button>
          </div>
        </form>
      </section>
      {reportError ? <div className="form-error">{reportError}</div> : null}

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Driver performance dashboard</span>
            <h2 className="dashboard-section__title">Punctuality, safety, and speed signals</h2>
          </div>
          <span className="dashboard-section__counter">{driverPerformance?.drivers.length ?? 0} drivers</span>
        </div>
        <div className="dashboard-summary-grid">
          {(driverPerformance?.kpis ?? []).map((kpi) => (
            <article key={kpi.key} className={toneClass(kpi.tone)}>
              <span className="dashboard-summary-card__label">{kpi.label}</span>
              <strong className="dashboard-summary-card__value">{kpi.value}</strong>
              <p className="dashboard-summary-card__note">{kpi.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
        <div className="driver-performance-visual-grid">
          <article className="panel--flat driver-performance-chart-panel">
            <div className="dashboard-card-header">
              <div>
                <span className="dashboard-card-header__eyebrow">Completed trips</span>
                <h3>Driver output</h3>
              </div>
              <span className="badge">{driverPerformance?.totalCompletedTrips ?? 0} completed</span>
            </div>
            {driverPerformanceChartData.length ? (
              <div className="driver-performance-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={driverPerformanceChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                    <XAxis dataKey="shortName" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
                    <Bar dataKey="tripsCompleted" name="Trips completed" fill="#2563eb" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="muted">No driver performance data is available for the selected period.</p>
            )}
          </article>

          <article className="panel--flat driver-performance-chart-panel">
            <div className="dashboard-card-header">
              <div>
                <span className="dashboard-card-header__eyebrow">Quality mix</span>
                <h3>On-time, safety, and speed</h3>
              </div>
              <span className="badge">{formatDecimal(driverPerformance?.averageSafetyScore ?? 0)} safety avg</span>
            </div>
            {driverPerformanceChartData.length ? (
              <div className="driver-performance-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={driverPerformanceChartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                    <XAxis dataKey="shortName" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#64748b" tickLine={false} axisLine={false} domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="onTimePercent" name="On-time %" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="left" type="monotone" dataKey="safetyScore" name="Safety score" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" dataKey="averageSpeedKph" name="Avg speed km/h" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="muted">Performance trend lines will appear once driver data is available.</p>
            )}
          </article>
        </div>
        <div className="trip-compliance-grid">
          {featuredDrivers.map((driver) => (
            <article key={driver.driverId} className="trip-compliance-card driver-performance-card">
              <div className="driver-performance-card__header">
                <div>
                  <span>{driver.driverId}</span>
                  <strong>{driver.name}</strong>
                  <p>
                    {driver.licenseType} {'|'} {driver.status}
                  </p>
                </div>
                <span className="badge">{driver.assignedVehicleId ?? 'Unassigned'}</span>
              </div>
              <small>{driver.note}</small>
              <div className="driver-performance-metrics">
                <article>
                  <span>On-time</span>
                  <strong>{formatDecimal(driver.onTimePercent)}%</strong>
                </article>
                <article>
                  <span>Trips completed</span>
                  <strong>{driver.tripsCompleted}</strong>
                </article>
                <article>
                  <span>Safety score</span>
                  <strong>{formatDecimal(driver.safetyScore)}</strong>
                </article>
                <article>
                  <span>Avg speed</span>
                  <strong>{formatDecimal(driver.averageSpeedKph)} km/h</strong>
                </article>
              </div>
            </article>
          ))}
        </div>
      </section>

      {!isDriverView ? (
        <>
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Trip analytics</span>
            <h2 className="dashboard-section__title">Lifecycle performance</h2>
          </div>
          <span className="dashboard-section__counter">{tripAnalytics?.recentTrips.length ?? 0} trip rows</span>
        </div>
        <div className="dashboard-summary-grid">
          {(tripAnalytics?.kpis ?? []).map((kpi) => (
            <article key={kpi.key} className={toneClass(kpi.tone)}>
              <span className="dashboard-summary-card__label">{kpi.label}</span>
              <strong className="dashboard-summary-card__value">{kpi.value}</strong>
              <p className="dashboard-summary-card__note">{kpi.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-control-grid">
        <article className="dashboard-panel--flat">
          <div className="dashboard-card-header">
            <div>
              <span className="dashboard-card-header__eyebrow">Delay trends</span>
              <h3>Late trip buckets</h3>
            </div>
          </div>
          <div className="dashboard-queue-list">
            {(tripAnalytics?.delayTrends ?? []).length ? (
              tripAnalytics!.delayTrends.map((item) => (
                <div key={item.label} className="dashboard-queue-item">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.note}</p>
                  </div>
                  <span className="dashboard-queue-item__status tone-rose">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="muted">No delay data in the selected period.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel--flat">
          <div className="dashboard-card-header">
            <div>
              <span className="dashboard-card-header__eyebrow">Alert frequency</span>
              <h3>Alerts by category</h3>
            </div>
          </div>
          <div className="dashboard-queue-list">
            {(tripAnalytics?.alertFrequencyByCategory ?? []).length ? (
              tripAnalytics!.alertFrequencyByCategory.map((item) => (
                <div key={item.label} className="dashboard-queue-item">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.note}</p>
                  </div>
                  <span className="dashboard-queue-item__status tone-amber">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="muted">No alert activity was found for the selected period.</p>
            )}
          </div>
        </article>
      </section>

      <section className="table-container--flat">
        <div className="panel__header">
          <div>
            <h3>Recent trip rows</h3>
            <p className="muted">Completed and in-flight trips returned directly from persisted records.</p>
          </div>
        </div>
        <div className="trip-table">
          <div className="trip-table__head">
            <span>Trip</span>
            <span>Status</span>
            <span>Distance / delay</span>
            <span>Fuel</span>
            <span>Completion</span>
          </div>
          {(tripAnalytics?.recentTrips ?? []).map((trip) => (
            <div key={trip.tripId} className="trip-table__row trip-table__row--static">
              <span>
                <strong>{trip.tripId}</strong>
                <small>
                  {trip.routeId} {'->'} {trip.vehicleId}
                </small>
              </span>
              <span className={statusClass(trip.status)}>{trip.status}</span>
              <span>
                <strong>{trip.actualDistance} km</strong>
                <small>{trip.delayMinutes ?? 0} min delay</small>
              </span>
              <span>
                <strong>{trip.fuelUsed == null ? 'N/A' : trip.fuelUsed.toFixed(1)}</strong>
                <small>Fuel units used</small>
              </span>
              <span>
                <strong>{formatDateTime(trip.completionProcessedAt ?? trip.actualEndTime)}</strong>
                <small>{formatDateTime(trip.plannedEndTime)}</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Vehicle analytics</span>
            <h2 className="dashboard-section__title">Utilization and maintenance</h2>
          </div>
          <span className="dashboard-section__counter">{vehicleAnalytics?.utilizationByVehicle.length ?? 0} vehicles</span>
        </div>
        <div className="dashboard-summary-grid">
          {(vehicleAnalytics?.kpis ?? []).map((kpi) => (
            <article key={kpi.key} className={toneClass(kpi.tone)}>
              <span className="dashboard-summary-card__label">{kpi.label}</span>
              <strong className="dashboard-summary-card__value">{kpi.value}</strong>
              <p className="dashboard-summary-card__note">{kpi.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
        <div className="trip-compliance-grid">
          {(vehicleAnalytics?.utilizationByVehicle ?? []).map((vehicle) => (
            <article key={vehicle.vehicleId} className="trip-compliance-card">
              <span>{vehicle.vehicleId}</span>
              <strong>{vehicle.name}</strong>
              <p>{vehicle.location}</p>
              <small>{vehicle.note}</small>
              <div className="trip-detail__stats">
                <article>
                  <span>Utilization</span>
                  <strong>{vehicle.utilizationPercent}%</strong>
                </article>
                <article>
                  <span>Trips</span>
                  <strong>{vehicle.totalTrips}</strong>
                </article>
                <article>
                  <span>Maintenance</span>
                  <strong>{vehicle.maintenanceDue ? 'Due' : 'Clear'}</strong>
                </article>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Driver analytics</span>
            <h2 className="dashboard-section__title">Productivity and duty load</h2>
          </div>
          <span className="dashboard-section__counter">{driverAnalytics?.productivityByDriver.length ?? 0} drivers</span>
        </div>
        <div className="dashboard-summary-grid">
          {(driverAnalytics?.kpis ?? []).map((kpi) => (
            <article key={kpi.key} className={toneClass(kpi.tone)}>
              <span className="dashboard-summary-card__label">{kpi.label}</span>
              <strong className="dashboard-summary-card__value">{kpi.value}</strong>
              <p className="dashboard-summary-card__note">{kpi.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
        <div className="trip-compliance-grid">
          {(driverAnalytics?.productivityByDriver ?? []).map((driver) => (
            <article key={driver.driverId} className="trip-compliance-card">
              <span>{driver.driverId}</span>
              <strong>{driver.name}</strong>
              <p>
                {driver.licenseType} {'|'} {driver.status}
              </p>
              <small>{driver.note}</small>
              <div className="trip-detail__stats">
                <article>
                  <span>Productivity</span>
                  <strong>{driver.productivityPercent}%</strong>
                </article>
                <article>
                  <span>Trips</span>
                  <strong>{driver.totalTrips}</strong>
                </article>
                <article>
                  <span>Hours</span>
                  <strong>{driver.hoursDrivenToday.toFixed(1)}</strong>
                </article>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-control-grid">
        <article className="dashboard-panel--flat">
          <div className="dashboard-card-header">
            <div>
              <span className="dashboard-card-header__eyebrow">Maintenance trends</span>
              <h3>Schedules by status</h3>
            </div>
          </div>
          <div className="dashboard-queue-list">
            {(vehicleAnalytics?.maintenanceTrends ?? []).length ? (
              vehicleAnalytics!.maintenanceTrends.map((item) => (
                <div key={item.label} className="dashboard-queue-item">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.note}</p>
                  </div>
                  <span className="dashboard-queue-item__status tone-violet">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="muted">No maintenance activity in the selected period.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel--flat">
          <div className="dashboard-card-header">
            <div>
              <span className="dashboard-card-header__eyebrow">Driver duty mix</span>
              <h3>Status distribution</h3>
            </div>
          </div>
          <div className="dashboard-queue-list">
            {(driverAnalytics?.dutyTrend ?? []).length ? (
              driverAnalytics!.dutyTrend.map((item) => (
                <div key={item.label} className="dashboard-queue-item">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.note}</p>
                  </div>
                  <span className="dashboard-queue-item__status tone-mint">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="muted">No driver status data in the selected period.</p>
            )}
          </div>
        </article>
      </section>
        </>
      ) : null}
    </div>
  )
}
