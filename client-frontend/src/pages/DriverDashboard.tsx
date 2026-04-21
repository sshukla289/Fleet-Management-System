import { useEffect, useState, useCallback } from 'react'

import { TripRoute } from '../components/TripRoute'
import {
  fetchTrips,
  fetchTripTelemetry,
  fetchComplianceCheck,
  fetchAlerts,
  pauseTrip,
  resumeTrip,
  startTrip,
  completeTrip,
  updateStopStatus,
} from '../services/apiService'
import type {

  TripTelemetryPoint,
  ComplianceCheckResult,
  CompleteTripInput,
  Alert,
} from '../types'
import type { StopStatus } from '../types'


import { useTripStore } from '../store/useTripStore'
import { useTripWebSocket } from '../hooks/useTripWebSocket'

interface ChecklistState {
  pickupCompleted: boolean
  documentsVerified: boolean
  deliveryCompleted: boolean
}

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
  } catch (err) {
    console.warn('LocalStorage save failed', err)
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function DriverDashboard() {
  const activeTrip = useTripStore((state) => state.activeTrip)
  const setActiveTrip = useTripStore((state) => state.setActiveTrip)
  const realTimeTelemetry = useTripStore((state) => state.telemetry)
  
  // Connect to WebSocket for the active trip
  useTripWebSocket(activeTrip?.tripId)

  const [telemetry, setTelemetry] = useState<TripTelemetryPoint[]>([])
  const [compliance, setCompliance] = useState<ComplianceCheckResult | null>(null)
  const [systemAlerts, setSystemAlerts] = useState<Alert[]>([])
  const [checklist, setChecklist] = useState<ChecklistState>({
    pickupCompleted: false,
    documentsVerified: false,
    deliveryCompleted: false,
  })
  
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)


  const refreshTripData = useCallback(async (tripId: string) => {
    try {
      const [tel, comp, al] = await Promise.allSettled([
        fetchTripTelemetry(tripId),
        fetchComplianceCheck(tripId),
        fetchAlerts()
      ])
      
      setTelemetry(tel.status === 'fulfilled' ? tel.value : [])
      setCompliance(comp.status === 'fulfilled' ? comp.value : null)
      if (al.status === 'fulfilled') {
        setSystemAlerts(al.value.filter(a => a.relatedTripId === tripId && a.status !== 'RESOLVED'))
      }
    } catch (err) {
      console.warn('Trip refresh failed', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const allTrips = await fetchTrips()
      const current = allTrips.find(t => t.status === 'IN_PROGRESS')
                   || allTrips.find(t => t.status === 'PAUSED')
                   || allTrips.find(t => t.status === 'DISPATCHED')
                   || allTrips[0] 
                   || null
      
      setActiveTrip(current)
      if (current) {
        await refreshTripData(current.tripId)
        if (current.status === 'COMPLETED') {
          setChecklist({ pickupCompleted: true, documentsVerified: true, deliveryCompleted: true })
        } else {
          setChecklist(loadChecklist(current.tripId))
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load driver data')
    } finally {
      setLoading(false)
    }
  }, [refreshTripData, setActiveTrip])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (activeTrip && (activeTrip.status === 'IN_PROGRESS' || activeTrip.status === 'PAUSED' || activeTrip.status === 'DISPATCHED')) {
      const interval = setInterval(() => {
        void refreshTripData(activeTrip.tripId)
      }, 15000)
      return () => clearInterval(interval)
    }
  }, [activeTrip, refreshTripData])

  const handleStart = async () => {
    if (!activeTrip) return
    setWorking(true)
    try {
      await startTrip(activeTrip.tripId)
      await loadData()
      setMessage('Trip started successfully')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start trip')
    } finally {
      setWorking(false)
    }
  }

  const handleStopStatusUpdate = async (sequence: number, status: StopStatus) => {
    if (!activeTrip) return
    setWorking(true)
    try {
      await updateStopStatus(activeTrip.tripId, sequence, status)
      await loadData()
      setMessage(`Stop status updated to ${status.replace('_', ' ')}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update stop status')
    } finally {
      setWorking(false)
    }
  }

  const handlePause = async () => {
    if (!activeTrip) return
    setWorking(true)
    try {
      await pauseTrip(activeTrip.tripId)
      await loadData()
      setMessage('Trip paused successfully')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to pause trip')
    } finally {
      setWorking(false)
    }
  }

  const handleResume = async () => {
    if (!activeTrip) return
    setWorking(true)
    try {
      await resumeTrip(activeTrip.tripId)
      await loadData()
      setMessage('Trip resumed successfully')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to resume trip')
    } finally {
      setWorking(false)
    }
  }

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTrip) return
    setWorking(true)
    try {
      const input: CompleteTripInput = {
        actualEndTime: new Date().toISOString(),
        actualDistance: activeTrip.actualDistance || activeTrip.estimatedDistance || 0,
        remarks: 'Completed by driver from dashboard' 
      }
      await completeTrip(activeTrip.tripId, input)
      await loadData()
      setMessage('Trip completed successfully')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to complete trip')
    } finally {
      setWorking(false)
    }
  }

  const updateChecklist = (key: keyof ChecklistState) => {
    setChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (activeTrip) saveChecklist(activeTrip.tripId, next)
      return next
    })
  }

  if (loading) {
    return <div className="dd-loading">Loading dashboard...</div>
  }

  if (!activeTrip) {
    return (
      <div className="dd-empty">
        <h3>No Active Trip</h3>
        <p>You don't have any trips assigned at the moment.</p>
        <button className="dd-btn dd-btn--ghost" onClick={() => void loadData()}>Refresh</button>
      </div>
    )
  }

  const checklistCount = Object.values(checklist).filter(Boolean).length
  const alertCount = (compliance?.warnings.length ?? 0) + (compliance?.blockingReasons.length ?? 0) + systemAlerts.length + ((activeTrip.delayMinutes ?? 0) > 0 ? 1 : 0)

  const timelineSteps = [
    { label: 'Assigned', time: formatDateTime(activeTrip.plannedStartTime), done: true },
    { label: 'Dispatched', time: activeTrip.dispatchStatus !== 'NOT_DISPATCHED' ? 'Confirmed' : 'Pending', done: ['DISPATCHED', 'RELEASED'].includes(activeTrip.dispatchStatus) },
    { label: 'In Transit', time: formatDateTime(activeTrip.actualStartTime), done: ['IN_PROGRESS', 'PAUSED', 'COMPLETED'].includes(activeTrip.status) },
    { label: 'Delivered', time: formatDateTime(activeTrip.actualEndTime), done: activeTrip.status === 'COMPLETED' },
  ]

  return (
    <div className="dd">
      {message && <div className="dd-toast">{message}</div>}

      <section className="dd-hero">
        <div className="dd-hero__top">
          <div className="dd-hero__badges">
            <span className={`dd-pill ${activeTrip.status === 'COMPLETED' ? 'dd-pill--green' : activeTrip.status === 'IN_PROGRESS' ? 'dd-pill--blue' : activeTrip.status === 'PAUSED' ? 'dd-pill--amber' : 'dd-pill--amber'}`}>
              {activeTrip.status.replace('_', ' ')}
            </span>
            <span className="dd-pill dd-pill--blue">{activeTrip.priority}</span>
            <code className="dd-hero__code">{activeTrip.tripId}</code>
          </div>
          
          <div className="dd-hero__row">
            <div className="dd-hero__route">
              <div className="dd-endpoint dd-endpoint--origin">
                <div className="dd-endpoint__dot" />
                <div><small>ORIGIN</small><strong>{activeTrip.source}</strong></div>
              </div>
              <div className="dd-route-connector">
                <div className="dd-route-connector__line" />
                <span className="dd-route-connector__label">{activeTrip.stops.length} stops · {activeTrip.estimatedDistance} km</span>
              </div>
              <div className="dd-endpoint dd-endpoint--dest">
                <div className="dd-endpoint__dot" />
                <div><small>DESTINATION</small><strong>{activeTrip.destination}</strong></div>
              </div>
            </div>
            
            <div className="dd-hero__metrics">
              <div className="dd-metric"><small>Vehicle</small><strong>{activeTrip.assignedVehicleId}</strong></div>
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
          {activeTrip.status === 'DISPATCHED' && (
            <button className="dd-btn dd-btn--primary" onClick={handleStart} disabled={working}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Start Trip
            </button>
          )}
          {activeTrip.status === 'IN_PROGRESS' && (
            <button className="dd-btn dd-btn--secondary" onClick={handlePause} disabled={working}>
              Pause Trip
            </button>
          )}
          {activeTrip.status === 'PAUSED' && (
            <button className="dd-btn dd-btn--primary" onClick={handleResume} disabled={working}>
              Resume Trip
            </button>
          )}
          <button className="dd-btn dd-btn--ghost" onClick={() => window.open(`https://www.google.com/maps/dir/${encodeURIComponent(activeTrip.source)}/${activeTrip.destination}`, '_blank')}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            Navigate
          </button>
          
        </div>


      </section>

      <div className="dd-grid">
        <div className="dd-grid__main">
          <div className="dd-route-section" style={{ marginBottom: '24px' }}>
            <div className="dd-block__title" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Route Progress</span>
              <small style={{ color: 'var(--color-muted)' }}>{activeTrip.tripId} • {activeTrip.stops.length} stops</small>
            </div>
            <TripRoute 
              stops={activeTrip.stops} 
              isLoading={loading} 
              onUpdateStatus={activeTrip.status === 'IN_PROGRESS' ? handleStopStatusUpdate : undefined}
            />
          </div>




          {telemetry.length > 0 && (
            <section className="dd-card">
              <div className="dd-card__head"><h4>Live Telemetry</h4></div>
              <div className="dd-telem-grid">
                {telemetry.slice(-4).map((pt, i) => (
                  <div key={i} className="dd-telem-item">
                    <strong>{new Date(pt.timestamp).toLocaleTimeString()}</strong>
                    <span>{Math.round(pt.speed)} km/h</span>
                    <span>Fuel {Math.round(pt.fuelLevel)}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="dd-grid__side">
          <div className="dd-block">
            <h4 className="dd-block__title">Task Checklist</h4>
            {(['pickupCompleted', 'documentsVerified', 'deliveryCompleted'] as const).map(key => (
              <label key={key} className={`dd-chk ${checklist[key] ? 'dd-chk--on' : ''}`}>
                <div className="dd-chk__box">
                  {checklist[key] && <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <input type="checkbox" hidden checked={checklist[key]} onChange={() => updateChecklist(key)} />
                <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
              </label>
            ))}
            <div className="dd-chk-bar">
              <div className="dd-chk-bar__track"><div className="dd-chk-bar__fill" style={{ width: `${(checklistCount/3)*100}%` }} /></div>
              <small>{checklistCount}/3 tasks</small>
            </div>
          </div>

          <div className="dd-block">
            <h4 className="dd-block__title">Trip Timeline</h4>
            <div className="dd-timeline">
              {timelineSteps.map((s, i) => (
                <div key={i} className={`dd-tl ${s.done ? 'dd-tl--done' : ''}`}>
                  <div className="dd-tl__rail">
                    <div className="dd-tl__dot" />
                    {i < timelineSteps.length - 1 && <div className="dd-tl__line" />}
                  </div>
                  <div className="dd-tl__body"><strong>{s.label}</strong><small>{s.time}</small></div>
                </div>
              ))}
            </div>
          </div>

          <div className="dd-block">
            <h4 className="dd-block__title">Safety & Compliance {alertCount > 0 && <span className="dd-block__badge">{alertCount}</span>}</h4>
            {compliance?.blockingReasons.map((r, i) => <div key={i} className="dd-notif dd-notif--block">🚨 {r}</div>)}
            {compliance?.warnings.map((w, i) => <div key={i} className="dd-notif dd-notif--warn">⚠️ {w}</div>)}
            {systemAlerts.map(a => <div key={a.id} className="dd-notif dd-notif--warn">📢 {a.title}</div>)}
            {alertCount === 0 && <div className="dd-notif dd-notif--clear">✅ No active alerts</div>}
          </div>
        </aside>
      </div>

      {activeTrip.status === 'IN_PROGRESS' && (
        <section className="dd-card dd-lower" style={{marginTop: '24px'}}>
          <div className="dd-card__head"><h4>Finish Trip</h4></div>
          <form className="dd-form" onSubmit={handleComplete}>
            <p className="muted" style={{marginBottom: '16px'}}>Ensure all checklist items are completed before finishing the trip.</p>
            <button className="dd-btn dd-btn--primary dd-btn--full" type="submit" disabled={working}>
              Complete Trip & Sign Off
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
