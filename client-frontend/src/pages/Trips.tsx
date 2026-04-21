import { useEffect, useMemo, useState } from 'react'
import { MapView } from '../components/MapView'
import { useAuth } from '../context/useAuth'
import { canManageTrips, canOperateTripExecution } from '../security/permissions'
import {
  completeTrip,
  dispatchTrip,
  fetchAlerts,
  fetchDrivers,
  fetchComplianceCheck,
  fetchRoutePlans,
  fetchTripTelemetry,
  fetchTrips,
  fetchVehicles,
  optimizeTrip,
  pauseTrip,
  resumeTrip,
  startTrip,
  validateTrip,
} from '../services/apiService'
import { useTripStore } from '../store/useTripStore'
import { useTripWebSocket } from '../hooks/useTripWebSocket'
import type {

  Alert,
  CompleteTripInput,
  ComplianceCheckResult,
  Trip,
  TripPriority,
  TripTelemetryPoint,
} from '../types'


const initialCompletionForm: CompleteTripInput = {
  actualEndTime: new Date().toISOString().slice(0, 16),
  actualDistance: 0,
  fuelUsed: undefined,
  actualDuration: '',
  remarks: '',
}

function statusClass(status: Trip['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'dd-pill dd-pill--green'
    case 'DISPATCHED':
    case 'IN_PROGRESS':
      return 'dd-pill dd-pill--blue'
    case 'PAUSED':
      return 'dd-pill dd-pill--amber'
    case 'VALIDATED':
    case 'OPTIMIZED':
      return 'dd-pill dd-pill--violet'
    case 'BLOCKED':
      return 'dd-pill dd-pill--red'
    default:
      return 'dd-pill dd-pill--amber'
  }
}

function priorityTone(priority: TripPriority) {
  switch (priority) {
    case 'CRITICAL':
      return 'dd-pill dd-pill--red'
    case 'HIGH':
      return 'dd-pill dd-pill--amber'
    case 'MEDIUM':
      return 'dd-pill dd-pill--blue'
    default:
      return 'dd-pill dd-pill--green'
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function buildCompletionForm(trip?: Trip | null): CompleteTripInput {
  return {
    actualEndTime: new Date().toISOString().slice(0, 16),
    actualDistance: trip?.actualDistance || trip?.estimatedDistance || 0,
    fuelUsed: trip?.fuelUsed ?? undefined,
    actualDuration: trip?.actualDuration ?? trip?.estimatedDuration ?? '',
    remarks: trip?.remarks ?? '',
  }
}

/* ── Determine active stop index from trip status ── */
function getActiveStopIndex(trip: Trip): number {
  if (trip.status === 'COMPLETED') return trip.stops.length - 1
  if (trip.status === 'IN_PROGRESS' || trip.status === 'PAUSED') return Math.min(1, trip.stops.length - 1)
  if (trip.status === 'DISPATCHED') return 0
  return -1
}

interface ChecklistState {
  pickupCompleted: boolean
  documentsVerified: boolean
  deliveryCompleted: boolean
}

/* ── Persist checklist per trip in localStorage ── */
const CHECKLIST_STORAGE_KEY = 'fleet:trip-checklists'

function loadChecklist(tripId: string): ChecklistState {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY)
    if (!raw) return { pickupCompleted: false, documentsVerified: false, deliveryCompleted: false }
    const all = JSON.parse(raw) as Record<string, ChecklistState>
    return all[tripId] ?? { pickupCompleted: false, documentsVerified: false, deliveryCompleted: false }
  } catch {
    return { pickupCompleted: false, documentsVerified: false, deliveryCompleted: false }
  }
}

function saveChecklist(tripId: string, state: ChecklistState) {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, ChecklistState>) : {}
    all[tripId] = state
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(all))
  } catch { /* ignore storage errors */ }
}

export function Trips() {
  const { session } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<TripTelemetryPoint[]>([])
  const [complianceCheck, setComplianceCheck] = useState<ComplianceCheckResult | null>(null)
  const [systemAlerts, setSystemAlerts] = useState<Alert[]>([])
  const [completionForm, setCompletionForm] = useState<CompleteTripInput>(initialCompletionForm)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<ChecklistState>({
    pickupCompleted: false,
    documentsVerified: false,
    deliveryCompleted: false,
  })

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.tripId === selectedTripId) ?? trips[0] ?? null,
    [selectedTripId, trips],
  )

  async function loadBoard() {
    setLoading(true)
    setMessage(null)
    const role = session?.profile.role
    try {
      // Drivers and other limited roles might not have access to all these resources.
      // We only fetch what is permitted based on role.
      const canViewAll = role === 'ADMIN' || role === 'OPERATIONS_MANAGER' || role === 'DISPATCHER' || role === 'PLANNER'
      
      const fetchList: Promise<Trip[] | Awaited<ReturnType<typeof fetchVehicles> | ReturnType<typeof fetchDrivers> | ReturnType<typeof fetchRoutePlans>>>[] = [fetchTrips()]
      if (canViewAll) {
        fetchList.push(fetchVehicles(), fetchDrivers(), fetchRoutePlans())
      }

      const results = await Promise.all(fetchList)
      const tripData = results[0] as Trip[]
      
      setTrips(tripData)

      setSelectedTripId((current) => current ?? tripData[0]?.tripId ?? null)

    } catch (error: unknown) {
      console.error('Failed to load operational data:', error)
      const errorMsg = (error instanceof Error && error.message.includes('403'))
        ? 'Access restricted. Some data could not be loaded.'
        : (error instanceof Error ? error.message : 'Unable to load trip board.')
      setMessage(errorMsg)
    } finally {
      setLoading(false)
    }
  }


  async function loadTelemetry(tripId?: string | null) {
    if (!tripId) { setTelemetry([]); setComplianceCheck(null); setSystemAlerts([]); return }
    try {
      const [telemetryResult, complianceResult, alertsResult] = await Promise.allSettled([
        fetchTripTelemetry(tripId),
        fetchComplianceCheck(tripId),
        fetchAlerts(),
      ])
      setTelemetry(telemetryResult.status === 'fulfilled' ? telemetryResult.value : [])
      setComplianceCheck(complianceResult.status === 'fulfilled' ? complianceResult.value : null)
      // Filter system alerts related to this trip
      if (alertsResult.status === 'fulfilled') {
        const tripAlerts = alertsResult.value.filter(
          (a) => a.relatedTripId === tripId && a.status !== 'RESOLVED' && a.status !== 'CLOSED'
        )
        setSystemAlerts(tripAlerts)
      } else {
        setSystemAlerts([])
      }
    } catch { setTelemetry([]); setComplianceCheck(null); setSystemAlerts([]) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadBoard() }, [])

  // Auto-dismiss toast messages after 5 seconds
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  useEffect(() => {
    void loadTelemetry(selectedTrip?.tripId ?? null)
    setCompletionForm(buildCompletionForm(selectedTrip))
    // Restore persisted checklist or auto-complete for finished trips
    if (selectedTrip?.status === 'COMPLETED') {
      setChecklist({ pickupCompleted: true, documentsVerified: true, deliveryCompleted: true })
    } else if (selectedTrip) {
      setChecklist(loadChecklist(selectedTrip.tripId))
    } else {
      setChecklist({ pickupCompleted: false, documentsVerified: false, deliveryCompleted: false })
    }

    // Auto-poll telemetry every 15s for active trips
    if (selectedTrip && ['IN_PROGRESS', 'PAUSED', 'DISPATCHED'].includes(selectedTrip.status)) {
      const interval = setInterval(() => { void loadTelemetry(selectedTrip.tripId) }, 15000)
      return () => clearInterval(interval)
    }
  }, [selectedTrip])

  const realTimeTelemetry = useTripStore((state) => state.telemetry)

  
  // Use our real-time hook
  useTripWebSocket(selectedTrip?.tripId)

  async function refreshBoard(nextSelectedTripId?: string | null) {
    const keepSelected = nextSelectedTripId ?? selectedTrip?.tripId ?? null
    await loadBoard()
    setSelectedTripId(keepSelected)
    // Explicitly refresh telemetry/compliance when manually refreshing
    if (keepSelected) {
      await loadTelemetry(keepSelected)
    }
    setMessage('Trip board updated')
  }




  async function handleTripAction(action: () => Promise<unknown>, successMessage: string) {
    if (!selectedTrip) return
    setWorking(true)
    setMessage(null)
    try {
      await action()
      await refreshBoard(selectedTrip.tripId)
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Trip action failed.')
    } finally { setWorking(false) }
  }

  const totalTrips = trips.length
  const activeTrips = trips.filter((t) => t.status === 'DISPATCHED' || t.status === 'IN_PROGRESS' || t.status === 'PAUSED').length
  const blockedTrips = trips.filter((t) => t.status === 'BLOCKED').length
  const completedTrips = trips.filter((t) => t.status === 'COMPLETED').length
  const role = session?.profile.role
  const canPlanTrips = canManageTrips(role)
  const canExecuteTrips = canOperateTripExecution(role)
  const canValidateSelectedTrip = selectedTrip ? ['DRAFT', 'BLOCKED'].includes(selectedTrip.status) : false
  const canOptimizeSelectedTrip = selectedTrip ? ['DRAFT', 'VALIDATED', 'BLOCKED'].includes(selectedTrip.status) : false
  const canDispatchSelectedTrip = selectedTrip ? ['DRAFT', 'VALIDATED', 'OPTIMIZED', 'BLOCKED'].includes(selectedTrip.status) : false
  const canStartSelectedTrip = selectedTrip?.status === 'DISPATCHED'
  const canPauseSelectedTrip = selectedTrip?.status === 'IN_PROGRESS'
  const canResumeSelectedTrip = selectedTrip?.status === 'PAUSED'
  const canCompleteSelectedTrip = selectedTrip?.status === 'IN_PROGRESS'
  const checklistCount = Object.values(checklist).filter(Boolean).length

  // Persist checklist changes to localStorage
  function updateChecklist(key: keyof ChecklistState) {
    setChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (selectedTrip) saveChecklist(selectedTrip.tripId, next)
      return next
    })
  }

  const timelineSteps = selectedTrip
    ? [
        { label: 'Assigned', time: formatDateTime(selectedTrip.plannedStartTime), done: true },
        { label: 'Dispatched', time: selectedTrip.dispatchStatus !== 'NOT_DISPATCHED' ? 'Confirmed' : 'Pending', done: ['DISPATCHED', 'RELEASED'].includes(selectedTrip.dispatchStatus) },
        { label: 'In Transit', time: formatDateTime(selectedTrip.actualStartTime), done: ['IN_PROGRESS', 'PAUSED', 'COMPLETED'].includes(selectedTrip.status) },
        { label: 'Delivered', time: formatDateTime(selectedTrip.actualEndTime), done: selectedTrip.status === 'COMPLETED' },
      ]
    : []

  const activeStopIdx = selectedTrip ? getActiveStopIndex(selectedTrip) : -1
  const alertCount = (complianceCheck?.warnings.length ?? 0) + (complianceCheck?.blockingReasons.length ?? 0) + systemAlerts.length + ((selectedTrip && (selectedTrip.delayMinutes ?? 0) > 0) ? 1 : 0)
  const hasAlerts = alertCount > 0

  return (
    <div className="dd">
      {/* ── Stat strip (replaces duplicate title) ── */}
      <div className="dd-topbar">
        <div className="dd-stats-row">
          <div className="dd-stat"><span className="dd-stat__n" style={{ color: '#253B80' }}>{totalTrips}</span><span className="dd-stat__l">Trips</span></div>
          <div className="dd-stat"><span className="dd-stat__n" style={{ color: '#10b981' }}>{activeTrips}</span><span className="dd-stat__l">Active</span></div>
          <div className="dd-stat"><span className="dd-stat__n" style={{ color: '#ef4444' }}>{blockedTrips}</span><span className="dd-stat__l">Blocked</span></div>
          <div className="dd-stat"><span className="dd-stat__n" style={{ color: '#0ea5e9' }}>{completedTrips}</span><span className="dd-stat__l">Done</span></div>
        </div>
        <button className="dd-btn dd-btn--ghost" disabled={working || loading} onClick={() => { void refreshBoard() }} type="button">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          Refresh
        </button>
      </div>

      {message && <div className="dd-toast">{message}</div>}

      {/* ═══════ HERO — Active Trip ═══════ */}
      {selectedTrip && (
        <section className="dd-hero">
          <div className="dd-hero__top">
            <div className="dd-hero__badges">
              <span className={statusClass(selectedTrip.status)}>{selectedTrip.status.replace('_', ' ')}</span>
              <span className={priorityTone(selectedTrip.priority)}>{selectedTrip.priority}</span>
              <code className="dd-hero__code">{selectedTrip.tripId}</code>
            </div>
            <div className="dd-hero__row">
              <div className="dd-hero__route">
                <div className="dd-endpoint dd-endpoint--origin">
                  <div className="dd-endpoint__dot" />
                  <div><small>ORIGIN</small><strong>{selectedTrip.source}</strong></div>
                </div>
                <div className="dd-route-connector">
                  <div className="dd-route-connector__line" />
                  <span className="dd-route-connector__label">{selectedTrip.stops.length} stops · {selectedTrip.actualDistance || selectedTrip.estimatedDistance} km</span>
                </div>
                <div className="dd-endpoint dd-endpoint--dest">
                  <div className="dd-endpoint__dot" />
                  <div><small>DESTINATION</small><strong>{selectedTrip.destination}</strong></div>
                </div>
              </div>
              <div className="dd-hero__metrics">
                <div className="dd-metric"><small>Duration</small><strong>{selectedTrip.actualDuration ?? selectedTrip.estimatedDuration}</strong></div>
                <div className="dd-metric">
                  <small>Real-time Speed</small>
                  <strong style={{ color: 'var(--color-primary)' }}>
                    {realTimeTelemetry ? `${Math.round(realTimeTelemetry.speed)} km/h` : '—'}
                  </strong>
                </div>
                <div className="dd-metric">
                  <small>Fuel Level</small>
                  <strong style={{ color: realTimeTelemetry && realTimeTelemetry.fuel < 20 ? 'var(--color-danger)' : 'inherit' }}>
                    {realTimeTelemetry ? `${Math.round(realTimeTelemetry.fuel)}%` : '—'}
                  </strong>
                </div>
              </div>

            </div>
          </div>
          <div className="dd-hero__actions">
            {canPlanTrips && (
              <>
                <button className="dd-btn dd-btn--secondary" disabled={working || !canValidateSelectedTrip} onClick={() => void handleTripAction(() => validateTrip(selectedTrip.tripId), 'Trip validated.')} type="button">Validate</button>
                <button className="dd-btn dd-btn--secondary" disabled={working || !canOptimizeSelectedTrip} onClick={() => void handleTripAction(() => optimizeTrip(selectedTrip.tripId), 'Trip optimized.')} type="button">Optimize</button>
                <button className="dd-btn dd-btn--secondary" disabled={working || !canDispatchSelectedTrip} onClick={() => void handleTripAction(() => dispatchTrip(selectedTrip.tripId), 'Trip dispatched.')} type="button">Dispatch</button>
              </>
            )}
            {canExecuteTrips && (
              <>
                <button className="dd-btn dd-btn--primary" disabled={working || !canStartSelectedTrip} onClick={() => void handleTripAction(() => startTrip(selectedTrip.tripId), 'Trip started.')} type="button">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Start Trip
                </button>
                <button className="dd-btn dd-btn--secondary" disabled={working || !canPauseSelectedTrip} onClick={() => void handleTripAction(() => pauseTrip(selectedTrip.tripId), 'Trip paused.')} type="button">
                  Pause Trip
                </button>
                <button className="dd-btn dd-btn--primary" disabled={working || !canResumeSelectedTrip} onClick={() => void handleTripAction(() => resumeTrip(selectedTrip.tripId), 'Trip resumed.')} type="button">
                  Resume Trip
                </button>
              </>
            )}
            <button className="dd-btn dd-btn--ghost" type="button" onClick={() => window.open(`https://www.google.com/maps/dir/${encodeURIComponent(selectedTrip.source)}/${selectedTrip.stops.map(s => encodeURIComponent(s.name)).join('/')}/${encodeURIComponent(selectedTrip.destination)}`, '_blank')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              Navigate
            </button>
          </div>
        </section>
      )}

      {/* ═══════ OPERATIONAL GRID ═══════ */}
      {selectedTrip && (
        <div className="dd-grid">
          {/* LEFT — Map + Route + Telemetry */}
          <div className="dd-grid__main">
            {/* Map */}
            <div className="dd-map-wrap">
              <MapView 
                title={`${selectedTrip.tripId} route`} 
                stops={selectedTrip.stops.map(s => s.name)} 
                currentTelemetry={realTimeTelemetry}
              />
            </div>


            {/* Route step tracker */}
            <section className="dd-card">
              <div className="dd-card__head"><h4>Route</h4><span className="dd-card__sub">{selectedTrip.stops.length} stops</span></div>
              <div className="dd-route-steps">
                {selectedTrip.stops.map((stop, idx) => {
                  const isDone = selectedTrip.status === 'COMPLETED' || idx < activeStopIdx
                  const isCurrent = idx === activeStopIdx && selectedTrip.status !== 'COMPLETED'
                  return (
                    <div key={`${stop.name}-${idx}`} className={`dd-step${isDone ? ' dd-step--done' : ''}${isCurrent ? ' dd-step--active' : ''}`}>
                      <div className="dd-step__marker">
                        <div className="dd-step__dot">
                          {isDone && <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                          {isCurrent && <div className="dd-step__pulse" />}
                        </div>
                        {idx < selectedTrip.stops.length - 1 && <div className="dd-step__line" />}
                      </div>
                      <div className="dd-step__info">
                        <strong>{stop.name}</strong>

                        <small>{idx === 0 ? 'Origin' : idx === selectedTrip.stops.length - 1 ? 'Destination' : `Stop ${idx}`}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Telemetry (real data only) */}
            {telemetry.length > 0 && (
              <section className="dd-card">
                <div className="dd-card__head"><h4>Telemetry</h4><span className="dd-card__sub">Last {Math.min(telemetry.length, 4)} readings</span></div>
                <div className="dd-telem-grid">
                  {telemetry.slice(-4).map((pt, i) => (
                    <div key={`${pt.timestamp}-${i}`} className="dd-telem-item">
                      <strong>{new Date(pt.timestamp).toLocaleTimeString()}</strong>
                      <span>{Math.round(pt.speed)} km/h</span>
                      <span>Fuel {Math.round(pt.fuelLevel)}%</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT — Checklist + Timeline + Alerts */}
          <aside className="dd-grid__side">
            {/* Checklist */}
            <div className="dd-block">
              <h4 className="dd-block__title">Checklist</h4>
              {([
                { key: 'pickupCompleted' as const, label: 'Pickup completed' },
                { key: 'documentsVerified' as const, label: 'Documents verified' },
                { key: 'deliveryCompleted' as const, label: 'Delivery completed' },
              ]).map((item) => (
                <label key={item.key} className={`dd-chk${checklist[item.key] ? ' dd-chk--on' : ''}`}>
                  <div className="dd-chk__box">
                    {checklist[item.key] && <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  <input type="checkbox" hidden checked={checklist[item.key]} onChange={() => updateChecklist(item.key)} />
                  <span>{item.label}</span>
                </label>
              ))}
              <div className="dd-chk-bar">
                <div className="dd-chk-bar__track"><div className="dd-chk-bar__fill" style={{ width: `${(checklistCount / 3) * 100}%` }} /></div>
                <small>{checklistCount}/3</small>
              </div>
            </div>

            {/* Timeline */}
            <div className="dd-block">
              <h4 className="dd-block__title">Timeline</h4>
              <div className="dd-timeline">
                {timelineSteps.map((step, i) => (
                  <div key={step.label} className={`dd-tl${step.done ? ' dd-tl--done' : ''}`}>
                    <div className="dd-tl__rail">
                      <div className="dd-tl__dot" />
                      {i < timelineSteps.length - 1 && <div className="dd-tl__line" />}
                    </div>
                    <div className="dd-tl__body"><strong>{step.label}</strong><small>{step.time}</small></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts */}
            <div className="dd-block">
              <h4 className="dd-block__title">Alerts {hasAlerts && <span className="dd-block__badge">{alertCount}</span>}</h4>
              {complianceCheck?.warnings.map((w, i) => (
                <div key={`w${i}`} className="dd-notif dd-notif--warn">⚠️ {w}</div>
              ))}
              {complianceCheck?.blockingReasons.map((r, i) => (
                <div key={`b${i}`} className="dd-notif dd-notif--block">🚨 {r}</div>
              ))}
              {systemAlerts.map((alert) => (
                <div key={alert.id} className={`dd-notif dd-notif--${alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'block' : 'warn'}`}>
                  {alert.severity === 'CRITICAL' ? '🚨' : '⚠️'} {alert.title}
                </div>
              ))}
              {(selectedTrip.delayMinutes ?? 0) > 0 && (
                <div className="dd-notif dd-notif--delay">⏱️ {selectedTrip.delayMinutes} min delay</div>
              )}
              {!hasAlerts && <div className="dd-notif dd-notif--clear">✅ All clear — no issues detected</div>}
            </div>
          </aside>
        </div>
      )}

      {/* ═══════ SECONDARY ═══════ */}
      <div className="dd-lower">
        {/* Completion */}
        {selectedTrip && canExecuteTrips && (
          <section className="dd-card">
            <div className="dd-card__head"><h4>Complete Trip</h4></div>
            <form className="dd-form" onSubmit={(e) => { e.preventDefault(); void handleTripAction(() => completeTrip(selectedTrip.tripId, completionForm), 'Trip completed.') }}>
              <div className="dd-form__row">
                <label><small>End time</small><input type="datetime-local" value={completionForm.actualEndTime} onChange={(e) => setCompletionForm({ ...completionForm, actualEndTime: e.target.value })} /></label>
                <label><small>Distance (km)</small><input type="number" min="0" value={completionForm.actualDistance} onChange={(e) => setCompletionForm({ ...completionForm, actualDistance: Number(e.target.value) })} /></label>
                <label><small>Duration</small><input type="text" value={completionForm.actualDuration ?? ''} onChange={(e) => setCompletionForm({ ...completionForm, actualDuration: e.target.value })} /></label>
                <label><small>Fuel</small><input type="number" min="0" step="0.1" value={completionForm.fuelUsed ?? ''} onChange={(e) => setCompletionForm({ ...completionForm, fuelUsed: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              </div>
              <label className="dd-form__full"><small>Remarks</small><textarea rows={2} value={completionForm.remarks ?? ''} onChange={(e) => setCompletionForm({ ...completionForm, remarks: e.target.value })} /></label>
              <button className="dd-btn dd-btn--primary dd-btn--full" disabled={working || !canCompleteSelectedTrip} type="submit">
                {canCompleteSelectedTrip ? 'Complete Trip' : 'Trip must be in progress'}
              </button>
            </form>
          </section>
        )}

        {/* All Trips */}
        <section className="dd-card">
          <div className="dd-card__head"><h4>All Trips</h4><span className="dd-card__count">{trips.length}</span></div>
          <div className="dd-tbl">
            <div className="dd-tbl__head"><span>Trip</span><span>Status</span><span>Vehicle / Driver</span><span>Window</span><span>Distance</span></div>
            {trips.map((trip) => (
              <button key={trip.tripId} className={`dd-tbl__row${trip.tripId === selectedTrip?.tripId ? ' dd-tbl__row--sel' : ''}`} onClick={() => setSelectedTripId(trip.tripId)} type="button">
                <span><strong>{trip.tripId}</strong><small>{trip.source} → {trip.destination}</small></span>
                <span><span className={statusClass(trip.status)}>{trip.status.replace('_', ' ')}</span></span>
                <span><strong>{trip.assignedVehicleId}</strong><small>{trip.assignedDriverId}</small></span>
                <span><strong>{formatDateTime(trip.plannedStartTime)}</strong><small>{formatDateTime(trip.plannedEndTime)}</small></span>
                <span><strong>{trip.actualDistance || trip.estimatedDistance} km</strong><small>{trip.estimatedDuration}</small></span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
