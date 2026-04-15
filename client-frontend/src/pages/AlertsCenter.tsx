import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '../context/useAuth'
import { acknowledgeAlert, fetchAlerts, resolveAlert, fetchTrips } from '../services/apiService'
import type { Alert, AlertLifecycleStatus, AlertSeverity } from '../types'

type StatusFilter = AlertLifecycleStatus | 'ALL'
type SeverityFilter = AlertSeverity | 'ALL'

export function AlertsCenter() {
  const { session } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  
  const currentRole = session?.profile.role
  const currentUserId = session?.profile.id
  const isDriver = currentRole === 'DRIVER'

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [allAlerts, allTrips] = await Promise.all([
        fetchAlerts(),
        fetchTrips()
      ])

      // If driver, filter alerts to only those related to driver's trips
      if (isDriver) {
        const myTripIds = allTrips
          .filter(t => t.assignedDriverId === currentUserId)
          .map(t => t.tripId)
        
        const filtered = allAlerts.filter(a => 
          (a.relatedTripId && myTripIds.includes(a.relatedTripId)) ||
          (a.relatedVehicleId && allTrips.some(t => t.assignedVehicleId === a.relatedVehicleId && t.assignedDriverId === currentUserId))
        )
        setAlerts(filtered)
      } else {
        setAlerts(allAlerts)
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to sync alerts.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [isDriver, currentUserId])

  useEffect(() => {
    void loadData()
    // Polling every 15 seconds for real-time feel
    const timer = setInterval(() => void loadData(false), 15000)
    return () => clearInterval(timer)
  }, [loadData])

  const filteredAlerts = useMemo(() => {
    // 1. Filter
    const result = alerts.filter((alert) => {
      const matchesStatus = statusFilter === 'ALL' || alert.status === statusFilter
      const matchesSeverity = severityFilter === 'ALL' || alert.severity === severityFilter
      return matchesStatus && matchesSeverity
    })

    // 2. Sort: Severity first, then newest
    const severityMap: Record<AlertSeverity, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    }

    return result.sort((a, b) => {
      const sevA = severityMap[a.severity]
      const sevB = severityMap[b.severity]
      if (sevA !== sevB) return sevB - sevA
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [alerts, severityFilter, statusFilter])

  const handleAction = async (id: string, action: 'acknowledge' | 'resolve') => {
    setWorkingId(id)
    try {
      if (action === 'acknowledge') await acknowledgeAlert(id)
      else await resolveAlert(id)
      
      // Update local state for immediate feedback
      setAlerts(prev => prev.map(a => {
        if (a.id === id) {
          return { ...a, status: action === 'acknowledge' ? 'ACKNOWLEDGED' : 'RESOLVED' }
        }
        return a
      }))
      setMessage(`Alert ${action === 'acknowledge' ? 'acknowledged' : 'resolved'} successfully.`)
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setWorkingId(null)
    }
  }

  // Stats for cards
  const stats = {
    total: alerts.length,
    open: alerts.filter(a => a.status === 'OPEN').length,
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    acknowledged: alerts.filter(a => a.status === 'ACKNOWLEDGED').length
  }

  if (loading && alerts.length === 0) {
    return <div className="dd-loading">Syncing operational alert stream...</div>
  }

  return (
    <div className="dd">
      <header className="dd-header" style={{ marginBottom: '24px' }}>
        <div>
          <span className="dd-stat__l" style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Safety & Exception Monitoring</span>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginTop: '4px' }}>Alerts Center</h1>
        </div>
        <button className="dd-btn dd-btn--primary" onClick={() => void loadData()}>Refresh Feed</button>
      </header>

      {message && <div className="dd-toast">{message}</div>}

      {/* Dynamic Header Stats */}
      <section className="dd-topbar" style={{ marginBottom: '24px' }}>
        <div className="dd-stats-row">
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#253B80' }}>{stats.total}</span>
            <span className="dd-stat__l">Total Alerts</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#f59e0b' }}>{stats.open}</span>
            <span className="dd-stat__l">Open</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#ef4444' }}>{stats.critical}</span>
            <span className="dd-stat__l">Critical</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#3b82f6' }}>{stats.acknowledged}</span>
            <span className="dd-stat__l">Acknowledged</span>
          </div>
        </div>
      </section>

      {/* Filter Panel */}
      <section className="dd-card" style={{ marginBottom: '24px' }}>
        <div className="dd-card__head"><h4>Stream Filters</h4></div>
        <div style={{ padding: '20px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ marginBottom: '16px' }}>
            <small style={{ display: 'block', marginBottom: '8px', color: '#6b7280', fontWeight: 600 }}>Lifecycle Status</small>
            <div className="dd-pill-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['ALL', 'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
                <button 
                  key={s} 
                  className={`dd-pill ${statusFilter === s ? 'dd-pill--blue' : 'dd-pill--gray'}`}
                  style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => setStatusFilter(s as StatusFilter)}
                >{s}</button>
              ))}
            </div>
          </div>
          <div>
            <small style={{ display: 'block', marginBottom: '8px', color: '#6b7280', fontWeight: 600 }}>Severity Level</small>
            <div className="dd-pill-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
                <button 
                  key={s} 
                  className={`dd-pill ${severityFilter === s ? 'dd-pill--rose' : 'dd-pill--gray'}`}
                  style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => setSeverityFilter(s as SeverityFilter)}
                >{s}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Alerts Grid */}
      <div className="dd-grid">
        <div className="dd-grid__main">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map(alert => (
                <article key={alert.id} className="dd-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="dd-card__head" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <span className="dd-pill dd-pill--gray" style={{ fontSize: '0.6rem', marginBottom: '4px' }}>{alert.category.replace('_', ' ')}</span>
                      <h4 style={{ margin: 0 }}>{alert.title}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span className={`dd-pill ${
                        alert.severity === 'CRITICAL' ? 'dd-pill--rose' : 
                        alert.severity === 'HIGH' ? 'dd-pill--amber' :
                        alert.severity === 'MEDIUM' ? 'dd-pill--blue' : 'dd-pill--gray'
                      }`}>{alert.severity}</span>
                      <span className={`dd-pill ${
                        alert.status === 'RESOLVED' ? 'dd-pill--green' :
                        alert.status === 'OPEN' ? 'dd-pill--rose' : 'dd-pill--blue'
                      }`}>{alert.status}</span>
                    </div>
                  </div>
                  
                  <div style={{ padding: '20px', flex: 1 }}>
                    <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>{alert.description}</p>
                    
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {alert.relatedTripId && (
                        <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <small style={{ color: '#64748b' }}>Trip: </small>
                          <small style={{ fontWeight: 600 }}>{alert.relatedTripId}</small>
                        </div>
                      )}
                      {alert.relatedVehicleId && (
                        <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <small style={{ color: '#64748b' }}>Vehicle: </small>
                          <small style={{ fontWeight: 600 }}>{alert.relatedVehicleId}</small>
                        </div>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                        <small style={{ color: '#94a3b8' }}>{new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: '8px' }}>
                    <button 
                      className="dd-btn dd-btn--secondary" 
                      style={{ flex: 1, padding: '8px' }}
                      disabled={workingId === alert.id || alert.status !== 'OPEN'}
                      onClick={() => handleAction(alert.id, 'acknowledge')}
                    >
                      {workingId === alert.id ? '...' : 'Acknowledge'}
                    </button>
                    <button 
                      className="dd-btn dd-btn--primary" 
                      style={{ flex: 1, padding: '8px' }}
                      disabled={workingId === alert.id || (alert.status !== 'OPEN' && alert.status !== 'ACKNOWLEDGED')}
                      onClick={() => handleAction(alert.id, 'resolve')}
                    >
                      {workingId === alert.id ? '...' : 'Resolve'}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="dd-card" style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                <h4 style={{ color: '#111827' }}>No Alerts at the moment</h4>
                <p className="muted">Your operational stream is clear. All systems are operating within normal parameters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
