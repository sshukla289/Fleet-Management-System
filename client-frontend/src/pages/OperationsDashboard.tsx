import { useEffect, useMemo, useRef, useState } from 'react'
import { acknowledgeAlert, fetchDashboardAnalytics, fetchTripAnalytics, resolveAlert, resolveApiAssetUrl } from '../services/apiService'
import { useDriverInbox } from '../hooks/useDriverInbox'
import type { Alert, AlertSeverity, DashboardAnalytics, TripAnalytics } from '../types'

type IncidentAlert = Alert & {
  incidentKind: 'SOS' | 'ISSUE'
  lat?: number
  lng?: number
  imageUrl?: string | null
  driverId?: string | null
  tripIdFromMeta?: string | null
  vehicleIdFromMeta?: string | null
}

type IncidentHistoryStatusFilter = 'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
type IncidentHistoryKindFilter = 'ALL' | IncidentAlert['incidentKind']

function parseMetadata(metadataJson?: string | null) {
  if (!metadataJson) {
    return null
  }

  try {
    return JSON.parse(metadataJson) as Record<string, unknown>
  } catch {
    return null
  }
}

function toIncidentAlert(alert: Alert): IncidentAlert | null {
  if (alert.sourceType !== 'driver-issue' && alert.sourceType !== 'driver-sos') {
    return null
  }

  const metadata = parseMetadata(alert.metadataJson)
  const lat = typeof metadata?.lat === 'number' ? metadata.lat : undefined
  const lng = typeof metadata?.lng === 'number' ? metadata.lng : undefined
  const imageUrl = typeof metadata?.imageUrl === 'string' ? metadata.imageUrl : null
  const driverId = typeof metadata?.driverId === 'string' ? metadata.driverId : null
  const tripIdFromMeta = typeof metadata?.tripId === 'string' ? metadata.tripId : null
  const vehicleIdFromMeta = typeof metadata?.vehicleId === 'string' ? metadata.vehicleId : null

  return {
    ...alert,
    incidentKind: alert.sourceType === 'driver-sos' ? 'SOS' : 'ISSUE',
    lat,
    lng,
    imageUrl,
    driverId,
    tripIdFromMeta,
    vehicleIdFromMeta,
  }
}

function severityWeight(severity: AlertSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return 4
    case 'HIGH':
      return 3
    case 'MEDIUM':
      return 2
    default:
      return 1
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Unavailable'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function historyTimestamp(incident: IncidentAlert) {
  return incident.resolvedAt ?? incident.acknowledgedAt ?? incident.updatedAt ?? incident.createdAt
}

function matchesHistoryStatus(filter: IncidentHistoryStatusFilter, incident: IncidentAlert) {
  if (filter === 'ALL') {
    return true
  }

  if (filter === 'RESOLVED') {
    return incident.status === 'RESOLVED' || incident.status === 'CLOSED'
  }

  return incident.status === filter
}

function escapeCsvCell(value: unknown) {
  const normalized = value == null ? '' : String(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function buildIncidentHistoryCsv(incidents: IncidentAlert[]) {
  const header = [
    'incident_id',
    'kind',
    'severity',
    'status',
    'title',
    'driver_id',
    'trip_id',
    'vehicle_id',
    'created_at',
    'acknowledged_at',
    'resolved_at',
    'latitude',
    'longitude',
  ]

  const rows = incidents.map((incident) => [
    incident.id,
    incident.incidentKind,
    incident.severity,
    incident.status,
    incident.title,
    incident.driverId ?? '',
    incident.tripIdFromMeta ?? incident.relatedTripId ?? '',
    incident.vehicleIdFromMeta ?? incident.relatedVehicleId ?? '',
    incident.createdAt,
    incident.acknowledgedAt ?? '',
    incident.resolvedAt ?? '',
    incident.lat ?? '',
    incident.lng ?? '',
  ])

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n')
}

function openMap(lat?: number, lng?: number) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return
  }

  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`, '_blank', 'noopener,noreferrer')
}

async function playSosAlarm() {
  const audioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!audioContextClass) {
    return
  }

  const context = new audioContextClass()
  const now = context.currentTime
  const bursts = [0, 0.22, 0.44]

  bursts.forEach((offset, index) => {
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    oscillator.type = index === bursts.length - 1 ? 'triangle' : 'square'
    oscillator.frequency.setValueAtTime(index === bursts.length - 1 ? 520 : 760, now + offset)
    gainNode.gain.setValueAtTime(0.0001, now + offset)
    gainNode.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start(now + offset)
    oscillator.stop(now + offset + 0.2)
  })

  window.setTimeout(() => {
    void context.close().catch(() => undefined)
  }, 1000)
}

export function OperationsDashboard() {
  const [dashData, setDashData] = useState<DashboardAnalytics | null>(null)
  const [tripStats, setTripStats] = useState<TripAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [workingIncidentId, setWorkingIncidentId] = useState<string | null>(null)
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [activeSosBanner, setActiveSosBanner] = useState<IncidentAlert | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<IncidentHistoryStatusFilter>('ALL')
  const [historyKindFilter, setHistoryKindFilter] = useState<IncidentHistoryKindFilter>('ALL')
  const [historyQuery, setHistoryQuery] = useState('')
  const {
    alerts,
    error: inboxError,
    refresh,
    replaceAlert,
    connectionState,
    lastSyncedAt,
    realtimeEnabled,
  } = useDriverInbox()
  const initializedIncidentIdsRef = useRef<Set<string>>(new Set())

  async function loadAnalytics() {
    setLoading(true)
    try {
      const [dash, trip] = await Promise.all([
        fetchDashboardAnalytics(),
        fetchTripAnalytics(),
      ])
      setDashData(dash)
      setTripStats(trip)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalytics()
  }, [])

  useEffect(() => {
    if (!message && !inboxError) {
      return undefined
    }

    const timeout = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [inboxError, message])

  const highPriorityAlerts = useMemo(() => {
    return alerts
      .filter((alert) => alert.severity === 'CRITICAL' || alert.severity === 'HIGH')
      .sort((left, right) => {
        const severityGap = severityWeight(right.severity) - severityWeight(left.severity)
        if (severityGap !== 0) {
          return severityGap
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
  }, [alerts])

  const incidents = useMemo(() => {
    return alerts
      .map(toIncidentAlert)
      .filter((alert): alert is IncidentAlert => alert !== null)
      .sort((left, right) => {
        const severityGap = severityWeight(right.severity) - severityWeight(left.severity)
        if (severityGap !== 0) {
          return severityGap
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
  }, [alerts])

  const filteredIncidentHistory = useMemo(() => {
    const normalizedQuery = historyQuery.trim().toLowerCase()

    return incidents.filter((incident) => {
      if (historyKindFilter !== 'ALL' && incident.incidentKind !== historyKindFilter) {
        return false
      }

      if (!matchesHistoryStatus(historyStatusFilter, incident)) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        incident.id,
        incident.title,
        incident.description,
        incident.driverId,
        incident.tripIdFromMeta,
        incident.relatedTripId,
        incident.vehicleIdFromMeta,
        incident.relatedVehicleId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [historyKindFilter, historyQuery, historyStatusFilter, incidents])

  const openIncidentCount = incidents.filter((incident) => incident.status === 'OPEN').length
  const acknowledgedIncidentCount = incidents.filter((incident) => incident.status === 'ACKNOWLEDGED').length
  const resolvedIncidentCount = incidents.filter((incident) => incident.status === 'RESOLVED' || incident.status === 'CLOSED').length

  useEffect(() => {
    if (!incidents.length) {
      setSelectedIncidentId(null)
      return
    }

    if (!selectedIncidentId || !incidents.some((incident) => incident.id === selectedIncidentId)) {
      setSelectedIncidentId(incidents[0].id)
    }
  }, [incidents, selectedIncidentId])

  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId) ?? incidents[0] ?? null

  useEffect(() => {
    const currentIds = new Set(incidents.map((incident) => incident.id))

    if (initializedIncidentIdsRef.current.size === 0) {
      initializedIncidentIdsRef.current = currentIds
      return
    }

    const newlyArrivedSos = incidents.filter(
      (incident) => incident.incidentKind === 'SOS'
        && incident.status === 'OPEN'
        && !initializedIncidentIdsRef.current.has(incident.id),
    )

    if (newlyArrivedSos.length > 0) {
      const latest = newlyArrivedSos[0]
      setActiveSosBanner(latest)
      setSelectedIncidentId(latest.id)
      if (soundEnabled) {
        void playSosAlarm().catch(() => undefined)
      }
    }

    initializedIncidentIdsRef.current = currentIds
  }, [incidents, soundEnabled])

  async function handleIncidentAction(id: string, action: 'acknowledge' | 'resolve') {
    setWorkingIncidentId(id)
    try {
      const updated = action === 'acknowledge'
        ? await acknowledgeAlert(id)
        : await resolveAlert(id)
      replaceAlert(updated)
      setMessage(`Incident ${action === 'acknowledge' ? 'acknowledged' : 'resolved'} successfully.`)
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'Unable to update incident status.')
    } finally {
      setWorkingIncidentId(null)
    }
  }

  function handleExportIncidentHistory() {
    if (!filteredIncidentHistory.length) {
      setMessage('No incidents match the current history filters.')
      return
    }

    const csv = buildIncidentHistoryCsv(filteredIncidentHistory)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    link.href = url
    link.download = `ops-incident-history-${stamp}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    setMessage(`Exported ${filteredIncidentHistory.length} incident record${filteredIncidentHistory.length === 1 ? '' : 's'}.`)
  }

  if (loading) {
    return <div className="dd-loading">Assembling operations intelligence...</div>
  }

  return (
    <div className="dd">
      {(message || inboxError) && <div className="dd-toast">{inboxError ?? message}</div>}
      {activeSosBanner && (
        <section className="ops-sos-banner" role="alert" aria-live="assertive">
          <div className="ops-sos-banner__pulse" aria-hidden="true" />
          <div className="ops-sos-banner__content">
            <span className="ops-sos-banner__eyebrow">Live SOS escalation</span>
            <strong>{activeSosBanner.title}</strong>
            <p>
              Driver {activeSosBanner.driverId ?? 'unknown'} triggered SOS on trip {activeSosBanner.tripIdFromMeta ?? activeSosBanner.relatedTripId ?? 'unavailable'}.
            </p>
          </div>
          <div className="ops-sos-banner__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => openMap(activeSosBanner.lat, activeSosBanner.lng)}
              disabled={typeof activeSosBanner.lat !== 'number' || typeof activeSosBanner.lng !== 'number'}
            >
              Open map
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSoundEnabled((current) => !current)}
            >
              {soundEnabled ? 'Mute alarm' : 'Enable sound'}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setActiveSosBanner(null)}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      <section className="dd-topbar">
        <div className="dd-stats-row">
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#253B80' }}>{dashData?.activeTrips ?? 0}</span>
            <span className="dd-stat__l">Active Trips</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#ef4444' }}>{dashData?.delayedTrips ?? 0}</span>
            <span className="dd-stat__l">Delayed Trips</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#991b1b' }}>{incidents.length}</span>
            <span className="dd-stat__l">Driver Incidents</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#7c3aed' }}>{tripStats?.fuelEfficiencyKmPerFuelUnit.toFixed(1) ?? 0}</span>
            <span className="dd-stat__l">km/Fuel Unit</span>
          </div>
        </div>
      </section>

      <section className="ops-incident-panel">
        <div className="ops-incident-panel__header">
          <div>
            <p className="dashboard-card-header__eyebrow">Driver Incidents</p>
            <h2>Live issue and SOS command view</h2>
            <p className="muted">Emergency items stay pinned here with trip context, location jump, and photo evidence when available.</p>
          </div>
          <div className="ops-incident-panel__status">
            <span className={`driver-inbox-live-pill driver-inbox-live-pill--${connectionState}`}>
              {realtimeEnabled ? `Live ${connectionState}` : 'Snapshot mode'}
            </span>
            {lastSyncedAt ? (
              <span className="driver-inbox-meta">
                Synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
            <button className="secondary-button" onClick={() => { void refresh(); }} type="button">
              Refresh incidents
            </button>
          </div>
        </div>

        <div className="ops-incident-panel__grid">
          <div className="ops-incident-list">
            {incidents.length ? incidents.map((incident) => {
              const active = incident.id === selectedIncident?.id
              return (
                <button
                  key={incident.id}
                  type="button"
                  className={`ops-incident-card ops-incident-card--${incident.severity.toLowerCase()}${active ? ' ops-incident-card--active' : ''}`}
                  onClick={() => setSelectedIncidentId(incident.id)}
                >
                  <div className="ops-incident-card__top">
                    <span className={`status-pill ${incident.incidentKind === 'SOS' ? 'status-pill--rose' : 'status-pill--amber'}`}>
                      {incident.incidentKind}
                    </span>
                    <span className={`status-pill ${incident.severity === 'CRITICAL' ? 'status-pill--rose' : incident.severity === 'HIGH' ? 'status-pill--amber' : 'status-pill--blue'}`}>
                      {incident.severity}
                    </span>
                  </div>
                  <strong>{incident.title}</strong>
                  <p>{incident.description}</p>
                  <div className="ops-incident-card__meta">
                    <span>{incident.driverId ?? 'Driver unknown'}</span>
                    <span>{incident.tripIdFromMeta ?? incident.relatedTripId ?? 'No trip'}</span>
                    <span>{formatDateTime(incident.createdAt)}</span>
                  </div>
                </button>
              )
            }) : (
              <div className="ops-incident-empty">
                <strong>No driver incidents right now</strong>
                <p>The panel will light up here as soon as a driver reports an issue or sends SOS.</p>
              </div>
            )}
          </div>

          <div className="ops-incident-detail">
            {selectedIncident ? (
              <>
                <div className="ops-incident-detail__hero">
                  <div>
                    <div className="ops-incident-detail__chips">
                      <span className={`status-pill ${selectedIncident.incidentKind === 'SOS' ? 'status-pill--rose' : 'status-pill--amber'}`}>
                        {selectedIncident.incidentKind}
                      </span>
                      <span className={`status-pill ${selectedIncident.status === 'OPEN' ? 'status-pill--rose' : selectedIncident.status === 'ACKNOWLEDGED' ? 'status-pill--violet' : 'status-pill--mint'}`}>
                        {selectedIncident.status}
                      </span>
                    </div>
                    <h3>{selectedIncident.title}</h3>
                    <p className="muted">{selectedIncident.description}</p>
                  </div>

                  <div className="ops-incident-detail__actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={workingIncidentId === selectedIncident.id || selectedIncident.status !== 'OPEN'}
                      onClick={() => { void handleIncidentAction(selectedIncident.id, 'acknowledge'); }}
                    >
                      {workingIncidentId === selectedIncident.id ? 'Working...' : 'Acknowledge'}
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={workingIncidentId === selectedIncident.id || (selectedIncident.status !== 'OPEN' && selectedIncident.status !== 'ACKNOWLEDGED')}
                      onClick={() => { void handleIncidentAction(selectedIncident.id, 'resolve'); }}
                    >
                      {workingIncidentId === selectedIncident.id ? 'Working...' : 'Resolve'}
                    </button>
                  </div>
                </div>

                <div className="ops-incident-detail__meta-grid">
                  <div className="ops-incident-kpi">
                    <span>Driver</span>
                    <strong>{selectedIncident.driverId ?? 'Unavailable'}</strong>
                  </div>
                  <div className="ops-incident-kpi">
                    <span>Trip</span>
                    <strong>{selectedIncident.tripIdFromMeta ?? selectedIncident.relatedTripId ?? 'Unavailable'}</strong>
                  </div>
                  <div className="ops-incident-kpi">
                    <span>Vehicle</span>
                    <strong>{selectedIncident.vehicleIdFromMeta ?? selectedIncident.relatedVehicleId ?? 'Unavailable'}</strong>
                  </div>
                  <div className="ops-incident-kpi">
                    <span>Opened</span>
                    <strong>{formatDateTime(selectedIncident.createdAt)}</strong>
                  </div>
                </div>

                <div className="ops-incident-detail__support-grid">
                  <section className="ops-incident-map-card">
                    <div className="panel__header">
                      <div>
                        <h4>Map Jump</h4>
                        <p className="muted">Open the incident coordinates directly in the map app.</p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={typeof selectedIncident.lat !== 'number' || typeof selectedIncident.lng !== 'number'}
                        onClick={() => openMap(selectedIncident.lat, selectedIncident.lng)}
                      >
                        Open map
                      </button>
                    </div>

                    <div className="ops-incident-map-card__body">
                      <strong>
                        {typeof selectedIncident.lat === 'number' && typeof selectedIncident.lng === 'number'
                          ? `${selectedIncident.lat.toFixed(5)}, ${selectedIncident.lng.toFixed(5)}`
                          : 'Location unavailable'}
                      </strong>
                      <p className="muted">
                        {selectedIncident.incidentKind === 'SOS'
                          ? 'Use this to jump straight into emergency routing and driver contact.'
                          : 'Use this location to coordinate roadside assistance or rerouting.'}
                      </p>
                    </div>
                  </section>

                  <section className="ops-incident-photo-card">
                    <div className="panel__header">
                      <div>
                        <h4>Evidence Preview</h4>
                        <p className="muted">Driver-uploaded image, if one was attached.</p>
                      </div>
                    </div>

                    {selectedIncident.imageUrl ? (
                      <div className="ops-incident-photo-card__preview">
                        <img src={resolveApiAssetUrl(selectedIncident.imageUrl)} alt={selectedIncident.title} />
                      </div>
                    ) : (
                      <div className="ops-incident-photo-card__empty">
                        <strong>No photo attached</strong>
                        <p>The driver submitted context without an image. The alert and location are still live.</p>
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="ops-incident-empty ops-incident-empty--detail">
                <strong>No incident selected</strong>
                <p>Select an incident from the left to view map, image, and response actions.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="table-container--flat ops-incident-history">
        <div className="panel__header ops-incident-history__header">
          <div>
            <h3>Incident history and export</h3>
            <p className="muted">Filter the full SOS and issue timeline, then export the current view for ops handoff or incident review.</p>
          </div>
          <button className="secondary-button" type="button" onClick={handleExportIncidentHistory}>
            Export CSV
          </button>
        </div>

        <div className="ops-incident-history__toolbar">
          <input
            className="input"
            type="search"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Search by incident, driver, trip, vehicle, or title"
          />
          <div className="trip-detail__chips">
            {(['ALL', 'SOS', 'ISSUE'] as const).map((value) => (
              <button
                key={value}
                className={`dashboard-chip${historyKindFilter === value ? ' dashboard-chip--warn' : ''}`}
                onClick={() => setHistoryKindFilter(value)}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
          <div className="trip-detail__chips">
            {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((value) => (
              <button
                key={value}
                className={`dashboard-chip${historyStatusFilter === value ? ' dashboard-chip--warn' : ''}`}
                onClick={() => setHistoryStatusFilter(value)}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="ops-incident-history__summary">
          <div className="ops-incident-history__metric">
            <span>Open</span>
            <strong>{openIncidentCount}</strong>
          </div>
          <div className="ops-incident-history__metric">
            <span>Acknowledged</span>
            <strong>{acknowledgedIncidentCount}</strong>
          </div>
          <div className="ops-incident-history__metric">
            <span>Resolved</span>
            <strong>{resolvedIncidentCount}</strong>
          </div>
          <div className="ops-incident-history__metric">
            <span>Filtered</span>
            <strong>{filteredIncidentHistory.length}</strong>
          </div>
        </div>

        {filteredIncidentHistory.length ? (
          <div className="ops-incident-history__list">
            {filteredIncidentHistory.map((incident) => {
              const active = incident.id === selectedIncident?.id
              return (
                <button
                  key={incident.id}
                  className={`ops-incident-history__item${active ? ' ops-incident-history__item--active' : ''}`}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  type="button"
                >
                  <div className="ops-incident-history__item-head">
                    <div className="ops-incident-history__chips">
                      <span className={`status-pill ${incident.incidentKind === 'SOS' ? 'status-pill--rose' : 'status-pill--amber'}`}>
                        {incident.incidentKind}
                      </span>
                      <span className={`status-pill ${incident.status === 'OPEN' ? 'status-pill--rose' : incident.status === 'ACKNOWLEDGED' ? 'status-pill--violet' : 'status-pill--mint'}`}>
                        {incident.status}
                      </span>
                    </div>
                    <span className={`status-pill ${incident.severity === 'CRITICAL' ? 'status-pill--rose' : incident.severity === 'HIGH' ? 'status-pill--amber' : 'status-pill--blue'}`}>
                      {incident.severity}
                    </span>
                  </div>
                  <strong>{incident.title}</strong>
                  <div className="ops-incident-history__meta">
                    <span>{incident.id}</span>
                    <span>{incident.driverId ?? 'Driver unknown'}</span>
                    <span>{incident.tripIdFromMeta ?? incident.relatedTripId ?? 'No trip'}</span>
                    <span>Opened {formatDateTime(incident.createdAt)}</span>
                    <span>Last activity {formatDateTime(historyTimestamp(incident))}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="muted">No incidents match the current filters.</p>
        )}
      </section>

      <div className="dd-grid" style={{ marginTop: '24px' }}>
        <div className="dd-grid__main">
          <section className="dd-card">
            <div className="dd-card__head">
              <h4>Fleet Performance Trends</h4>
              <span className="dd-pill dd-pill--blue">Last 7 Days</span>
            </div>
            <div className="dd-chart-mock" style={{ padding: '20px', height: '300px', display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
              {tripStats?.delayTrends.map((trend, index) => (
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '100%',
                      background: 'linear-gradient(to top, #253B80, #3b82f6)',
                      height: `${Math.min(trend.count * 10, 200)}px`,
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease',
                    }}
                  />
                  <small style={{ marginTop: '8px', fontSize: '10px', textAlign: 'center' }}>{trend.label.split(' ')[0]}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="dd-card" style={{ marginTop: '24px' }}>
            <div className="dd-card__head"><h4>Route Efficiency Deep-Dive</h4></div>
            <div className="dd-tbl">
              <div className="dd-tbl__head">
                <span>Trip ID</span>
                <span>Status</span>
                <span>Fuel Usage</span>
                <span>Distance</span>
                <span>Delay</span>
              </div>
              {tripStats?.recentTrips.slice(0, 10).map((trip) => (
                <div key={trip.tripId} className="dd-tbl__row">
                  <span><strong>{trip.tripId}</strong></span>
                  <span><span className={`dd-pill ${trip.status === 'COMPLETED' ? 'dd-pill--green' : 'dd-pill--blue'}`}>{trip.status}</span></span>
                  <span>{trip.fuelUsed?.toFixed(2) ?? '0.00'}</span>
                  <span>{trip.actualDistance} km</span>
                  <span style={{ color: (trip.delayMinutes ?? 0) > 30 ? '#ef4444' : 'inherit' }}>{trip.delayMinutes ?? 0}m</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="dd-grid__side">
          <div className="dd-block">
            <h4 className="dd-block__title">Critical Exceptions</h4>
            <div className="dd-alerts-list">
              {highPriorityAlerts.length > 0 ? (
                highPriorityAlerts.map((alert) => (
                  <div key={alert.id} className="dd-notif dd-notif--block" style={{ marginBottom: '12px' }}>
                    <strong>{alert.title}</strong>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>{alert.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', opacity: 0.7 }}>
                      <small>{alert.category}</small>
                      <small>{new Date(alert.createdAt).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dd-notif dd-notif--clear">All critical operations cleared</div>
              )}
            </div>
          </div>

          <div className="dd-block">
            <h4 className="dd-block__title">Fleet Health Distribution</h4>
            <div style={{ padding: '10px' }}>
              <div className="dd-health-bar" style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${dashData?.fleetReadinessPercent ?? 0}%`, background: '#059669' }} />
                <div style={{ width: `${100 - (dashData?.fleetReadinessPercent ?? 100)}%`, background: '#f59e0b' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem' }}>
                <span>Active: {dashData?.availableVehicles}</span>
                <span>In Maintenance: {dashData?.vehiclesInMaintenance}</span>
              </div>
            </div>
          </div>

          <div className="dd-block">
            <h4 className="dd-block__title">Personnel Overview</h4>
            <div className="dd-metrics-compact">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Drivers On Duty</span>
                <strong>{dashData?.driversOnDuty}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Active Shifts</span>
                <strong>{dashData?.activeTrips}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
