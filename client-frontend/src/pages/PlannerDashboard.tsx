import { useEffect, useState } from 'react'
import { MapView } from '../components/MapView'
import {
  fetchDrivers,
  fetchVehicles,
  createTrip,
  optimizeTrip,
  fetchRoutePlans,
} from '../services/apiService'
import type { 
  Driver, 
  Vehicle, 
  CreateTripInput, 
  Trip, 
  RoutePlan,
  TripOptimizationResult,
  TripStop
} from '../types'

export function PlannerDashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [routes, setRoutes] = useState<RoutePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Planning State
  const [tripForm, setTripForm] = useState<CreateTripInput>({
    routeId: '',
    assignedVehicleId: '',
    assignedDriverId: '',
    source: '',
    destination: '',
    stops: [],
    plannedStartTime: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T08:00',
    plannedEndTime: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T20:00',
    estimatedDistance: 100,
    estimatedDuration: '4 hours',
    priority: 'MEDIUM',
  })

  const [newStop, setNewStop] = useState('')
  const [plannedTrip, setPlannedTrip] = useState<Trip | null>(null)
  const [optResult, setOptResult] = useState<TripOptimizationResult | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [d, v, r] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchRoutePlans()
      ])
      setDrivers(d)
      setVehicles(v)
      setRoutes(r)
      
      if (r.length > 0) {
        // Auto-fill some fields if a route is selected
        setTripForm(prev => ({ ...prev, routeId: r[0].id }))
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load planning data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleAddStop = () => {
    if (!newStop.trim()) return
    const stop: TripStop = {
      name: newStop.trim(),
      sequence: tripForm.stops.length + 1,
      status: 'PENDING' as any
    }

    setTripForm(prev => ({ ...prev, stops: [...prev.stops, stop] }))
    setNewStop('')
  }

  const handleRemoveStop = (index: number) => {
    setTripForm(prev => ({ ...prev, stops: prev.stops.filter((_, i) => i !== index) }))
  }

  const handleSaveTrip = async () => {
    setWorking(true)
    try {
      const trip = await createTrip(tripForm)
      setPlannedTrip(trip)
      setMessage(`Trip ${trip.tripId} created successfully. You can now optimize it.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create trip')
    } finally {
      setWorking(false)
    }
  }

  const handleOptimize = async () => {
    if (!plannedTrip) return
    setWorking(true)
    try {
      const result = await optimizeTrip(plannedTrip.tripId)
      setOptResult(result)
      setTripForm(prev => ({
        ...prev,
        stops: result.optimizedStops,
        estimatedDistance: result.estimatedDistance,
        estimatedDuration: result.estimatedDuration
      }))
      setMessage('Route optimized for maximum efficiency.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Optimization failed')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div className="dd-loading">Loading planner tools...</div>

  return (
    <div className="dd">
      {message && <div className="dd-toast">{message}</div>}

      {/* Top: Planning Controls */}
      <section className="dd-topbar" style={{ marginBottom: '24px' }}>
        <div className="dd-card dd-card--glass" style={{ width: '100%', padding: '20px' }}>
          <h4>Trip Planning & Dispatch Setup</h4>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <label className="dd-form__field">
              <small>Base Route</small>
              <select value={tripForm.routeId} onChange={e => setTripForm({...tripForm, routeId: e.target.value})}>
                <option value="">-- Select Route Template --</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="dd-form__field">
              <small>Vehicle</small>
              <select value={tripForm.assignedVehicleId} onChange={e => setTripForm({...tripForm, assignedVehicleId: e.target.value})}>
                <option value="">-- Assign Vehicle --</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.id} ({v.type})</option>)}
              </select>
            </label>
            <label className="dd-form__field">
              <small>Driver</small>
              <select value={tripForm.assignedDriverId} onChange={e => setTripForm({...tripForm, assignedDriverId: e.target.value})}>
                <option value="">-- Assign Driver --</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="dd-form__field">
              <small>Priority</small>
              <select value={tripForm.priority} onChange={e => setTripForm({...tripForm, priority: e.target.value as CreateTripInput['priority']})}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="dd-btn dd-btn--primary" style={{ width: '100%' }} onClick={handleSaveTrip} disabled={working}>
                {plannedTrip ? 'Update Plan' : 'Create & Stage Trip'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="dd-grid">
        {/* Left: Map */}
        <div className="dd-grid__main">
          <div className="dd-map-wrap">
            <MapView title="Route Sequencing Preview" stops={[tripForm.source, ...tripForm.stops.map(s => s.name), tripForm.destination].filter(Boolean)} />
          </div>
          
          <section className="dd-card" style={{ marginTop: '24px' }}>
            <div className="dd-card__head"><h4>Core Trip Details</h4></div>
            <div className="form-grid" style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <label className="dd-form__field">
                <small>Origin Address</small>
                <input type="text" value={tripForm.source} onChange={e => setTripForm({...tripForm, source: e.target.value})} placeholder="e.g. Mumbai CFS" />
              </label>
              <label className="dd-form__field">
                <small>Final Destination</small>
                <input type="text" value={tripForm.destination} onChange={e => setTripForm({...tripForm, destination: e.target.value})} placeholder="e.g. Pune Warehouse" />
              </label>
              <label className="dd-form__field">
                <small>Planned Start</small>
                <input type="datetime-local" value={tripForm.plannedStartTime} onChange={e => setTripForm({...tripForm, plannedStartTime: e.target.value})} />
              </label>
              <label className="dd-form__field">
                <small>Planned Arrival</small>
                <input type="datetime-local" value={tripForm.plannedEndTime} onChange={e => setTripForm({...tripForm, plannedEndTime: e.target.value})} />
              </label>
            </div>
          </section>
        </div>

        {/* Right: Stops + Optimization */}
        <aside className="dd-grid__side">
          {/* Stops List */}
          <div className="dd-block">
            <h4 className="dd-block__title">Stop Sequencing</h4>
            <div className="dd-stop-builder">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={newStop} 
                  onChange={e => setNewStop(e.target.value)} 
                  placeholder="Enter loading point..." 
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                  onKeyDown={e => e.key === 'Enter' && handleAddStop()}
                />
                <button className="dd-btn dd-btn--ghost" onClick={handleAddStop}>Add</button>
              </div>
              <div className="dd-stops-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {tripForm.stops.map((stop, idx) => (
                  <div key={idx} className="dd-stop-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f9fafb', borderRadius: '6px', marginBottom: '8px', border: '1px solid #f3f4f6' }}>
                    <span><small style={{ color: '#9ca3af', marginRight: '8px' }}>{idx + 1}</small>{stop.name}</span>
                    <button onClick={() => handleRemoveStop(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
                {tripForm.stops.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: '20px' }}>No intermediate stops added.</p>}
              </div>
            </div>
          </div>

          {/* Optimization Panel */}
          <div className="dd-block">
            <h4 className="dd-block__title">Engine & Optimization</h4>
            <div className="dd-opt-panel">
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Run the optimization engine to reorder stops for the shortest distance and lowest fuel consumption.
              </p>
              <button 
                className="dd-btn dd-btn--secondary" 
                style={{ width: '100%' }} 
                disabled={!plannedTrip || working}
                onClick={handleOptimize}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                Optimize Sequencing
              </button>
              
              {optResult && (
                <div className="dd-opt-stats" style={{ marginTop: '16px', padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #6ee7b7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <small>Route Score</small>
                    <strong>{optResult.routeScore}/100</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <small>Est. Distance</small>
                    <strong>{optResult.estimatedDistance} km</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Summary */}
          <div className="dd-block">
            <h4 className="dd-block__title">Plan Summary</h4>
            <div className="dd-metrics-compact">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Total Stops</span>
                <strong>{tripForm.stops.length + 2}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Est. Distance</span>
                <strong>{tripForm.estimatedDistance} km</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Est. Duration</span>
                <strong>{tripForm.estimatedDuration}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
