import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { TelemetryChart } from '../components/TelemetryChart'
import { VehicleCard } from '../components/VehicleCard'
import { fetchDrivers, fetchMaintenanceAlerts, fetchVehicles } from '../services/apiService'
import { fetchVehicleTelemetry, submitVehicleTelemetry } from '../services/telemetryService'
import type { Driver, MaintenanceAlert, TelemetryData, Vehicle } from '../types'

interface TelemetryFormState {
  latitude: string
  longitude: string
  speed: number
  fuelLevel: number
  timestamp: string
}

export function Dashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [telemetryForm, setTelemetryForm] = useState<TelemetryFormState>({
    latitude: '12.9716',
    longitude: '77.5946',
    speed: 84,
    fuelLevel: 18,
    timestamp: '',
  })
  const [isSubmittingTelemetry, setIsSubmittingTelemetry] = useState(false)
  const [telemetryMessage, setTelemetryMessage] = useState('')
  const [telemetryError, setTelemetryError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      const [vehicleData, driverData, alertData] = await Promise.all([
        fetchVehicles(),
        fetchDrivers(),
        fetchMaintenanceAlerts(),
      ])

      setVehicles(vehicleData)
      setDrivers(driverData)
      setAlerts(alertData)

      if (vehicleData[0]) {
        setSelectedVehicleId(vehicleData[0].id)
        const telemetryData = await fetchVehicleTelemetry(vehicleData[0].id)
        setTelemetry(telemetryData)
      }
    }

    void loadDashboard()
  }, [])

  useEffect(() => {
    if (!selectedVehicleId) {
      return
    }

    async function loadVehicleTelemetry() {
      const telemetryData = await fetchVehicleTelemetry(selectedVehicleId)
      setTelemetry(telemetryData)
    }

    void loadVehicleTelemetry()
  }, [selectedVehicleId])

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'Active').length
  const driversOnDuty = drivers.filter((driver) => driver.status === 'On Duty').length

  function handleExportReport() {
    const report = {
      exportedAt: new Date().toISOString(),
      totals: {
        vehicles: vehicles.length,
        activeVehicles,
        drivers: drivers.length,
        driversOnDuty,
        alerts: alerts.length,
      },
      vehicles,
      alerts,
      telemetry,
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'fleet-dashboard-report.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleTelemetryFieldChange(
    field: keyof TelemetryFormState,
    value: string,
  ) {
    setTelemetryForm((current) => ({
      ...current,
      [field]:
        field === 'timestamp' || field === 'latitude' || field === 'longitude'
          ? value
          : value === ''
            ? 0
            : Number(value),
    }))
  }

  async function handleTelemetrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedVehicleId) {
      setTelemetryError('Select a vehicle before sending telemetry.')
      setTelemetryMessage('')
      return
    }

    const parsedLatitude = Number(telemetryForm.latitude)
    const parsedLongitude = Number(telemetryForm.longitude)

    if (!telemetryForm.latitude.trim() || Number.isNaN(parsedLatitude)) {
      setTelemetryError('Latitude must be a valid number.')
      setTelemetryMessage('')
      return
    }

    if (!telemetryForm.longitude.trim() || Number.isNaN(parsedLongitude)) {
      setTelemetryError('Longitude must be a valid number.')
      setTelemetryMessage('')
      return
    }

    setIsSubmittingTelemetry(true)
    setTelemetryError('')
    setTelemetryMessage('')

    try {
      await submitVehicleTelemetry({
        vehicleId: selectedVehicleId,
        ...telemetryForm,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        timestamp: telemetryForm.timestamp || undefined,
      })

      const [updatedTelemetry, updatedAlerts] = await Promise.all([
        fetchVehicleTelemetry(selectedVehicleId),
        fetchMaintenanceAlerts(),
      ])

      setTelemetry(updatedTelemetry)
      setAlerts(updatedAlerts)
      setTelemetryMessage('Telemetry event saved and fleet alerts refreshed.')
    } catch (error) {
      setTelemetryError(error instanceof Error ? error.message : 'Unable to save telemetry event.')
    } finally {
      setIsSubmittingTelemetry(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations overview"
        title="Fleet dashboard"
        description="A command view for vehicle availability, route execution, and upcoming maintenance workload."
        actionLabel="Export report"
        onAction={handleExportReport}
      />

      <section className="hero-panel">
        <div>
          <span className="pill">Live fleet intelligence</span>
          <h1 className="hero-panel__title">Track movement, spot risks, and coordinate the next dispatch.</h1>
          <p className="hero-panel__description">
            Monitor live fleet activity, inspect duty coverage, and export the current operating
            snapshot for dispatch and workshop planning.
          </p>
          <div className="hero-panel__chips">
            <div className="metric-card">
              <span className="muted">Vehicles in service</span>
              <strong>{activeVehicles}/{vehicles.length || 0}</strong>
            </div>
            <div className="metric-card">
              <span className="muted">Drivers on duty</span>
              <strong>{driversOnDuty}</strong>
            </div>
            <div className="metric-card">
              <span className="muted">Open maintenance alerts</span>
              <strong>{alerts.length}</strong>
            </div>
          </div>
        </div>

        <div className="hero-panel__metrics">
          <StatCard
            label="Utilization"
            value={`${vehicles.length ? Math.round((activeVehicles / vehicles.length) * 100) : 0}%`}
            trend="+8% vs yesterday"
          />
          <StatCard
            label="Fuel efficiency"
            value="6.4 km/l"
            trend="Stable in the last 24h"
          />
          <StatCard
            label="On-time departures"
            value="93%"
            trend="+3 scheduled routes"
          />
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Connected vehicles" value={`${vehicles.length}`} trend="Mock API ready" />
        <StatCard label="Driver roster" value={`${drivers.length}`} trend="2 shifts active" />
        <StatCard
          label="Critical alerts"
          value={`${alerts.filter((alert) => alert.severity === 'Critical').length}`}
          trend="Prioritize workshop slots"
        />
      </section>

      {telemetry.length > 0 ? (
        <section className="charts-grid">
          <TelemetryChart data={telemetry} metric="speed" title="Speed profile" />
          <TelemetryChart data={telemetry} metric="fuelUsage" title="Fuel usage trend" />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Live telemetry simulator</h3>
            <p className="muted">
              Send a telemetry reading for a vehicle to update charts and trigger maintenance alerts when thresholds are crossed.
            </p>
          </div>
        </div>

        <form className="inline-form" onSubmit={handleTelemetrySubmit}>
          <div className="form-grid">
            <label className="input-group">
              <span>Vehicle</span>
              <select
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <span>Speed (km/h)</span>
              <input
                type="number"
                min="0"
                value={telemetryForm.speed}
                onChange={(event) => handleTelemetryFieldChange('speed', event.target.value)}
              />
            </label>
            <label className="input-group">
              <span>Fuel level (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={telemetryForm.fuelLevel}
                onChange={(event) => handleTelemetryFieldChange('fuelLevel', event.target.value)}
              />
            </label>
            <label className="input-group">
              <span>Latitude</span>
              <input
                type="number"
                step="0.0001"
                value={telemetryForm.latitude}
                onChange={(event) => handleTelemetryFieldChange('latitude', event.target.value)}
              />
            </label>
            <label className="input-group">
              <span>Longitude</span>
              <input
                type="number"
                step="0.0001"
                value={telemetryForm.longitude}
                onChange={(event) => handleTelemetryFieldChange('longitude', event.target.value)}
              />
            </label>
            <label className="input-group">
              <span>Timestamp</span>
              <input
                type="datetime-local"
                value={telemetryForm.timestamp ?? ''}
                onChange={(event) => handleTelemetryFieldChange('timestamp', event.target.value)}
              />
            </label>
          </div>

          {telemetryError ? <div className="form-error">{telemetryError}</div> : null}
          {telemetryMessage ? <div className="form-success">{telemetryMessage}</div> : null}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isSubmittingTelemetry}>
              {isSubmittingTelemetry ? 'Sending telemetry...' : 'Send telemetry event'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                setTelemetryForm({
                  latitude: '12.9716',
                  longitude: '77.5946',
                  speed: 84,
                  fuelLevel: 18,
                  timestamp: '',
                })
              }
            >
              Reset sample values
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Vehicle spotlight</h3>
            <p className="muted">Sample cards showing how fleet units can be rendered on overview pages.</p>
          </div>
        </div>
        <div className="list-grid">
          {vehicles.slice(0, 3).map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      </section>
    </div>
  )
}
