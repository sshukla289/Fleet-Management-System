import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { LiveFleetMap } from '../components/LiveFleetMap'
import { useAuth } from '../context/useAuth'
import {
  fetchAlerts,
  fetchAuditLogs,
  fetchDashboardAnalytics,
  fetchDrivers,
  fetchMaintenanceSchedules,
  fetchTrips,
  fetchVehicleTelemetry,
  fetchVehicles,
} from '../services/apiService'
import { useAppDispatch } from '../store/hooks'
import { setDashboardSnapshot } from '../store/adminDashboardSlice'
import type {
  AdminDashboardActivity,
  AdminDashboardLiveVehicle,
  Alert,
  AlertSeverity,
  AuditLogEntry,
  DashboardAnalytics,
  DashboardResource,
  Driver,
  MaintenanceSchedule,
  Trip,
  Vehicle,
} from '../types'
import './AdminDashboard.css'

type TrendDirection = 'up' | 'down' | 'flat'

interface TrendState {
  direction: TrendDirection
  delta: number
  tone: 'positive' | 'negative' | 'neutral'
}

interface MetricSnapshot {
  activeTrips: number
  activeDrivers: number
  vehiclesInUse: number
  criticalAlerts: number
}

let latestMetricSnapshot: MetricSnapshot | null = null

interface CoreDashboardData {
  dashboardStats: DashboardAnalytics | null
  vehicles: Vehicle[]
  drivers: Driver[]
  trips: Trip[]
  alerts: Alert[]
  maintenanceSchedules: MaintenanceSchedule[]
  auditLogs: AuditLogEntry[]
  fetchErrors: string[]
}

interface KpiCardProps {
  label: string
  value: string
  note: string
  accent: string
  icon: ReactNode
  trend: TrendState
}

interface ActionCardProps {
  title: string
  description: string
  accent: string
  icon: ReactNode
  onClick: () => void
}

interface FeedItemProps {
  activity: AdminDashboardActivity
  onOpen: () => void
}

const ACTIVE_TRIP_STATUSES: Trip['status'][] = ['DISPATCHED', 'IN_PROGRESS']
const OPEN_ALERT_STATUSES: Alert['status'][] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
const ACTIVITY_COLORS = {
  ALERT: '#ef4444',
  TRIP: '#2563eb',
  MAINTENANCE: '#f59e0b',
} as const

function TripGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M15 3v5h5" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </svg>
  )
}

function DriverGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </svg>
  )
}

function UsersGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 21v-1a5.5 5.5 0 0 1 7 0v1" />
    </svg>
  )
}

function VehicleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="14" height="10" rx="2" />
      <path d="M16 10h3l3 3v3h-6z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
}

function AlertGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-12.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function MapGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18 3 21V7l6-3 6 3 6-3v14l-6 3-6-3-6 3" />
      <path d="M9 4v14" />
      <path d="M15 7v14" />
    </svg>
  )
}

function RefreshGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 1-15 6.7" />
      <path d="M3 12a9 9 0 0 1 15-6.7" />
      <path d="M7 18H6v4" />
      <path d="M17 6h1V2" />
    </svg>
  )
}

function ChevronGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function ChartGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16" />
      <path d="M7 15v-5" />
      <path d="M12 15V7" />
      <path d="M17 15v-9" />
    </svg>
  )
}

function SparkGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  )
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function toTitleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatShortTime(value?: string | null) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isActiveTrip(trip: Trip) {
  return ACTIVE_TRIP_STATUSES.includes(trip.status)
}

function isOpenAlert(alert: Alert) {
  return OPEN_ALERT_STATUSES.includes(alert.status)
}

function isOnDuty(status: string) {
  return status.trim().toLowerCase() === 'on duty'
}

function severityWeight(severity: AlertSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return 4
    case 'HIGH':
      return 3
    case 'MEDIUM':
      return 2
    default:
      return 1
  }
}

function inferSeverityFromAction(action: string): AlertSeverity {
  const normalized = action.toUpperCase()

  if (/(BLOCK|FAIL|ALERT|ERROR|CANCEL|OVERDUE|CRITICAL)/.test(normalized)) {
    return 'HIGH'
  }

  if (/(DISPATCH|START|UPDATE|ASSIGN|CREATE|APPROVE|COMPLETE)/.test(normalized)) {
    return 'MEDIUM'
  }

  return 'LOW'
}

function buildTrend(current: number, previous: number | null, inverse = false): TrendState {
  if (previous === null) {
    return { direction: 'flat', delta: 0, tone: 'neutral' }
  }

  const delta = current - previous
  if (delta === 0) {
    return { direction: 'flat', delta, tone: 'neutral' }
  }

  const direction = delta > 0 ? 'up' : 'down'
  const favorable = inverse ? delta < 0 : delta > 0

  return {
    direction,
    delta,
    tone: favorable ? 'positive' : 'negative',
  }
}

function mapAlertToActivity(alert: Alert): AdminDashboardActivity {
  return {
    id: `alert-${alert.id}`,
    type: 'ALERT',
    title: alert.title,
    detail: alert.description,
    timestamp: alert.updatedAt ?? alert.createdAt,
    severity: alert.severity,
    path: '/alerts',
    label: 'Alert',
    sourceId: alert.relatedTripId ?? alert.relatedVehicleId ?? alert.id,
  }
}

function mapMaintenanceToActivity(schedule: MaintenanceSchedule): AdminDashboardActivity {
  const severity: AlertSeverity =
    schedule.blockDispatch || schedule.status === 'IN_PROGRESS' ? 'HIGH' : 'MEDIUM'

  return {
    id: `maintenance-${schedule.id}`,
    type: 'MAINTENANCE',
    title: schedule.title,
    detail:
      schedule.notes ??
      (schedule.blockDispatch
        ? 'Dispatch is blocked until the maintenance schedule is cleared.'
        : 'Maintenance item is awaiting review.'),
    timestamp: schedule.updatedAt ?? schedule.createdAt,
    severity,
    path: '/maintenance',
    label: schedule.blockDispatch ? 'Dispatch block' : 'Maintenance',
    sourceId: schedule.vehicleId,
  }
}

function mapAuditToActivity(log: AuditLogEntry): AdminDashboardActivity | null {
  const isTripRelated = /TRIP/i.test(log.entityType) || /TRIP/i.test(log.action)
  if (!isTripRelated) {
    return null
  }

  return {
    id: `trip-${log.id}`,
    type: 'TRIP',
    title: toTitleCase(log.action),
    detail: log.summary,
    timestamp: log.createdAt,
    severity: inferSeverityFromAction(log.action),
    path: log.entityId ? `/trips?highlight=${encodeURIComponent(log.entityId)}` : '/trips',
    label: 'Trip update',
    sourceId: log.entityId,
  }
}

function buildRecentActivities(
  alerts: Alert[],
  maintenanceSchedules: MaintenanceSchedule[],
  auditLogs: AuditLogEntry[],
) {
  const tripActivities = auditLogs
    .map(mapAuditToActivity)
    .filter((activity): activity is AdminDashboardActivity => Boolean(activity))

  return [
    ...alerts.filter(isOpenAlert).map(mapAlertToActivity),
    ...maintenanceSchedules.map(mapMaintenanceToActivity),
    ...tripActivities,
  ]
    .sort((left, right) => {
      const timestampDelta = new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      if (timestampDelta !== 0) {
        return timestampDelta
      }

      return severityWeight(right.severity) - severityWeight(left.severity)
    })
    .slice(0, 12)
}

function buildLiveVehicles(
  vehicles: Vehicle[],
  drivers: Driver[],
  trips: Trip[],
  telemetryByVehicleId: Map<string, Awaited<ReturnType<typeof fetchVehicleTelemetry>>>,
  generatedAt?: string | null,
): AdminDashboardLiveVehicle[] {
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]))
  const activeTripsByVehicle = new Map(
    trips
      .filter(isActiveTrip)
      .map((trip) => [trip.assignedVehicleId, trip]),
  )

  return vehicles
    .filter((vehicle) => vehicle.status === 'Active')
    .map((vehicle) => {
      const telemetry = telemetryByVehicleId.get(vehicle.id) ?? []
      const latest = telemetry[telemetry.length - 1]
      const driver = driversById.get(vehicle.driverId)
      const trip = activeTripsByVehicle.get(vehicle.id)

      return {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        vehicleType: vehicle.type,
        vehicleStatus: vehicle.status,
        driverId: vehicle.driverId,
        driverName: driver?.name ?? vehicle.driverId ?? 'Unassigned',
        tripId: trip?.tripId ?? null,
        tripStatus: trip?.status ?? 'IDLE',
        latitude: latest?.latitude ?? null,
        longitude: latest?.longitude ?? null,
        speed: latest?.speed ?? 0,
        fuelLevel: latest?.fuelLevel ?? vehicle.fuelLevel,
        location: vehicle.location,
        lastUpdated: latest?.timestamp ?? generatedAt ?? new Date().toISOString(),
        telemetryCount: telemetry.length,
        hasPosition: Boolean(latest && Number.isFinite(latest.latitude) && Number.isFinite(latest.longitude)),
      }
    })
}

function fallbackBlockedVehicles(vehicles: Vehicle[]): DashboardResource[] {
  return vehicles
    .filter((vehicle) => vehicle.status === 'Maintenance')
    .slice(0, 4)
    .map((vehicle) => ({
      id: vehicle.id,
      title: vehicle.name,
      subtitle: vehicle.location,
      status: 'Maintenance',
      note: 'Vehicle is flagged by operational status.',
      actionPath: `/vehicles/${vehicle.id}`,
    }))
}

function fallbackDriversOnDuty(drivers: Driver[]): DashboardResource[] {
  return drivers
    .filter((driver) => isOnDuty(driver.status))
    .slice(0, 4)
    .map((driver) => ({
      id: driver.id,
      title: driver.name,
      subtitle: driver.licenseType,
      status: driver.status,
      note: driver.assignedVehicleId ? `Vehicle ${driver.assignedVehicleId}` : 'No vehicle assigned',
      actionPath: '/drivers',
    }))
}

function useCommittedMetricSnapshot(snapshot: MetricSnapshot | null) {
  const previousSnapshot = latestMetricSnapshot
  useEffect(() => {
    latestMetricSnapshot = snapshot
  }, [snapshot])

  return previousSnapshot
}

async function loadCoreDashboardData(): Promise<CoreDashboardData> {
  const errors: string[] = []
  const auditWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

  const [dashboardStatsResult, vehiclesResult, driversResult, tripsResult, alertsResult, maintenanceSchedulesResult, auditLogsResult] =
    await Promise.allSettled([
      fetchDashboardAnalytics(),
      fetchVehicles(),
      fetchDrivers(),
      fetchTrips(),
      fetchAlerts(),
      fetchMaintenanceSchedules(),
      fetchAuditLogs({ from: auditWindowStart }),
    ])

  function unwrap<T, F>(result: PromiseSettledResult<T>, fallback: F, label: string): T | F {
    if (result.status === 'fulfilled') {
      return result.value
    }

    errors.push(label)
    return fallback
  }

  return {
    dashboardStats: unwrap(dashboardStatsResult, null, 'dashboard analytics'),
    vehicles: unwrap(vehiclesResult, [], 'vehicles'),
    drivers: unwrap(driversResult, [], 'drivers'),
    trips: unwrap(tripsResult, [], 'trips'),
    alerts: unwrap(alertsResult, [], 'alerts'),
    maintenanceSchedules: unwrap(maintenanceSchedulesResult, [], 'maintenance schedules'),
    auditLogs: unwrap(auditLogsResult, [], 'audit logs'),
    fetchErrors: errors,
  }
}

function KpiCard({ label, value, note, accent, icon, trend }: KpiCardProps) {
  const trendLabel =
    trend.direction === 'flat'
      ? '→ 0'
      : `${trend.direction === 'up' ? '↑' : '↓'} ${Math.abs(trend.delta)}`

  return (
    <article className="admin-kpi-card" style={{ ['--kpi-accent' as string]: accent }}>
      <div className="admin-kpi-card__head">
        <div className="admin-kpi-card__icon">{icon}</div>
        <span className={`admin-kpi-card__trend admin-kpi-card__trend--${trend.tone}`}>{trendLabel}</span>
      </div>
      <span className="admin-kpi-card__label">{label}</span>
      <strong className="admin-kpi-card__value">{value}</strong>
      <p className="admin-kpi-card__note">{note}</p>
    </article>
  )
}

function ActionCard({ title, description, accent, icon, onClick }: ActionCardProps) {
  return (
    <button
      className="admin-action-card"
      style={{
        ['--action-accent' as string]: accent,
        ['--action-accent-soft' as string]: `${accent}1A`,
        ['--action-accent-border' as string]: `${accent}33`,
      }}
      onClick={onClick}
      type="button"
    >
      <span className="admin-action-card__icon">{icon}</span>
      <span className="admin-action-card__copy">
        <strong className="admin-action-card__title">{title}</strong>
        <span className="admin-action-card__desc">{description}</span>
      </span>
      <span className="admin-action-card__arrow">
        <ChevronGlyph />
      </span>
    </button>
  )
}

function FeedItem({ activity, onOpen }: FeedItemProps) {
  return (
    <article className={`admin-feed-item admin-feed-item--${activity.type.toLowerCase()}`}>
      <span className="admin-feed-item__rail" style={{ ['--feed-accent' as string]: ACTIVITY_COLORS[activity.type] }} />
      <div className="admin-feed-item__body">
        <div className="admin-feed-item__head">
          <div className="admin-feed-item__head-copy">
            <span className="admin-feed-item__eyebrow">{activity.label}</span>
            <strong className="admin-feed-item__title">{activity.title}</strong>
          </div>
          <span className={`admin-severity-pill admin-severity-pill--${activity.severity.toLowerCase()}`}>
            {activity.severity}
          </span>
        </div>
        <p className="admin-feed-item__detail">{activity.detail}</p>
        <div className="admin-feed-item__meta">
          <span>{formatDateTime(activity.timestamp)}</span>
          <span>{activity.sourceId || 'Global'}</span>
        </div>
      </div>
      <button className="admin-feed-item__button" onClick={onOpen} type="button">
        Open
      </button>
    </article>
  )
}

function AdminDashboardSkeleton() {
  return (
    <div className="admin-dashboard admin-dashboard--loading">
      <section className="admin-dashboard__hero">
        <div className="admin-dashboard__hero-grid">
          <div className="admin-dashboard__hero-copy">
            <div className="admin-skeleton admin-skeleton--line admin-skeleton--wide" />
            <div className="admin-skeleton admin-skeleton--title" />
            <div className="admin-skeleton admin-skeleton--line admin-skeleton--medium" />
            <div className="admin-skeleton admin-skeleton--chip-row">
              <span className="admin-skeleton admin-skeleton--chip" />
              <span className="admin-skeleton admin-skeleton--chip" />
              <span className="admin-skeleton admin-skeleton--chip" />
            </div>
          </div>
          <div className="admin-dashboard__hero-card">
            <div className="admin-skeleton admin-skeleton--line admin-skeleton--medium" />
            <div className="admin-skeleton admin-skeleton--hero-metric" />
            <div className="admin-skeleton admin-skeleton--progress" />
            <div className="admin-skeleton admin-skeleton--line admin-skeleton--small" />
          </div>
        </div>
      </section>

      <section className="admin-dashboard__kpis">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="admin-skeleton admin-skeleton--kpi" />
        ))}
      </section>

      <div className="admin-dashboard__grid">
        <div className="admin-dashboard__stack">
          <div className="admin-panel">
            <div className="admin-skeleton admin-skeleton--panel-header" />
            <div className="admin-skeleton admin-skeleton--map" />
          </div>
          <div className="admin-panel">
            <div className="admin-skeleton admin-skeleton--panel-header" />
            <div className="admin-skeleton admin-skeleton--feed" />
            <div className="admin-skeleton admin-skeleton--feed" />
            <div className="admin-skeleton admin-skeleton--feed" />
          </div>
        </div>
        <div className="admin-dashboard__stack">
          <div className="admin-panel">
            <div className="admin-skeleton admin-skeleton--panel-header" />
            <div className="admin-skeleton admin-skeleton--action" />
            <div className="admin-skeleton admin-skeleton--action" />
            <div className="admin-skeleton admin-skeleton--action" />
          </div>
          <div className="admin-panel">
            <div className="admin-skeleton admin-skeleton--panel-header" />
            <div className="admin-skeleton admin-skeleton--chart" />
          </div>
          <div className="admin-panel">
            <div className="admin-skeleton admin-skeleton--panel-header" />
            <div className="admin-skeleton admin-skeleton--watchlist" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)

  const coreQuery = useQuery({
    queryKey: ['admin-dashboard', 'core'],
    queryFn: loadCoreDashboardData,
    refetchInterval: 30_000,
  })

  const activeVehicleIds = useMemo(
    () => coreQuery.data?.vehicles.filter((vehicle) => vehicle.status === 'Active').map((vehicle) => vehicle.id) ?? [],
    [coreQuery.data?.vehicles],
  )

  const telemetryQueries = useQueries({
    queries: activeVehicleIds.map((vehicleId) => ({
      queryKey: ['admin-dashboard', 'telemetry', vehicleId],
      queryFn: () => fetchVehicleTelemetry(vehicleId),
      enabled: activeVehicleIds.length > 0,
      refetchInterval: 15_000,
      staleTime: 5_000,
    })),
  })

  const telemetryByVehicleId = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof fetchVehicleTelemetry>>>()
    activeVehicleIds.forEach((vehicleId, index) => {
      map.set(
        vehicleId,
        (telemetryQueries[index]?.data as Awaited<ReturnType<typeof fetchVehicleTelemetry>> | undefined) ?? [],
      )
    })
    return map
  }, [activeVehicleIds, telemetryQueries])

  const liveVehicles = useMemo(
    () =>
      buildLiveVehicles(
        coreQuery.data?.vehicles ?? [],
        coreQuery.data?.drivers ?? [],
        coreQuery.data?.trips ?? [],
        telemetryByVehicleId,
        coreQuery.data?.dashboardStats?.generatedAt,
      ),
    [coreQuery.data?.dashboardStats?.generatedAt, coreQuery.data?.drivers, coreQuery.data?.trips, coreQuery.data?.vehicles, telemetryByVehicleId],
  )

  const positionedVehicles = useMemo(
    () => liveVehicles.filter((vehicle) => vehicle.hasPosition),
    [liveVehicles],
  )

  const recentActivities = useMemo(
    () =>
      buildRecentActivities(
        coreQuery.data?.alerts ?? [],
        coreQuery.data?.maintenanceSchedules ?? [],
        coreQuery.data?.auditLogs ?? [],
      ),
    [coreQuery.data?.alerts, coreQuery.data?.auditLogs, coreQuery.data?.maintenanceSchedules],
  )

  useEffect(() => {
    dispatch(setDashboardSnapshot({
      dashboardStats: coreQuery.data?.dashboardStats ?? null,
      liveVehicles,
      recentActivities,
    }))
  }, [coreQuery.data?.dashboardStats, dispatch, liveVehicles, recentActivities])

  const resolvedSelectedVehicleId = useMemo(() => {
    if (!positionedVehicles.length) {
      return null
    }

    return selectedVehicleId && positionedVehicles.some((vehicle) => vehicle.vehicleId === selectedVehicleId)
      ? selectedVehicleId
      : positionedVehicles[0].vehicleId
  }, [positionedVehicles, selectedVehicleId])

  const selectedVehicle = useMemo(
    () => positionedVehicles.find((vehicle) => vehicle.vehicleId === resolvedSelectedVehicleId) ?? positionedVehicles[0] ?? null,
    [positionedVehicles, resolvedSelectedVehicleId],
  )

  const dashboardStats = coreQuery.data?.dashboardStats
  const activeTripsCount = dashboardStats?.activeTrips ?? coreQuery.data?.trips.filter(isActiveTrip).length ?? 0
  const activeDriversCount = dashboardStats?.driversOnDuty ?? coreQuery.data?.drivers.filter((driver) => isOnDuty(driver.status)).length ?? 0
  const vehiclesInUseCount = liveVehicles.length
  const criticalAlertsCount = dashboardStats?.criticalAlerts ?? coreQuery.data?.alerts.filter((alert) => isOpenAlert(alert) && alert.severity === 'CRITICAL').length ?? 0
  const availableVehiclesCount =
    dashboardStats?.availableVehicles ??
    (coreQuery.data?.vehicles.filter((vehicle) => vehicle.status !== 'Maintenance').length ?? 0)
  const blockedVehiclesCount =
    dashboardStats?.vehiclesInMaintenance ??
    (coreQuery.data?.vehicles.filter((vehicle) => vehicle.status === 'Maintenance').length ?? 0)
  const readinessPercent =
    dashboardStats?.fleetReadinessPercent ??
    (coreQuery.data?.vehicles.length
      ? Math.round((availableVehiclesCount * 1000) / coreQuery.data!.vehicles.length) / 10
      : 0)

  const fetchErrors = coreQuery.data?.fetchErrors ?? []
  const currentSnapshot = useMemo<MetricSnapshot>(
    () => ({
      activeTrips: activeTripsCount,
      activeDrivers: activeDriversCount,
      vehiclesInUse: vehiclesInUseCount,
      criticalAlerts: criticalAlertsCount,
    }),
    [activeDriversCount, activeTripsCount, criticalAlertsCount, vehiclesInUseCount],
  )
  const previousSnapshot = useCommittedMetricSnapshot(currentSnapshot)
  const trendSnapshot = useMemo<Record<keyof MetricSnapshot, TrendState>>(() => {
    if (!previousSnapshot) {
      return {
        activeTrips: { direction: 'flat', delta: 0, tone: 'neutral' },
        activeDrivers: { direction: 'flat', delta: 0, tone: 'neutral' },
        vehiclesInUse: { direction: 'flat', delta: 0, tone: 'neutral' },
        criticalAlerts: { direction: 'flat', delta: 0, tone: 'neutral' },
      }
    }

    return {
      activeTrips: buildTrend(currentSnapshot.activeTrips, previousSnapshot.activeTrips),
      activeDrivers: buildTrend(currentSnapshot.activeDrivers, previousSnapshot.activeDrivers),
      vehiclesInUse: buildTrend(currentSnapshot.vehiclesInUse, previousSnapshot.vehiclesInUse),
      criticalAlerts: buildTrend(currentSnapshot.criticalAlerts, previousSnapshot.criticalAlerts, true),
    }
  }, [currentSnapshot, previousSnapshot])

  const activityMixData = useMemo(
    () => [
      { name: 'Alerts', value: recentActivities.filter((activity) => activity.type === 'ALERT').length, color: ACTIVITY_COLORS.ALERT },
      { name: 'Trips', value: recentActivities.filter((activity) => activity.type === 'TRIP').length, color: ACTIVITY_COLORS.TRIP },
      { name: 'Maintenance', value: recentActivities.filter((activity) => activity.type === 'MAINTENANCE').length, color: ACTIVITY_COLORS.MAINTENANCE },
    ],
    [recentActivities],
  )

  const delayedTrips = dashboardStats?.delayedTripsSummary ?? []
  const blockedVehicles = dashboardStats?.blockedVehicles?.length ? dashboardStats.blockedVehicles : fallbackBlockedVehicles(coreQuery.data?.vehicles ?? [])
  const driversOnDutySnapshot = dashboardStats?.driversOnDutySnapshot?.length
    ? dashboardStats.driversOnDutySnapshot
    : fallbackDriversOnDuty(coreQuery.data?.drivers ?? [])

  const isInitialLoading = coreQuery.isPending && !coreQuery.data
  const isTelemetryLoading = activeVehicleIds.length > 0 && telemetryQueries.some((query) => query.isPending || query.isFetching)
  const isRefreshing = coreQuery.isFetching && Boolean(coreQuery.data)
  const lastSyncLabel = formatDateTime(dashboardStats?.generatedAt ?? (coreQuery.dataUpdatedAt ? new Date(coreQuery.dataUpdatedAt).toISOString() : null))

  if (isInitialLoading) {
    return <AdminDashboardSkeleton />
  }

  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard__hero">
        <div className="admin-dashboard__hero-grid">
          <div className="admin-dashboard__hero-copy">
            <div className="admin-dashboard__eyebrow">Admin control tower</div>
            <h2 className="admin-dashboard__title">Global visibility across fleet movement, dispatch pressure, and service risk.</h2>
            <p className="admin-dashboard__lede">
              Monitor active trips, live vehicles, operator workload, and critical exceptions from one secure workspace. Data refreshes automatically so the dashboard stays operationally current.
            </p>
            <div className="admin-dashboard__hero-chips">
              <span className="admin-dashboard__chip"><SparkGlyph />{session?.profile.name ?? 'Admin'} · {session?.profile.role ?? 'ADMIN'}</span>
              <span className="admin-dashboard__chip"><RefreshGlyph />Auto sync · 15s telemetry / 30s snapshot</span>
              <span className="admin-dashboard__chip"><ShieldGlyph />Last sync {lastSyncLabel}</span>
            </div>
          </div>

          <div className="admin-dashboard__hero-card">
            <div className="admin-dashboard__hero-card-row">
              <div className="admin-dashboard__hero-card-kpi">
                <span>Fleet readiness</span>
                <strong>{readinessPercent.toFixed(1)}%</strong>
              </div>
              <span className="admin-panel__meta">Operational snapshot</span>
            </div>
            <div className="admin-dashboard__progress" aria-label="Fleet readiness progress">
              <span style={{ width: `${Math.min(100, Math.max(0, readinessPercent))}%` }} />
            </div>
            <div className="admin-dashboard__progress-meta">
              <span>{availableVehiclesCount} available vehicles</span>
              <span>{blockedVehiclesCount} vehicles in maintenance</span>
            </div>
            <div className="admin-dashboard__hero-card-row">
              <div className="admin-dashboard__hero-card-kpi">
                <span>Live telemetry</span>
                <strong>{positionedVehicles.length}/{liveVehicles.length}</strong>
              </div>
              <div className="admin-dashboard__hero-card-kpi">
                <span>Critical alerts</span>
                <strong>{criticalAlertsCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {fetchErrors.length > 0 ? (
        <section className="admin-dashboard__notice">
          <div>
            <strong>Partial refresh</strong>
            <p>{fetchErrors.join(' · ')}</p>
          </div>
          <button className="admin-dashboard__notice-button" onClick={() => void coreQuery.refetch()} type="button">
            Retry
          </button>
        </section>
      ) : null}

      <section className="admin-dashboard__kpis">
        <KpiCard
          accent="#2563eb"
          icon={<TripGlyph />}
          label="Active trips"
          note="Trips currently in motion across the network."
          trend={trendSnapshot.activeTrips}
          value={String(activeTripsCount)}
        />
        <KpiCard
          accent="#0f766e"
          icon={<DriverGlyph />}
          label="Active drivers"
          note="Drivers currently on duty and available for work."
          trend={trendSnapshot.activeDrivers}
          value={String(activeDriversCount)}
        />
        <KpiCard
          accent="#f59e0b"
          icon={<VehicleGlyph />}
          label="Vehicles in use"
          note="Fleet units carrying live telemetry or assigned trips."
          trend={trendSnapshot.vehiclesInUse}
          value={String(vehiclesInUseCount)}
        />
        <KpiCard
          accent="#ef4444"
          icon={<AlertGlyph />}
          label="Critical alerts"
          note="Open incidents requiring immediate admin attention."
          trend={trendSnapshot.criticalAlerts}
          value={String(criticalAlertsCount)}
        />
      </section>

      <div className="admin-dashboard__grid">
        <div className="admin-dashboard__stack">
          <article className="admin-panel admin-panel--map">
            <div className="admin-panel__header">
              <div>
                <span className="admin-panel__eyebrow">Live map</span>
                <h3 className="admin-panel__title">Active vehicle visibility</h3>
                <p className="admin-panel__subtitle">
                  Clustered OpenStreetMap pins with driver, trip, status, and live telemetry popups.
                </p>
              </div>
              <span className="admin-panel__meta">
                <MapGlyph />
                {positionedVehicles.length} mapped · {liveVehicles.length} active
              </span>
            </div>
            <LiveFleetMap
              isLoading={isTelemetryLoading}
              onSelectVehicle={setSelectedVehicleId}
              selectedVehicleId={resolvedSelectedVehicleId}
              vehicles={liveVehicles}
            />
            <div className="admin-map-spotlight">
              {selectedVehicle ? (
                <>
                  <div className="admin-map-spotlight__copy">
                    <span>Selected vehicle</span>
                    <strong>{selectedVehicle.vehicleName}</strong>
                    <p>
                      {selectedVehicle.driverName} · Trip {selectedVehicle.tripId ?? 'No active trip'} · {selectedVehicle.tripStatus}
                    </p>
                  </div>
                  <div className="admin-map-spotlight__metrics">
                    <div>
                      <span>Speed</span>
                      <strong>{selectedVehicle.speed.toFixed(1)} km/h</strong>
                    </div>
                    <div>
                      <span>Fuel</span>
                      <strong>{Math.round(selectedVehicle.fuelLevel)}%</strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>{formatShortTime(selectedVehicle.lastUpdated)}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="admin-map-spotlight__copy">
                  <span>Selected vehicle</span>
                  <strong>{isTelemetryLoading ? 'Loading live positions…' : 'No pin selected yet'}</strong>
                  <p>Click any marker to inspect driver, trip, and telemetry details.</p>
                </div>
              )}
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-panel__eyebrow">Recent activity</span>
                <h3 className="admin-panel__title">Alerts, trip updates, and maintenance issues</h3>
                <p className="admin-panel__subtitle">The feed blends open incidents, audit-trail trip changes, and maintenance pressure in time order.</p>
              </div>
              <span className="admin-panel__meta">{recentActivities.length} updates</span>
            </div>

            <div className="admin-feed-list">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <FeedItem
                    key={activity.id}
                    activity={activity}
                    onOpen={() => navigate(activity.path)}
                  />
                ))
              ) : (
                <div className="admin-feed-empty">
                  <strong>No recent operational events</strong>
                  <p>Once alerts, trip changes, or maintenance records arrive, they will appear here in real time.</p>
                </div>
              )}
            </div>
          </article>
        </div>

        <div className="admin-dashboard__stack">
          <article className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-panel__eyebrow">Quick actions</span>
                <h3 className="admin-panel__title">Dispatch shortcuts</h3>
                <p className="admin-panel__subtitle">Jump straight into the core workflows used to keep the fleet moving.</p>
              </div>
            </div>
            <div className="admin-action-list">
              <ActionCard
                accent="#2563eb"
                description="Open trip planning and dispatch handoff."
                icon={<TripGlyph />}
                title="Create Trip"
                onClick={() => navigate('/trips')}
              />
              <ActionCard
                accent="#0ea5e9"
                description="Manage accounts, roles, and status without leaving the admin workspace."
                icon={<UsersGlyph />}
                title="Manage Users"
                onClick={() => navigate('/admin/users')}
              />
              <ActionCard
                accent="#0f766e"
                description="Register a new driver and assign a shift."
                icon={<DriverGlyph />}
                title="Add Driver"
                onClick={() => navigate('/drivers')}
              />
              <ActionCard
                accent="#f59e0b"
                description="Add a fleet unit or update vehicle status."
                icon={<VehicleGlyph />}
                title="Add Vehicle"
                onClick={() => navigate('/vehicles')}
              />
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-panel__eyebrow">Priority signals</span>
                <h3 className="admin-panel__title">Activity mix and delay pressure</h3>
                <p className="admin-panel__subtitle">A compact chart showing where the latest operational energy is concentrated.</p>
              </div>
              <span className="admin-panel__meta">
                <ChartGlyph />
                {recentActivities.length} events
              </span>
            </div>

            <div className="admin-chart-block">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '14px',
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                      boxShadow: '0 18px 30px rgba(15, 23, 42, 0.14)',
                    }}
                  />
                  <Pie
                    data={activityMixData}
                    dataKey="value"
                    innerRadius={62}
                    outerRadius={86}
                    paddingAngle={3}
                  >
                    {activityMixData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="admin-chart-legend">
                {activityMixData.map((entry) => (
                  <div key={entry.name} className="admin-chart-legend__item">
                    <span className="admin-chart-legend__swatch" style={{ background: entry.color }} />
                    <div>
                      <strong>{entry.name}</strong>
                      <p>{entry.value} updates</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-delay-list">
              <div className="admin-delay-list__head">
                <strong>Delayed trips</strong>
                <span>{delayedTrips.length}</span>
              </div>
              {delayedTrips.length > 0 ? (
                delayedTrips.slice(0, 4).map((trip) => (
                  <div key={trip.tripId} className="admin-delay-list__row">
                    <div>
                      <strong>{trip.tripId}</strong>
                      <p>
                        {trip.vehicleId} · {trip.driverId}
                      </p>
                    </div>
                    <span>{trip.minutesLate} min late</span>
                  </div>
                ))
              ) : (
                <p className="admin-delay-list__empty">No delayed trips are currently active.</p>
              )}
            </div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <span className="admin-panel__eyebrow">Watchlist</span>
                <h3 className="admin-panel__title">Blocked vehicles and on-duty crew</h3>
                <p className="admin-panel__subtitle">Operational watchlist built from backend readiness and duty snapshots.</p>
              </div>
            </div>
            <div className="admin-watchlist">
              <div className="admin-watchlist__group">
                <div className="admin-watchlist__group-head">
                  <strong>Blocked vehicles</strong>
                  <span>{blockedVehicles.length}</span>
                </div>
                <div className="admin-watchlist__rows">
                  {blockedVehicles.length > 0 ? (
                    blockedVehicles.map((item) => (
                      <button key={item.id} className="admin-watchlist__row" onClick={() => navigate(item.actionPath)} type="button">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.subtitle}</p>
                        </div>
                        <span>{item.status}</span>
                      </button>
                    ))
                  ) : (
                    <p className="admin-watchlist__empty">No blocked vehicles detected.</p>
                  )}
                </div>
              </div>

              <div className="admin-watchlist__group">
                <div className="admin-watchlist__group-head">
                  <strong>Drivers on duty</strong>
                  <span>{driversOnDutySnapshot.length}</span>
                </div>
                <div className="admin-watchlist__rows">
                  {driversOnDutySnapshot.length > 0 ? (
                    driversOnDutySnapshot.map((item) => (
                      <button key={item.id} className="admin-watchlist__row" onClick={() => navigate(item.actionPath)} type="button">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.subtitle}</p>
                        </div>
                        <span>{item.status}</span>
                      </button>
                    ))
                  ) : (
                    <p className="admin-watchlist__empty">No drivers are on duty right now.</p>
                  )}
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      {isRefreshing ? <div className="admin-dashboard__sync-indicator">Refreshing live control data...</div> : null}
    </div>
  )
}
