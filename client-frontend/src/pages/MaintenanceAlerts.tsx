import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import {
  createMaintenanceAlert,
  deleteMaintenanceAlert,
  fetchMaintenanceAlerts,
  fetchVehicles,
  updateMaintenanceAlert,
} from '../services/apiService'
import type {
  CreateMaintenanceAlertInput,
  MaintenanceAlert,
  Vehicle,
} from '../types'

function severityClass(severity: MaintenanceAlert['severity']) {
  if (severity === 'Critical') {
    return 'badge badge--critical'
  }

  if (severity === 'Medium') {
    return 'badge badge--scheduled'
  }

  return 'badge'
}

export function MaintenanceAlerts() {
  const [searchParams] = useSearchParams()
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showForm, setShowForm] = useState(searchParams.get('openCreate') === '1')
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null)
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<CreateMaintenanceAlertInput>({
    vehicleId: searchParams.get('vehicleId') ?? '',
    title: '',
    severity: 'Medium',
    dueDate: '',
    description: '',
  })

  useEffect(() => {
    async function loadMaintenanceData() {
      const [alertData, vehicleData] = await Promise.all([
        fetchMaintenanceAlerts(),
        fetchVehicles(),
      ])

      setAlerts(alertData)
      setVehicles(vehicleData)
      const requestedVehicleId = searchParams.get('vehicleId')
      const preferredVehicleId =
        vehicleData.find((vehicle) => vehicle.id === requestedVehicleId)?.id ??
        vehicleData[0]?.id ??
        ''

      if (preferredVehicleId) {
        setForm((current) => ({ ...current, vehicleId: preferredVehicleId }))
      }
    }

    void loadMaintenanceData()
  }, [searchParams])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    try {
      if (editingAlertId) {
        const updatedAlert = await updateMaintenanceAlert(editingAlertId, form)
        setAlerts((current) => current.map((alert) => (alert.id === updatedAlert.id ? updatedAlert : alert)))
      } else {
        const createdAlert = await createMaintenanceAlert(form)
        setAlerts((current) => [...current, createdAlert])
      }

      resetForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save work order.')
    }
  }

  async function handleDelete(alert: MaintenanceAlert) {
    setError('')
    setDeletingAlertId(alert.id)

    try {
      await deleteMaintenanceAlert(alert.id)
      setAlerts((current) => current.filter((item) => item.id !== alert.id))
      if (editingAlertId === alert.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete alert.')
    } finally {
      setDeletingAlertId((current) => (current === alert.id ? null : current))
    }
  }

  function handleEdit(alert: MaintenanceAlert) {
    setForm({
      vehicleId: alert.vehicleId,
      title: alert.title,
      severity: alert.severity,
      dueDate: alert.dueDate,
      description: alert.description,
    })
    setEditingAlertId(alert.id)
    setShowForm(true)
    setError('')
  }

  function resetForm() {
    setForm({
      vehicleId: vehicles[0]?.id ?? '',
      title: '',
      severity: 'Medium',
      dueDate: '',
      description: '',
    })
    setEditingAlertId(null)
    setShowForm(false)
    setError('')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workshop queue"
        title="Maintenance alerts"
        description="Monitor service priorities and plan workshop capacity using alert severity and due dates."
        actionLabel={showForm ? 'Close form' : 'Create work order'}
        onAction={() => {
          if (showForm) {
            resetForm()
          } else {
            setShowForm(true)
          }
        }}
      />
      {searchParams.get('vehicleId') ? (
        <div className="panel search-summary">
          <div>
            <h3>Service request ready</h3>
            <p className="muted">
              The work order form has been prefilled for vehicle {searchParams.get('vehicleId')}.
            </p>
          </div>
        </div>
      ) : null}
      {showForm ? (
        <form className="panel inline-form" onSubmit={handleSubmit}>
          <div className="panel__header">
            <div>
              <h3>{editingAlertId ? `Edit ${editingAlertId}` : 'Create work order'}</h3>
              <p className="muted">Add or update a maintenance issue in the live workshop queue.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="input-group">
              <span>Vehicle</span>
              <select onChange={(event) => setForm({ ...form, vehicleId: event.target.value })} value={form.vehicleId}>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <span>Title</span>
              <input onChange={(event) => setForm({ ...form, title: event.target.value })} required type="text" value={form.title} />
            </label>
            <label className="input-group">
              <span>Severity</span>
              <select onChange={(event) => setForm({ ...form, severity: event.target.value as MaintenanceAlert['severity'] })} value={form.severity}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="Critical">Critical</option>
              </select>
            </label>
            <label className="input-group">
              <span>Due date</span>
              <input onChange={(event) => setForm({ ...form, dueDate: event.target.value })} required type="date" value={form.dueDate} />
            </label>
            <label className="input-group input-group--full">
              <span>Description</span>
              <textarea onChange={(event) => setForm({ ...form, description: event.target.value })} required value={form.description} />
            </label>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editingAlertId ? 'Save changes' : 'Create alert'}
            </button>
            <button className="secondary-button" onClick={resetForm} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <section className="alert-list">
        {alerts.map((alert) => {
          const vehicle = vehicles.find((item) => item.id === alert.vehicleId)

          return (
            <article key={alert.id} className="alert-item">
              <div className="detail-section__header">
                <div>
                  <h3>{alert.title}</h3>
                  <p className="muted">
                    {alert.vehicleId} | {vehicle?.name ?? 'Unknown vehicle'}
                  </p>
                </div>
                <span className={severityClass(alert.severity)}>{alert.severity}</span>
              </div>
              <p>{alert.description}</p>
              <div className="detail-meta">
                <span className="badge">Due {alert.dueDate}</span>
                <span className="badge">{vehicle?.location ?? 'Location pending'}</span>
              </div>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  disabled={deletingAlertId === alert.id}
                  onClick={() => handleEdit(alert)}
                  type="button"
                >
                  Edit
                </button>
                <button
                  aria-busy={deletingAlertId === alert.id}
                  aria-label={deletingAlertId === alert.id ? 'Deleting...' : 'Delete'}
                  className={`secondary-button danger-button loading-button${deletingAlertId === alert.id ? ' is-loading' : ''}`}
                  disabled={deletingAlertId === alert.id}
                  onClick={() => handleDelete(alert)}
                  type="button"
                >
                  <span aria-hidden="true" className="loading-button__content">
                    <span className="loading-button__label loading-button__label--default">Delete</span>
                    <span className="loading-button__label loading-button__label--active">Deleting...</span>
                  </span>
                </button>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
