import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { MapView } from '../components/MapView'
import { PageHeader } from '../components/PageHeader'
import {
  completeTrip,
  createTrip,
  dispatchTrip,
  fetchDrivers,
  fetchComplianceCheck,
  fetchRoutePlans,
  fetchTripTelemetry,
  fetchTrips,
  fetchVehicles,
  optimizeTrip,
  startTrip,
  validateTrip,
} from '../services/apiService'
import type {
  CompleteTripInput,
  CreateTripInput,
  Driver,
  ComplianceCheckResult,
  RoutePlan,
  Trip,
  TripPriority,
  TripTelemetryPoint,
  Vehicle,
} from '../types'

const initialPlannerForm: CreateTripInput = {
  routeId: '',
  assignedVehicleId: '',
  assignedDriverId: '',
  source: '',
  destination: '',
  stops: [],
  plannedStartTime: new Date().toISOString().slice(0, 16),
  plannedEndTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16),
  estimatedDistance: 0,
  estimatedDuration: '0m',
  priority: 'MEDIUM',
  remarks: '',
}

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
      return 'status-pill status-pill--mint'
    case 'DISPATCHED':
    case 'IN_PROGRESS':
      return 'status-pill status-pill--blue'
    case 'VALIDATED':
    case 'OPTIMIZED':
      return 'status-pill status-pill--violet'
    case 'BLOCKED':
      return 'status-pill status-pill--rose'
    default:
      return 'status-pill status-pill--amber'
  }
}

function priorityTone(priority: TripPriority) {
  switch (priority) {
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

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Pending'
  }

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

export function Trips() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [routes, setRoutes] = useState<RoutePlan[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<TripTelemetryPoint[]>([])
  const [complianceCheck, setComplianceCheck] = useState<ComplianceCheckResult | null>(null)
  const [plannerForm, setPlannerForm] = useState<CreateTripInput>(initialPlannerForm)
  const [completionForm, setCompletionForm] = useState<CompleteTripInput>(initialCompletionForm)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.tripId === selectedTripId) ?? trips[0] ?? null,
    [selectedTripId, trips],
  )

  async function loadBoard() {
    setLoading(true)
    setMessage(null)

    try {
      const [tripData, vehicleData, driverData, routeData] = await Promise.all([
        fetchTrips(),
        fetchVehicles(),
        fetchDrivers(),
        fetchRoutePlans(),
      ])

      setTrips(tripData)
      setVehicles(vehicleData)
      setDrivers(driverData)
      setRoutes(routeData)

      setSelectedTripId((current) => current ?? tripData[0]?.tripId ?? null)

      setPlannerForm((current) => {
        if (current.routeId) {
          return current
        }

        const initialRoute = routeData[0]
        return {
          ...current,
          routeId: initialRoute?.id ?? '',
          assignedVehicleId: vehicleData[0]?.id ?? '',
          assignedDriverId: driverData[0]?.id ?? '',
          source: initialRoute?.stops[0] ?? current.source,
          destination: initialRoute?.stops.at(-1) ?? current.destination,
          stops: initialRoute?.stops ?? current.stops,
          estimatedDistance: initialRoute?.distanceKm ?? current.estimatedDistance,
          estimatedDuration: initialRoute?.estimatedDuration ?? current.estimatedDuration,
        }
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load trip board.')
    } finally {
      setLoading(false)
    }
  }

  async function loadTelemetry(tripId?: string | null) {
    if (!tripId) {
      setTelemetry([])
      setComplianceCheck(null)
      return
    }

    try {
      const [telemetryResult, complianceResult] = await Promise.allSettled([
        fetchTripTelemetry(tripId),
        fetchComplianceCheck(tripId),
      ])

      setTelemetry(telemetryResult.status === 'fulfilled' ? telemetryResult.value : [])
      setComplianceCheck(complianceResult.status === 'fulfilled' ? complianceResult.value : null)
    } catch {
      setTelemetry([])
      setComplianceCheck(null)
    }
  }

  useEffect(() => {
    void loadBoard()
  }, [])

  useEffect(() => {
    void loadTelemetry(selectedTrip?.tripId ?? null)
    setCompletionForm(buildCompletionForm(selectedTrip))
  }, [selectedTrip])

  async function refreshBoard(nextSelectedTripId?: string | null) {
    const keepSelected = nextSelectedTripId ?? selectedTrip?.tripId ?? null
    await loadBoard()
    setSelectedTripId(keepSelected)
  }

  async function handleCreateTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setMessage(null)

    try {
      const createdTrip = await createTrip({
        ...plannerForm,
        stops: plannerForm.stops,
      })
      await refreshBoard(createdTrip.tripId)
      setMessage(`Created trip ${createdTrip.tripId}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create trip.')
    } finally {
      setWorking(false)
    }
  }

  async function handleTripAction(action: () => Promise<unknown>, successMessage: string) {
    if (!selectedTrip) {
      return
    }

    setWorking(true)
    setMessage(null)

    try {
      await action()
      await refreshBoard(selectedTrip.tripId)
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Trip action failed.')
    } finally {
      setWorking(false)
    }
  }

  const totalTrips = trips.length
  const activeTrips = trips.filter((trip) => trip.status === 'DISPATCHED' || trip.status === 'IN_PROGRESS').length
  const blockedTrips = trips.filter((trip) => trip.status === 'BLOCKED').length
  const completedTrips = trips.filter((trip) => trip.status === 'COMPLETED').length
  const actionQueue = trips.filter((trip) => ['DRAFT', 'VALIDATED', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS'].includes(trip.status))

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Workflow control"
        title="Trips"
        description="Plan, validate, optimize, dispatch, and monitor trip lifecycles from one control board."
        actionLabel="Refresh board"
        actionDisabled={working || loading}
        onAction={() => {
          void loadBoard()
        }}
      />

      {message ? <div className="notice">{message}</div> : null}

      <section className="dashboard-stats">
        {[
          { label: 'Trips', value: totalTrips, note: 'Registered lifecycle records' },
          { label: 'Active', value: activeTrips, note: 'Dispatched or in motion' },
          { label: 'Blocked', value: blockedTrips, note: 'Validation or compliance holds' },
          { label: 'Completed', value: completedTrips, note: 'Closed trips awaiting analytics' },
        ].map((stat) => (
          <article key={stat.label} className="stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
          </article>
        ))}
      </section>

      <div className="dashboard-grid dashboard-grid--trips">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Trip planner</h3>
              <p className="muted">Create or import a trip, then validate it against vehicle, driver, and maintenance rules.</p>
            </div>
          </div>

          <form className="trip-form" onSubmit={handleCreateTrip}>
            <label>
              <span>Route</span>
              <select
                onChange={(event) => {
                  const route = routes.find((item) => item.id === event.target.value)
                  setPlannerForm({
                    ...plannerForm,
                    routeId: event.target.value,
                    source: route?.stops[0] ?? plannerForm.source,
                    destination: route?.stops.at(-1) ?? plannerForm.destination,
                    stops: route?.stops ?? plannerForm.stops,
                    estimatedDistance: route?.distanceKm ?? plannerForm.estimatedDistance,
                    estimatedDuration: route?.estimatedDuration ?? plannerForm.estimatedDuration,
                  })
                }}
                value={plannerForm.routeId}
              >
                <option value="">Select route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.id} - {route.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Vehicle</span>
              <select
                onChange={(event) => setPlannerForm({ ...plannerForm, assignedVehicleId: event.target.value })}
                value={plannerForm.assignedVehicleId}
              >
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.id} - {vehicle.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Driver</span>
              <select
                onChange={(event) => setPlannerForm({ ...plannerForm, assignedDriverId: event.target.value })}
                value={plannerForm.assignedDriverId}
              >
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.id} - {driver.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Priority</span>
              <select
                onChange={(event) =>
                  setPlannerForm({ ...plannerForm, priority: event.target.value as TripPriority })
                }
                value={plannerForm.priority}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>

            <label>
              <span>Source</span>
              <input
                onChange={(event) => setPlannerForm({ ...plannerForm, source: event.target.value })}
                type="text"
                value={plannerForm.source}
              />
            </label>

            <label>
              <span>Destination</span>
              <input
                onChange={(event) => setPlannerForm({ ...plannerForm, destination: event.target.value })}
                type="text"
                value={plannerForm.destination}
              />
            </label>

            <label className="trip-form__wide">
              <span>Stops</span>
              <textarea
                onChange={(event) =>
                  setPlannerForm({
                    ...plannerForm,
                    stops: event.target.value
                      .split(',')
                      .map((stop) => stop.trim())
                      .filter(Boolean),
                  })
                }
                rows={3}
                value={plannerForm.stops.join(', ')}
              />
            </label>

            <label>
              <span>Planned start</span>
              <input
                onChange={(event) => setPlannerForm({ ...plannerForm, plannedStartTime: event.target.value })}
                type="datetime-local"
                value={plannerForm.plannedStartTime}
              />
            </label>

            <label>
              <span>Planned end</span>
              <input
                onChange={(event) => setPlannerForm({ ...plannerForm, plannedEndTime: event.target.value })}
                type="datetime-local"
                value={plannerForm.plannedEndTime}
              />
            </label>

            <label>
              <span>Estimated distance</span>
              <input
                min="0"
                onChange={(event) =>
                  setPlannerForm({ ...plannerForm, estimatedDistance: Number(event.target.value) })
                }
                type="number"
                value={plannerForm.estimatedDistance}
              />
            </label>

            <label>
              <span>Estimated duration</span>
              <input
                onChange={(event) => setPlannerForm({ ...plannerForm, estimatedDuration: event.target.value })}
                type="text"
                value={plannerForm.estimatedDuration}
              />
            </label>

            <label className="trip-form__wide">
              <span>Remarks</span>
              <textarea
                onChange={(event) => setPlannerForm({ ...plannerForm, remarks: event.target.value })}
                rows={3}
                value={plannerForm.remarks ?? ''}
              />
            </label>

            <div className="trip-form__actions">
              <button className="primary-button" disabled={working} type="submit">
                {working ? 'Creating...' : 'Create trip'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Lifecycle queue</h3>
              <p className="muted">Trips move left to right through validation, optimization, dispatch, and completion.</p>
            </div>
            <span className="badge">{actionQueue.length} queued</span>
          </div>

          <div className="trip-table">
            <div className="trip-table__head">
              <span>Trip</span>
              <span>Status</span>
              <span>Vehicle / Driver</span>
              <span>Window</span>
              <span>Actions</span>
            </div>

            {trips.map((trip) => (
              <button
                key={trip.tripId}
                className={`trip-table__row${trip.tripId === selectedTrip?.tripId ? ' trip-table__row--selected' : ''}`}
                onClick={() => setSelectedTripId(trip.tripId)}
                type="button"
              >
                <span>
                  <strong>{trip.tripId}</strong>
                  <small>
                    {trip.source} {'->'} {trip.destination}
                  </small>
                </span>
                <span className={statusClass(trip.status)}>{trip.status}</span>
                <span>
                  <strong>{trip.assignedVehicleId}</strong>
                  <small>{trip.assignedDriverId}</small>
                </span>
                <span>
                  <strong>{formatDateTime(trip.plannedStartTime)}</strong>
                  <small>{formatDateTime(trip.plannedEndTime)}</small>
                </span>
                <span>
                  <strong>{trip.actualDistance} km</strong>
                  <small>{trip.estimatedDuration}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selectedTrip ? (
        <div className="dashboard-grid dashboard-grid--trips-detail">
          <MapView title={`${selectedTrip.tripId} route`} stops={selectedTrip.stops} />

          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>{selectedTrip.tripId}</h3>
                <p className="muted">
                  {selectedTrip.source} {'->'} {selectedTrip.destination}
                </p>
              </div>
              <div className="trip-detail__chips">
                <span className={statusClass(selectedTrip.status)}>{selectedTrip.status}</span>
                <span className={priorityTone(selectedTrip.priority)}>{selectedTrip.priority}</span>
              </div>
            </div>

            <div className="trip-detail__stats">
              <article>
                <span>Dispatch</span>
                <strong>{selectedTrip.dispatchStatus}</strong>
              </article>
              <article>
                <span>Compliance</span>
                <strong>{selectedTrip.complianceStatus}</strong>
              </article>
              <article>
                <span>Optimization</span>
                <strong>{selectedTrip.optimizationStatus}</strong>
              </article>
              <article>
                <span>Distance</span>
                <strong>
                  {selectedTrip.actualDistance || selectedTrip.estimatedDistance} km
                </strong>
              </article>
            </div>

            <div className="trip-compliance-banner">
              <div>
                <span>Post-trip summary</span>
                <strong>{selectedTrip.status === 'COMPLETED' ? 'Completion metrics captured' : 'Awaiting trip completion'}</strong>
                <p>
                  Delay, fuel usage, and completion processing metadata are available once the trip is completed.
                </p>
              </div>
              <div className="trip-compliance-banner__meta">
                <span className="badge">Delay: {selectedTrip.delayMinutes ?? 0} min</span>
                <span className="badge">Fuel: {selectedTrip.fuelUsed == null ? 'N/A' : selectedTrip.fuelUsed.toFixed(1)}</span>
                <span className="badge">
                  Processed: {selectedTrip.completionProcessedAt ? formatDateTime(selectedTrip.completionProcessedAt) : 'Pending'}
                </span>
              </div>
            </div>

            <div className="trip-compliance-banner">
              <div>
                <span>Compliance readiness</span>
                <strong>{complianceCheck?.complianceStatus ?? selectedTrip.complianceStatus}</strong>
                <p>
                  {complianceCheck?.recommendedAction ?? 'Select a trip to review compliance checks.'}
                </p>
              </div>
              <div className="trip-compliance-banner__meta">
                <span className={statusClass(selectedTrip.status)}>{selectedTrip.status}</span>
                <span className="badge">{complianceCheck?.blockingReasons.length ?? 0} blockers</span>
              </div>
            </div>

            <div className="trip-detail__actions">
              <button className="secondary-button" disabled={working} onClick={() => void handleTripAction(() => validateTrip(selectedTrip.tripId), 'Trip validated.') } type="button">
                Validate
              </button>
              <button className="secondary-button" disabled={working} onClick={() => void handleTripAction(() => optimizeTrip(selectedTrip.tripId), 'Trip optimized.') } type="button">
                Optimize
              </button>
              <button className="secondary-button" disabled={working} onClick={() => void handleTripAction(() => dispatchTrip(selectedTrip.tripId), 'Trip dispatched.') } type="button">
                Dispatch
              </button>
              <button className="secondary-button" disabled={working} onClick={() => void handleTripAction(() => startTrip(selectedTrip.tripId), 'Trip started.') } type="button">
                Start
              </button>
            </div>

            <form
              className="trip-completion"
              onSubmit={(event) => {
                event.preventDefault()
                void handleTripAction(
                  () =>
                    completeTrip(selectedTrip.tripId, completionForm),
                  'Trip completed.',
                )
              }}
            >
              <h4>Close trip</h4>
              <div className="trip-completion__grid">
                <label>
                  <span>Actual end</span>
                  <input
                    onChange={(event) => setCompletionForm({ ...completionForm, actualEndTime: event.target.value })}
                    type="datetime-local"
                    value={completionForm.actualEndTime}
                  />
                </label>
                <label>
                  <span>Actual distance</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      setCompletionForm({ ...completionForm, actualDistance: Number(event.target.value) })
                    }
                    type="number"
                    value={completionForm.actualDistance}
                  />
                </label>
                <label>
                  <span>Actual duration</span>
                  <input
                    onChange={(event) =>
                      setCompletionForm({ ...completionForm, actualDuration: event.target.value })
                    }
                    type="text"
                    value={completionForm.actualDuration ?? ''}
                  />
                </label>
                <label>
                  <span>Fuel used (optional)</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      setCompletionForm({
                        ...completionForm,
                        fuelUsed: event.target.value === '' ? undefined : Number(event.target.value),
                      })
                    }
                    step="0.1"
                    type="number"
                    value={completionForm.fuelUsed ?? ''}
                  />
                </label>
                <label className="trip-form__wide">
                  <span>Completion remarks</span>
                  <textarea
                    onChange={(event) => setCompletionForm({ ...completionForm, remarks: event.target.value })}
                    rows={3}
                    value={completionForm.remarks ?? ''}
                  />
                </label>
              </div>
              <button className="primary-button" disabled={working} type="submit">
                Complete trip
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {complianceCheck ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Readiness checks</h3>
              <p className="muted">Vehicle, driver, maintenance, and route constraints for the selected trip.</p>
            </div>
            <span className="badge">{complianceCheck.compliant ? 'Cleared' : 'Blocked'}</span>
          </div>

          <div className="trip-compliance-grid">
            <article className="trip-compliance-card">
              <span>Blocking reasons</span>
              {complianceCheck.blockingReasons.length ? (
                <ul>
                  {complianceCheck.blockingReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No blocking constraints detected.</p>
              )}
            </article>
            <article className="trip-compliance-card">
              <span>Warnings</span>
              {complianceCheck.warnings.length ? (
                <ul>
                  {complianceCheck.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No warnings returned for this trip.</p>
              )}
            </article>
            <article className="trip-compliance-card trip-compliance-card--wide">
              <span>Machine-readable checks</span>
              <div className="trip-compliance-checks">
                {complianceCheck.checks.map((check) => (
                  <div key={check.code} className={`trip-compliance-check${check.blocking ? ' trip-compliance-check--blocking' : ''}`}>
                    <strong>{check.label}</strong>
                    <span>{check.message}</span>
                    <small>{check.passed ? 'Passed' : 'Failed'}</small>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Live telemetry</h3>
            <p className="muted">Location, speed, and fuel are linked directly to the selected trip.</p>
          </div>
        </div>

        {telemetry.length ? (
          <div className="trip-telemetry">
            {telemetry.slice(-5).map((point, index) => (
              <article key={`${point.timestamp}-${index}`} className="trip-telemetry__item">
                <strong>{new Date(point.timestamp).toLocaleTimeString()}</strong>
                <span>
                  {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                </span>
                <small>{Math.round(point.speed)} km/h | Fuel {Math.round(point.fuelLevel)}%</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No telemetry has been recorded for this trip yet.</p>
        )}
      </section>
    </div>
  )
}
