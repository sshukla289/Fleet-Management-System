import type { Driver } from '../types'

function driverStatusClass(status: Driver['status']) {
  if (status === 'On Duty') {
    return 'badge badge--online'
  }

  if (status === 'Resting') {
    return 'badge badge--scheduled'
  }

  return 'badge'
}

interface DriverCardProps {
  driver: Driver
  highlighted?: boolean
  onEdit?: (driver: Driver) => void
  onDelete?: (driver: Driver) => void
  isDeleting?: boolean
}

export function DriverCard({
  driver,
  highlighted = false,
  onEdit,
  onDelete,
  isDeleting = false,
}: DriverCardProps) {
  function handleMessageDriver() {
    const driverMailbox = `${driver.id.toLowerCase()}@fleetcontrol.dev`
    window.location.href = `mailto:${driverMailbox}?subject=Fleet%20update%20for%20${encodeURIComponent(driver.name)}`
  }

  return (
    <article className={`driver-card card${highlighted ? ' card--highlighted' : ''}`}>
      <div className="driver-card__header">
        <div>
          <h3>{driver.name}</h3>
          <p className="muted">{driver.id}</p>
        </div>
        <span className={driverStatusClass(driver.status)}>{driver.status}</span>
      </div>
      <div className="driver-card__meta">
        <span className="badge">{driver.licenseType}</span>
        <span className="badge">{driver.hoursDrivenToday}h today</span>
      </div>
      <div className="driver-card__footer">
        <div className="muted">
          Assigned vehicle {driver.assignedVehicleId ?? 'Unassigned'}
        </div>
        <div className="card-actions">
          {onEdit ? (
            <button className="secondary-button" disabled={isDeleting} onClick={() => onEdit(driver)} type="button">
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-busy={isDeleting}
              aria-label={isDeleting ? 'Deleting...' : 'Delete'}
              className={`secondary-button danger-button loading-button${isDeleting ? ' is-loading' : ''}`}
              disabled={isDeleting}
              onClick={() => onDelete(driver)}
              type="button"
            >
              <span aria-hidden="true" className="loading-button__content">
                <span className="loading-button__label loading-button__label--default">Delete</span>
                <span className="loading-button__label loading-button__label--active">Deleting...</span>
              </span>
            </button>
          ) : null}
          <button className="secondary-button" disabled={isDeleting} onClick={handleMessageDriver} type="button">
            Message
          </button>
        </div>
      </div>
    </article>
  )
}
