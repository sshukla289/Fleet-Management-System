import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RoutePreviewMap } from '../components/RoutePreviewMap'
import {
  createRoutePlan,
  deleteRoutePlan,
  fetchRoutePlans,
  optimizeRoutes,
  updateRoutePlan,
} from '../services/apiService'
import type { CreateRoutePlanInput, RoutePlan, StopStatus, TripStop } from '../types'

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

function createEmptyStop(sequence: number): TripStop {
  return {
    name: '',
    sequence,
    latitude: null,
    longitude: null,
    status: 'PENDING',
  }
}

function normalizeStops(stops: TripStop[]) {
  return stops
    .map((stop, index) => ({
      ...stop,
      sequence: index + 1,
      name: stop.name.trim(),
      latitude: typeof stop.latitude === 'number' && Number.isFinite(stop.latitude) ? stop.latitude : null,
      longitude: typeof stop.longitude === 'number' && Number.isFinite(stop.longitude) ? stop.longitude : null,
    }))
    .filter((stop) => stop.name)
}

function parseCoordinateInput(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isCoordinateWithinRange(value: number | null, type: 'latitude' | 'longitude') {
  if (value == null) {
    return false
  }

  return type === 'latitude'
    ? value >= -90 && value <= 90
    : value >= -180 && value <= 180
}

function formatDistanceInput(value: string) {
  if (!value) {
    return ''
  }

  if (!/^\d*\.?\d*$/.test(value)) {
    return value
  }

  const limitedValue = (() => {
    if (!value.includes('.')) {
      return value
    }

    const [integerPart, fractionalPart] = value.split('.', 2)
    return `${integerPart}.${fractionalPart.slice(0, 2)}`
  })()

  if (limitedValue === '.') {
    return '0.'
  }

  const normalizedValue = limitedValue.startsWith('.') ? `0${limitedValue}` : limitedValue
  const parsedValue = Number(normalizedValue)

  if (Number.isNaN(parsedValue)) {
    return normalizedValue
  }

  if (parsedValue >= 10) {
    if (normalizedValue.includes('.')) {
      const [integerPart, fractionalPart] = normalizedValue.split('.', 2)
      return `${String(Number(integerPart))}.${fractionalPart}`
    }

    return String(parsedValue)
  }

  if (normalizedValue.includes('.')) {
    const [integerPart, fractionalPart] = normalizedValue.split('.', 2)
    const paddedIntegerPart =
      integerPart && integerPart !== '0' ? integerPart.padStart(2, '0') : integerPart

    return `${paddedIntegerPart}.${fractionalPart}`
  }

  if (/^\d$/.test(normalizedValue) && normalizedValue !== '0') {
    return normalizedValue.padStart(2, '0')
  }

  if (/^0\d+$/.test(normalizedValue)) {
    return String(parsedValue).padStart(2, '0')
  }

  return normalizedValue
}

export function RoutePlanner() {
  const [searchParams] = useSearchParams()
  const [routes, setRoutes] = useState<RoutePlan[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null)
  const [distanceInput, setDistanceInput] = useState('0')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
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

  const previewStops = useMemo(
    () => (showForm ? form.stops : (primaryRoute?.stops ?? [])),
    [form.stops, primaryRoute, showForm],
  )

  async function handleOptimizeRoutes() {
    setIsOptimizing(true)
    setError('')
    setSuccessMessage('')

    try {
      const nextRoutes = await optimizeRoutes()
      setRoutes(nextRoutes)

      if (nextRoutes[0]) {
        setSelectedRouteId((current) =>
          current && nextRoutes.some((route) => route.id === current) ? current : nextRoutes[0].id,
        )
      }

      setSuccessMessage(
        nextRoutes.length === 1
          ? 'Route optimization applied. Distance, ETA, and stop order were refreshed.'
          : `Route optimization applied to ${nextRoutes.length} plans. Distance, ETA, and stop order were refreshed.`,
      )
    } catch (optimizeError) {
      setError(optimizeError instanceof Error ? optimizeError.message : 'Unable to optimize routes.')
    } finally {
      setIsOptimizing(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    const parsedDistance = Number(distanceInput)
    if (!distanceInput.trim() || Number.isNaN(parsedDistance) || parsedDistance < 0) {
      setError('Distance must be a valid non-negative number.')
      return
    }

    const normalizedStops = normalizeStops(form.stops)

    if (normalizedStops.length < 2) {
      setError('Add at least two stops with coordinates to create a route geometry.')
      return
    }

    const stopWithMissingCoordinates = normalizedStops.find(
      (stop) => stop.latitude == null || stop.longitude == null,
    )
    if (stopWithMissingCoordinates) {
      setError(`Stop "${stopWithMissingCoordinates.name}" is missing latitude or longitude.`)
      return
    }

    const stopWithInvalidCoordinates = normalizedStops.find(
      (stop) => !isCoordinateWithinRange(stop.latitude ?? null, 'latitude')
        || !isCoordinateWithinRange(stop.longitude ?? null, 'longitude'),
    )
    if (stopWithInvalidCoordinates) {
      setError(`Stop "${stopWithInvalidCoordinates.name}" has coordinates outside the valid range.`)
      return
    }

    const nextForm: CreateRoutePlanInput = {
      ...form,
      distanceKm: parsedDistance,
      stops: normalizedStops,
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
    setSuccessMessage('')
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
      stops: route.stops.map((stop) => ({ ...stop })),
    })
    setDistanceInput(formatDistanceInput(String(route.distanceKm)))
    setEditingRouteId(route.id)
    setShowForm(true)
    setSelectedRouteId(route.id)
    setError('')
    setSuccessMessage('')
  }

  function resetForm() {
    setForm(initialForm)
    setDistanceInput('0')
    setEditingRouteId(null)
    setShowForm(false)
    setError('')
  }

  function updateStop(index: number, nextStop: TripStop) {
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) => (stopIndex === index ? nextStop : stop)),
    }))
  }

  function addStop() {
    setForm((current) => ({
      ...current,
      stops: [...current.stops, createEmptyStop(current.stops.length + 1)],
    }))
  }

  function removeStop(index: number) {
    setForm((current) => ({
      ...current,
      stops: current.stops
        .filter((_, stopIndex) => stopIndex !== index)
        .map((stop, stopIndex) => ({ ...stop, sequence: stopIndex + 1 })),
    }))
  }

  function moveStop(index: number, direction: -1 | 1) {
    setForm((current) => {
      const nextStops = [...current.stops]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= nextStops.length) {
        return current
      }

      const [moved] = nextStops.splice(index, 1)
      nextStops.splice(targetIndex, 0, moved)

      return {
        ...current,
        stops: nextStops.map((stop, stopIndex) => ({ ...stop, sequence: stopIndex + 1 })),
      }
    })
  }

  return (
    <div className="page-shell">
      <div className="page-top-actions">
        <button
          className="secondary-button"
          onClick={() => {
            if (showForm) {
              resetForm()
            } else {
              setShowForm(true)
              setError('')
              setSuccessMessage('')
            }
          }}
          type="button"
        >
          {showForm ? 'Close route form' : 'Add route'}
        </button>
        <button
          className="primary-button"
          disabled={isOptimizing}
          onClick={handleOptimizeRoutes}
          type="button"
        >
          {isOptimizing ? 'Optimizing...' : 'Optimize route'}
        </button>
      </div>

      {showForm ? (
        <form className="panel--flat inline-form" onSubmit={handleSubmit}>
          <div className="panel__header">
            <div>
              <h3>{editingRouteId ? `Edit ${editingRouteId}` : 'Create route'}</h3>
              <p className="muted">Define route metadata, ordered stops, and coordinates for route preview and live deviation detection.</p>
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
              <input
                min="0"
                onChange={(event) => setDistanceInput(formatDistanceInput(event.target.value))}
                required
                step="0.01"
                type="number"
                value={distanceInput}
              />
            </label>
            <label className="input-group">
              <span>Estimated duration</span>
              <input onChange={(event) => setForm({ ...form, estimatedDuration: event.target.value })} required type="text" value={form.estimatedDuration} />
            </label>
          </div>

          <div className="route-stop-editor">
            <div className="route-stop-editor__header">
              <div>
                <h4>Stops & coordinates</h4>
                <p className="muted">Every stop needs a name, latitude, and longitude so planners can preview and monitor the route geometry.</p>
              </div>
              <button className="secondary-button" onClick={addStop} type="button">
                Add stop
              </button>
            </div>

            <div className="route-stop-editor__list">
              {form.stops.length > 0 ? form.stops.map((stop, index) => (
                <div key={`stop-row-${index}`} className="route-stop-editor__row">
                  <div className="route-stop-editor__row-head">
                    <span className="route-stop-editor__sequence">Stop {index + 1}</span>
                    <div className="route-stop-editor__row-actions">
                      <button
                        className="secondary-button"
                        disabled={index === 0}
                        onClick={() => moveStop(index, -1)}
                        type="button"
                      >
                        Up
                      </button>
                      <button
                        className="secondary-button"
                        disabled={index === form.stops.length - 1}
                        onClick={() => moveStop(index, 1)}
                        type="button"
                      >
                        Down
                      </button>
                      <button className="secondary-button danger-button" onClick={() => removeStop(index)} type="button">
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="route-stop-editor__fields">
                    <label className="input-group">
                      <span>Name</span>
                      <input
                        onChange={(event) => updateStop(index, { ...stop, name: event.target.value })}
                        placeholder="Mumbai Hub"
                        required
                        type="text"
                        value={stop.name}
                      />
                    </label>
                    <label className="input-group">
                      <span>Latitude</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateStop(index, { ...stop, latitude: parseCoordinateInput(event.target.value) })}
                        placeholder="19.0760"
                        required
                        step="any"
                        type="number"
                        value={stop.latitude ?? ''}
                      />
                    </label>
                    <label className="input-group">
                      <span>Longitude</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateStop(index, { ...stop, longitude: parseCoordinateInput(event.target.value) })}
                        placeholder="72.8777"
                        required
                        step="any"
                        type="number"
                        value={stop.longitude ?? ''}
                      />
                    </label>
                    <label className="input-group">
                      <span>Status</span>
                      <select
                        onChange={(event) => updateStop(index, { ...stop, status: event.target.value as StopStatus })}
                        value={stop.status}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </label>
                  </div>
                </div>
              )) : (
                <div className="route-stop-editor__empty">
                  Add your first stop to start defining the route geometry.
                </div>
              )}
            </div>
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

      {(primaryRoute || showForm) ? (
        <RoutePreviewMap
          title={showForm ? (editingRouteId ? `Draft ${editingRouteId}` : 'Draft route preview') : primaryRoute?.name ?? 'Route preview'}
          stops={previewStops}
          subtitle={showForm
            ? 'Live preview of the route geometry you are creating or editing.'
            : 'Stored route geometry with stop coordinates and path sequence.'}
        />
      ) : null}

      {successMessage ? <div className="form-success">{successMessage}</div> : null}
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
              <span className="badge">
                {route.stops.filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number').length} mapped
              </span>
            </div>
            <div className="map-view__stops">
              {route.stops.map((stop, idx) => (
                <span key={`${route.id}-${idx}`} className="badge">
                  {stop.name}
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
