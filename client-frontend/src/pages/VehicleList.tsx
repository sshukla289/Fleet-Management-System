import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { VehicleCard } from '../components/VehicleCard'
import { useAuth } from '../context/useAuth'
import { canManageVehicles } from '../security/permissions'
import { createVehicle, deleteVehicle, fetchVehicles, updateVehicle } from '../services/apiService'
import type { CreateVehicleInput, Vehicle } from '../types'

const initialForm: CreateVehicleInput = {
  name: '',
  type: 'Heavy Truck',
  status: 'Active',
  location: '',
  fuelLevel: 50,
  mileage: 0,
  driverId: '',
}

const vehicleStatusFilters: Array<{ label: string; value: 'All' | Vehicle['status'] }> = [
  { label: 'All', value: 'All' },
  { label: 'Active', value: 'Active' },
  { label: 'Rest', value: 'Idle' },
  { label: 'Maintenance', value: 'Maintenance' },
]

function formatVehicleNumericInput(value: string, options?: { maxValue?: number }) {
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

  if (typeof options?.maxValue === 'number' && parsedValue > options.maxValue) {
    return String(options.maxValue)
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

function statusTone(status: Vehicle['status']) {
  if (status === 'Active') return 'badge badge--active'
  if (status === 'Idle') return 'badge badge--idle'
  return 'badge badge--maintenance'
}

function statusLabel(status: Vehicle['status']) {
  return status === 'Idle' ? 'Rest' : status
}

export function VehicleList() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | Vehicle['status']>('All')
  const [showForm, setShowForm] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null)
  const [fuelLevelInput, setFuelLevelInput] = useState('50')
  const [mileageInput, setMileageInput] = useState('0')
  const [form, setForm] = useState<CreateVehicleInput>(initialForm)
  const [error, setError] = useState('')
  const query = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const canManage = canManageVehicles(session?.profile.role)

  useEffect(() => {
    void fetchVehicles().then((vehicleData) => {
      setVehicles(vehicleData)
      if (vehicleData[0]) {
        setSelectedVehicleId(vehicleData[0].id)
      }
    })
  }, [])

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const matchesQuery =
          !query ||
          vehicle.id.toLowerCase().includes(query) ||
          vehicle.name.toLowerCase().includes(query) ||
          vehicle.location.toLowerCase().includes(query) ||
          (vehicle.driverId ?? '').toLowerCase().includes(query)
        const matchesStatus = statusFilter === 'All' || vehicle.status === statusFilter
        return matchesQuery && matchesStatus
      }),
    [query, statusFilter, vehicles],
  )

  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    filteredVehicles[0] ??
    vehicles[0]

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'Active').length
  const idleVehicles = vehicles.filter((vehicle) => vehicle.status === 'Idle').length
  const serviceVehicles = vehicles.filter((vehicle) => vehicle.status === 'Maintenance').length
  const lowFuelVehicles = vehicles.filter((vehicle) => vehicle.fuelLevel < 40).length
  const averageFuelLevel = vehicles.length
    ? Math.round(vehicles.reduce((sum, vehicle) => sum + vehicle.fuelLevel, 0) / vehicles.length)
    : 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const parsedFuelLevel = Number(fuelLevelInput)
    if (
      !fuelLevelInput.trim() ||
      Number.isNaN(parsedFuelLevel) ||
      parsedFuelLevel < 0 ||
      parsedFuelLevel > 100
    ) {
      setError('Fuel level must be a valid percentage between 0 and 100.')
      return
    }

    const parsedMileage = Number(mileageInput)
    if (!mileageInput.trim() || Number.isNaN(parsedMileage) || parsedMileage < 0) {
      setError('Mileage must be a valid non-negative number.')
      return
    }

    const nextForm = {
      ...form,
      fuelLevel: parsedFuelLevel,
      mileage: parsedMileage,
    }

    try {
      if (editingVehicleId) {
        const updatedVehicle = await updateVehicle(editingVehicleId, nextForm)
        setVehicles((current) =>
          current.map((vehicle) => (vehicle.id === updatedVehicle.id ? updatedVehicle : vehicle)),
        )
        setSelectedVehicleId(updatedVehicle.id)
      } else {
        const createdVehicle = await createVehicle(nextForm)
        setVehicles((current) => [...current, createdVehicle])
        setSelectedVehicleId(createdVehicle.id)
      }

      resetForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save vehicle.')
    }
  }

  async function handleDelete(vehicle: Vehicle) {
    setError('')
    setDeletingVehicleId(vehicle.id)

    try {
      await deleteVehicle(vehicle.id)
      setVehicles((current) => {
        const remainingVehicles = current.filter((item) => item.id !== vehicle.id)
        if (selectedVehicleId === vehicle.id) {
          setSelectedVehicleId(remainingVehicles[0]?.id ?? '')
        }

        return remainingVehicles
      })
      if (editingVehicleId === vehicle.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete vehicle.')
    } finally {
      setDeletingVehicleId((current) => (current === vehicle.id ? null : current))
    }
  }

  function handleEdit(vehicle: Vehicle) {
    setForm({
      name: vehicle.name,
      type: vehicle.type,
      status: vehicle.status,
      location: vehicle.location,
      fuelLevel: vehicle.fuelLevel,
      mileage: vehicle.mileage,
      driverId: vehicle.driverId,
    })
    setFuelLevelInput(formatVehicleNumericInput(String(vehicle.fuelLevel), { maxValue: 100 }))
    setMileageInput(formatVehicleNumericInput(String(vehicle.mileage)))
    setEditingVehicleId(vehicle.id)
    setSelectedVehicleId(vehicle.id)
    setShowForm(true)
    setError('')
  }

  function resetForm() {
    setForm(initialForm)
    setFuelLevelInput(formatVehicleNumericInput(String(initialForm.fuelLevel), { maxValue: 100 }))
    setMileageInput(formatVehicleNumericInput(String(initialForm.mileage)))
    setEditingVehicleId(null)
    setShowForm(false)
    setError('')
  }

  const selectedVehicleRouteStops = selectedVehicle
    ? [
        selectedVehicle.location,
        `${selectedVehicle.id} relay`,
        `${selectedVehicle.driverId} handoff`,
        'Destination bay',
      ]
    : []
  return (
    <div className="page vehicle-tracking-page">
      <section className="vehicle-tracking-shell">
        <aside className="vehicle-tracking-sidebar">
          <div className="vehicle-tracking-sidebar__brand">
            <img src="/logo.svg" alt="Express Logistics Logo" style={{ width: '44px', height: 'auto', borderRadius: '8px' }} />
            <div>
              <span className="vehicle-tracking-sidebar__eyebrow">Express Logistics</span>
              <h2>Tracking</h2>
              <p>Live fleet units, route readiness, and service status.</p>
            </div>
          </div>

          <div className="vehicle-tracking-filters">
            <span className="vehicle-tracking-filters__label">Filter by status</span>
            <div className="vehicle-tracking-filters__chips">
              {vehicleStatusFilters.map((filter) => (
                <button
                  key={filter.value}
                  className={`vehicle-tracking-filter${statusFilter === filter.value ? ' is-active' : ''}`}
                  onClick={() => setStatusFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {query ? (
            <div className="vehicle-tracking-search">
              <div>
                <strong>Search results</strong>
                <p className="muted">
                  Showing {filteredVehicles.length} result{filteredVehicles.length === 1 ? '' : 's'} for "
                  {searchParams.get('q')}"
                </p>
              </div>
              <button className="secondary-button" onClick={() => setSearchParams({})} type="button">
                Clear search
              </button>
            </div>
          ) : null}

          <div className="vehicle-tracking-stats">
            <div>
              <span>Total fleet</span>
              <strong>{vehicles.length}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{activeVehicles}</strong>
            </div>
            <div>
              <span>Rest</span>
              <strong>{idleVehicles}</strong>
            </div>
            <div>
              <span>Service bay</span>
              <strong>{serviceVehicles}</strong>
            </div>
            <div>
              <span>Avg fuel</span>
              <strong>{averageFuelLevel}%</strong>
            </div>
            <div>
              <span>Low fuel</span>
              <strong>{lowFuelVehicles}</strong>
            </div>
          </div>

          <div className="vehicle-tracking-list">
            {filteredVehicles.length ? (
              filteredVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  onSelect={(selectedVehicleItem) => setSelectedVehicleId(selectedVehicleItem.id)}
                  selected={vehicle.id === selectedVehicleId}
                  variant="tracking"
                  vehicle={vehicle}
                />
              ))
            ) : (
              <div className="vehicle-tracking-empty">No vehicles matched this filter.</div>
            )}
          </div>

          <button
            className="vehicle-tracking-create"
            onClick={() => {
              if (!canManage) {
                return
              }
              if (showForm) {
                resetForm()
              } else {
                setShowForm(true)
                setEditingVehicleId(null)
                setError('')
              }
            }}
            type="button"
            disabled={!canManage}
          >
            {canManage ? (showForm ? 'Close vehicle form' : 'Create vehicle') : 'Read-only access'}
          </button>
        </aside>

        <main className="vehicle-tracking-main">
          <section className="vehicle-tracking-hero">
            <div>
              <span className="vehicle-tracking-hero__eyebrow">Vehicle tracking</span>
              <h1>{selectedVehicle?.name ?? 'Select a vehicle'}</h1>
              <p>
                {selectedVehicle
                  ? `${selectedVehicle.id} - ${selectedVehicle.type} - ${selectedVehicle.location}`
                  : 'Pick a vehicle from the board to inspect route, fuel, and assignment details.'}
              </p>
            </div>
            <div className="vehicle-tracking-hero__actions">
              <button className="secondary-button" disabled={!canManage} onClick={() => selectedVehicle && canManage && handleEdit(selectedVehicle)} type="button">
                Edit vehicle
              </button>
              <button
                className="secondary-button danger-button"
                disabled={!canManage || !selectedVehicle || deletingVehicleId === selectedVehicle.id}
                onClick={() => selectedVehicle && canManage && handleDelete(selectedVehicle)}
                type="button"
              >
                Delete
              </button>
            </div>
          </section>

          <div className="vehicle-tracking-tabs" aria-label="Vehicle sections">
            {['Shipping info', 'Vehicle data', 'Documents', 'Company', 'Billing'].map((tab, index) => (
              <span key={tab} className={`vehicle-tracking-tab${index === 0 ? ' is-active' : ''}`}>
                {tab}
              </span>
            ))}
          </div>

          {showForm && canManage ? (
            <form className="vehicle-tracking-form" onSubmit={handleSubmit}>
              <div className="vehicle-tracking-form__header">
                <div>
                  <span className="vehicle-tracking-hero__eyebrow">Fleet editor</span>
                  <h3>{editingVehicleId ? `Edit ${editingVehicleId}` : 'Add a vehicle'}</h3>
                  <p>Update the live fleet inventory and keep the tracking board in sync.</p>
                </div>
              </div>
              <div className="form-grid">
                <label className="input-group">
                  <span>Name</span>
                  <input
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                    type="text"
                    value={form.name}
                  />
                </label>
                <label className="input-group">
                  <span>Type</span>
                  <input
                    onChange={(event) => setForm({ ...form, type: event.target.value })}
                    required
                    type="text"
                    value={form.type}
                  />
                </label>
                <label className="input-group">
                  <span>Status</span>
                  <select
                    onChange={(event) => setForm({ ...form, status: event.target.value as Vehicle['status'] })}
                    value={form.status}
                  >
                    <option value="Active">Active</option>
                    <option value="Idle">Rest</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </label>
                <label className="input-group">
                  <span>Location</span>
                  <input
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    required
                    type="text"
                    value={form.location}
                  />
                </label>
                <label className="input-group">
                  <span>Fuel level (%)</span>
                  <input
                    max="100"
                    min="0"
                    onChange={(event) =>
                      setFuelLevelInput(formatVehicleNumericInput(event.target.value, { maxValue: 100 }))
                    }
                    required
                    step="0.01"
                    type="number"
                    value={fuelLevelInput}
                  />
                </label>
                <label className="input-group">
                  <span>Mileage</span>
                  <input
                    min="0"
                    onChange={(event) => setMileageInput(formatVehicleNumericInput(event.target.value))}
                    required
                    step="0.01"
                    type="number"
                    value={mileageInput}
                  />
                </label>
                <label className="input-group">
                  <span>Driver ID</span>
                  <input
                    onChange={(event) => setForm({ ...form, driverId: event.target.value })}
                    required
                    type="text"
                    value={form.driverId}
                  />
                </label>
              </div>
              {error ? <div className="form-error">{error}</div> : null}
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  {editingVehicleId ? 'Save changes' : 'Save vehicle'}
                </button>
                <button className="secondary-button" onClick={resetForm} type="button">
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {selectedVehicle ? (
            <section className="vehicle-tracking-detail-grid">
              <article className="vehicle-tracking-panel vehicle-tracking-panel--truck">
                <div className="vehicle-tracking-panel__header">
                  <div>
                    <span className="vehicle-tracking-hero__eyebrow">Current truck capacity</span>
                    <h3>Fleet readiness</h3>
                  </div>
                  <span className={statusTone(selectedVehicle.status)}>{statusLabel(selectedVehicle.status)}</span>
                </div>
                <div className="vehicle-tracking-truck">
                  <div className="vehicle-tracking-truck__label">
                    <span>Capacity</span>
                    <strong>{selectedVehicle.fuelLevel}%</strong>
                  </div>
                  <div className="vehicle-tracking-truck__body">
                    <div
                      className="vehicle-tracking-truck__fill"
                      style={{ width: `${Math.max(18, selectedVehicle.fuelLevel)}%` }}
                    />
                  </div>
                  <div className="vehicle-tracking-truck__info">
                    <span>{selectedVehicle.type}</span>
                    <span>{selectedVehicle.mileage.toLocaleString()} km</span>
                  </div>
                </div>
                <div className="vehicle-tracking-mini-grid">
                  <div>
                    <span>Fuel</span>
                    <strong>{selectedVehicle.fuelLevel}%</strong>
                  </div>
                  <div>
                    <span>Driver</span>
                    <strong>{selectedVehicle.driverId}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>{selectedVehicle.location}</strong>
                  </div>
                </div>
              </article>

              <article className="vehicle-tracking-panel vehicle-tracking-panel--route">
                <div className="vehicle-tracking-panel__header">
                  <div>
                    <span className="vehicle-tracking-hero__eyebrow">Route</span>
                    <h3>Dispatch path</h3>
                  </div>
                  <button className="secondary-button" type="button">
                    Change route
                  </button>
                </div>
                <div className="vehicle-tracking-map">
                  <div className="vehicle-tracking-map__grid" />
                  <div className="vehicle-tracking-map__route" />
                  {selectedVehicleRouteStops.map((stop, index) => (
                    <div
                      key={stop}
                      className={`vehicle-tracking-map__marker vehicle-tracking-map__marker--${index + 1}`}
                      title={stop}
                    />
                  ))}
                </div>
                <div className="vehicle-tracking-route-meta">
                  <span className="badge">{selectedVehicle.id}</span>
                  <span className="badge">Driver {selectedVehicle.driverId}</span>
                  <span className="badge">{selectedVehicle.location}</span>
                </div>
              </article>

              <article className="vehicle-tracking-panel vehicle-tracking-panel--reports">
                <div className="vehicle-tracking-panel__header">
                  <div>
                    <span className="vehicle-tracking-hero__eyebrow">Cargo photo reports</span>
                    <h3>Supporting checks</h3>
                  </div>
                  <span className="badge">4 reports</span>
                </div>
                <div className="vehicle-tracking-report-grid">
                  {['Arrival', 'Loading', 'Inspection', 'Departure'].map((label) => (
                    <div key={label} className="vehicle-tracking-report-card">
                      <span className="vehicle-tracking-report-card__thumb" />
                      <strong>{label}</strong>
                      <p className="muted">Ready for {selectedVehicle.id}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          ) : null}
        </main>
      </section>
    </div>
  )
}
