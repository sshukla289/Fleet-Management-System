import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { fetchAuditLogs, fetchAuditLogsByEntity } from '../services/apiService'
import type { AuditLogEntry } from '../types'

const defaultFrom = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
const defaultTo = new Date().toISOString().slice(0, 16)

function formatDateTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function AuditLogs() {
  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
    const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')

  const loadAuditLogs = useCallback(
    async (filters: { from: string; to: string; entityType: string; entityId: string }) => {
    setLoading(true)

    try {
      const data =
        filters.entityType.trim() && filters.entityId.trim()
          ? await fetchAuditLogsByEntity(filters.entityType.trim(), filters.entityId.trim())
          : await fetchAuditLogs({ from: filters.from, to: filters.to })
      setItems(data)
    } catch (error: unknown) { console.error(error);  console.error(); } finally {
      setLoading(false)
      setWorking(false)
    }
    },
    [],
  )

  useEffect(() => {
    void loadAuditLogs({ from: defaultFrom, to: defaultTo, entityType: '', entityId: '' })
  }, [loadAuditLogs])

  const actionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    items.forEach((item) => {
      counts.set(item.action, (counts.get(item.action) ?? 0) + 1)
    })
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4)
  }, [items])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    await loadAuditLogs({ from, to, entityType, entityId })
  }

  return (
    <div className="page-shell">
      <div className="page-top-actions">
        <button className="secondary-button" disabled={loading || working} onClick={() => { setWorking(true); void loadAuditLogs({ from, to, entityType, entityId }); }} type="button">
          Refresh logs
        </button>
      </div>



      <section className="analytics-filter-container">
        <form className="analytics-filter" onSubmit={handleSubmit}>
          <label>
            <span>From</span>
            <input value={from} onChange={(event) => setFrom(event.target.value)} type="datetime-local" />
          </label>
          <label>
            <span>To</span>
            <input value={to} onChange={(event) => setTo(event.target.value)} type="datetime-local" />
          </label>
          <label>
            <span>Entity type</span>
            <input
              placeholder="TRIP, ALERT, MAINTENANCE_SCHEDULE"
              type="text"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            />
          </label>
          <label>
            <span>Entity id</span>
            <input
              placeholder="TRIP-1001"
              type="text"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
            />
          </label>
          <div className="analytics-filter__actions">
            <button className="primary-button" disabled={loading || working} type="submit">
              Apply filters
            </button>
            <span className="badge">{items.length} entries</span>
          </div>
        </form>
      </section>

      <section className="dashboard-stats">
        <article className="stat-card">
          <span>Total entries</span>
          <strong>{items.length}</strong>
          <small>Records returned by current filter</small>
        </article>
        {actionCounts.map(([action, count]) => (
          <article key={action} className="stat-card">
            <span>{action}</span>
            <strong>{count}</strong>
            <small>Occurrences in current result set</small>
          </article>
        ))}
      </section>

      <section className="table-container--flat">
        <div className="panel__header">
          <div>
            <h3>Event stream</h3>
            <p className="muted">Most recent audit records first, with structured details where available.</p>
          </div>
        </div>
        <div className="trip-table">
          <div className="trip-table__head">
            <span>Time</span>
            <span>Action</span>
            <span>Entity</span>
            <span>Actor</span>
            <span>Summary</span>
          </div>
          {items.length ? (
            items.map((item) => (
              <div key={item.id} className="trip-table__row trip-table__row--static">
                <span>
                  <strong>{formatDateTime(item.createdAt)}</strong>
                  <small>{item.id}</small>
                </span>
                <span>
                  <strong>{item.action}</strong>
                  <small>{item.entityType}</small>
                </span>
                <span>
                  <strong>{item.entityType}</strong>
                  <small>{item.entityId}</small>
                </span>
                <span>
                  <strong>{item.actor}</strong>
                  <small>system/user actor</small>
                </span>
                <span>
                  <strong>{item.summary}</strong>
                  <small>{item.detailsJson ?? 'No structured details'}</small>
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No audit records matched the current filter.</p>
          )}
        </div>
      </section>
    </div>
  )
}
