import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapView } from '../components/MapView'
import { PageHeader } from '../components/PageHeader'
import {
  createRoutePlan,
  deleteRoutePlan,
  fetchRoutePlans,
  optimizeRoutes,
  updateRoutePlan,
} from '../services/apiService'
import type { CreateRoutePlanInput, RoutePlan } from '../types'

function routeStatusClass(status: RoutePlan['status']) {
  if (status === 'Completed') {
    return 'badge badge--completed'
  }

  if (status === 'Scheduled') {
    return 'badge badge--scheduled'
  }

  return 'badge badge--online'
}

const initialForm: CreateRoutePlanInput = {
  name: '',
  status: 'Scheduled',
  distanceKm: 0,
  estimatedDuration: '',
  stops: [],
}

export function RoutePlanner() {
  const [searchParams] = useSearchParams()
  const [routes, setRoutes] = useState<RoutePlan[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null)
  const [stopsInput, setStopsInput] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<CreateRoutePlanInput>(initialForm)

  useEffect(() => {
    async function loadRoutes() {
      const routeData = await fetchRoutePlans()
      setRoutes(routeData)

      const highlightedRouteId = searchParams.get('highlight')
      const initialSelectedRoute =
        routeData.find((route) => route.id === highlightedRouteId)?.id ?? routeData[0]?.id ?? null

      setSelectedRouteId(initialSelectedRoute)
    }

    void loadRoutes()
  }, [searchParams])

  const highlightedRouteId = searchParams.get('highlight')
  const orderedRoutes = [...routes].sort((left, right) => {
    if (left.id === highlightedRouteId) {
      return -1
    }

    if (right.id === highlightedRouteId) {
      return 1
    }

    return left.distanceKm - right.distanceKm
  })

  const primaryRoute =
    orderedRoutes.find((route) => route.id === selectedRouteId) ?? orderedRoutes[0]

  async function handleOptimizeRoutes() {
    setIsOptimizing(true)
    setError('')

    try {
      const nextRoutes = await optimizeRoutes()
      setRoutes(nextRoutes)

      if (!selectedRouteId && nextRoutes[0]) {
        setSelectedRouteId(nextRoutes[0].id)
      }
    } catch (optimizeError) {
      setError(optimizeError instanceof Error ? optimizeError.message : 'Unable to optimize routes.')
    } finally {
      setIsOptimizing(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const nextForm = {
      ...form,
      stops: stopsInput
        .split(',')
        .map((stop) => stop.trim())
        .filter(Boolean),
    }

    try {
      if (editingRouteId) {
        const updatedRoute = await updateRoutePlan(editingRouteId, nextForm)
        setRoutes((current) => current.map((route) => (route.id === updatedRoute.id ? updatedRoute : route)))
        setSelectedRouteId(updatedRoute.id)
      } else {
        const createdRoute = await createRoutePlan(nextForm)
        setRoutes((current) => [...current, createdRoute])
        setSelectedRouteId(createdRoute.id)
      }

      resetForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save route.')
    }
  }

  async function handleDelete(route: RoutePlan) {
    setError('')
    setDeletingRouteId(route.id)

    try {
      await deleteRoutePlan(route.id)
      setRoutes((current) => current.filter((item) => item.id !== route.id))

      if (selectedRouteId === route.id) {
        const remainingRoutes = orderedRoutes.filter((item) => item.id !== route.id)
        setSelectedRouteId(remainingRoutes[0]?.id ?? null)
      }

      if (editingRouteId === route.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete route.')
    } finally {
      setDeletingRouteId((current) => (current === route.id ? null : current))
    }
  }

  function handleEdit(route: RoutePlan) {
    setForm({
      name: route.name,
      status: route.status,
      distanceKm: route.distanceKm,
      estimatedDuration: route.estimatedDuration,
      stops: route.stops,
    })
    setStopsInput(route.stops.join(', '))
    setEditingRouteId(route.id)
    setShowForm(true)
    setSelectedRouteId(route.id)
    setError('')
  }

  function resetForm() {
    setForm(initialForm)
    setStopsInput('')
    setEditingRouteId(null)
    setShowForm(false)
    setError('')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Dispatch planning"
        title="Route planner"
        description="Lay out stop sequences, compare route progress, and prepare dispatch teams for the next wave."
        actionLabel={isOptimizing ? 'Optimizing...' : 'Optimize route'}
        actionDisabled={isOptimizing}
        onAction={handleOptimizeRoutes}
      />

      <div className="form-actions">
        <button
          className="secondary-button"
          onClick={() => {
            if (showForm) {
              resetForm()
            } else {
              setShowForm(true)
              setError('')
            }
          }}
          type="button"
        >
          {showForm ? 'Close route form' : 'Add route'}
        </button>
      </div>

      {showForm ? (
        <form className="panel inline-form" onSubmit={handleSubmit}>
          <div className="panel__header">
            <div>
              <h3>{editingRouteId ? `Edit ${editingRouteId}` : 'Create route'}</h3>
              <p className="muted">Define route metadata and comma-separated stops for dispatch planning.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="input-group">
              <span>Name</span>
              <input onChange={(event) => setForm({ ...form, name: event.target.value })} required type="text" value={form.name} />
            </label>
            <label className="input-group">
              <span>Status</span>
              <select onChange={(event) => setForm({ ...form, status: event.target.value as RoutePlan['status'] })} value={form.status}>
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </label>
            <label className="input-group">
              <span>Distance (km)</span>
              <input min="0" onChange={(event) => setForm({ ...form, distanceKm: Number(event.target.value) })} required type="number" value={form.distanceKm} />
            </label>
            <label className="input-group">
              <span>Estimated duration</span>
              <input onChange={(event) => setForm({ ...form, estimatedDuration: event.target.value })} required type="text" value={form.estimatedDuration} />
            </label>
            <label className="input-group input-group--full">
              <span>Stops</span>
              <textarea
                onChange={(event) => setStopsInput(event.target.value)}
                placeholder="Mumbai Hub, Pune Depot, Satara Crossdock"
                required
                value={stopsInput}
              />
            </label>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editingRouteId ? 'Save changes' : 'Save route'}
            </button>
            <button className="secondary-button" onClick={resetForm} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {primaryRoute ? <MapView title={primaryRoute.name} stops={primaryRoute.stops} /> : null}

      {error && !showForm ? <div className="form-error">{error}</div> : null}

      <section className="route-list">
        {orderedRoutes.map((route) => (
          <article
            key={route.id}
            className={`route-item${route.id === highlightedRouteId ? ' route-item--highlighted' : ''}${route.id === primaryRoute?.id ? ' card--highlighted' : ''}`}
          >
            <div className="detail-section__header">
              <div>
                <h3>{route.name}</h3>
                <p className="muted">{route.id}</p>
              </div>
              <span className={routeStatusClass(route.status)}>{route.status}</span>
            </div>
            <div className="detail-meta">
              <span className="badge">{route.distanceKm} km</span>
              <span className="badge">{route.estimatedDuration}</span>
              <span className="badge">{route.stops.length} stops</span>
            </div>
            <div className="map-view__stops">
              {route.stops.map((stop) => (
                <span key={`${route.id}-${stop}`} className="badge">
                  {stop}
                </span>
              ))}
            </div>
            <div className="form-actions">
              <button
                className="secondary-button"
                disabled={deletingRouteId === route.id}
                onClick={() => setSelectedRouteId(route.id)}
                type="button"
              >
                View on map
              </button>
              <button
                className="secondary-button"
                disabled={deletingRouteId === route.id}
                onClick={() => handleEdit(route)}
                type="button"
              >
                Edit
              </button>
              <button
                aria-busy={deletingRouteId === route.id}
                aria-label={deletingRouteId === route.id ? 'Deleting...' : 'Delete'}
                className={`secondary-button danger-button loading-button${deletingRouteId === route.id ? ' is-loading' : ''}`}
                disabled={deletingRouteId === route.id}
                onClick={() => handleDelete(route)}
                type="button"
              >
                <span aria-hidden="true" className="loading-button__content">
                  <span className="loading-button__label loading-button__label--default">Delete</span>
                  <span className="loading-button__label loading-button__label--active">Deleting...</span>
                </span>
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
