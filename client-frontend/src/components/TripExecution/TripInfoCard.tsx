import { motion } from 'framer-motion'
import type { ExecutionTrip } from '../../types/tripExecution'

interface TripInfoCardProps {
  trip: ExecutionTrip
  compact?: boolean
}

function getStatusClasses(status: ExecutionTrip['status']) {
  switch (status) {
    case 'DISPATCHED':
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    case 'IN_PROGRESS':
      return 'bg-green-50 text-green-700 ring-1 ring-green-200'
    case 'PAUSED':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200'
    case 'COMPLETED':
      return 'bg-slate-900 text-white'
    default:
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  }
}

function formatEta(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function TripInfoCard({ trip, compact = false }: TripInfoCardProps) {
  const completedStops = trip.stops.filter((stop) => stop.status === 'COMPLETED').length
  const progress = trip.stops.length === 0 ? 0 : Math.round((completedStops / trip.stops.length) * 100)

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl bg-white p-4 shadow-md ${compact ? '' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active trip</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{trip.id}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getStatusClasses(trip.status)}`}>
          {trip.status}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white shadow-inner">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
              <path d="M3 7.5h14l4 4v5.5H3z" />
              <path d="M7 7.5V5h7v2.5" />
              <circle cx="7.5" cy="17" r="1.5" />
              <circle cx="17.5" cy="17" r="1.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Route</p>
            <p className="truncate text-sm font-medium">{trip.source}</p>
            <p className="truncate text-sm text-slate-300">to {trip.destination}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vehicle</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{trip.vehicleNumber}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Driver</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{trip.driverName}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">ETA</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{formatEta(trip.eta)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Distance left</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{trip.distanceRemaining.toFixed(1)} km</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Stop completion</p>
            <p className="text-sm text-slate-500">
              {completedStops} of {trip.stops.length} stops completed
            </p>
          </div>
          <span className="text-lg font-semibold text-slate-900">{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full rounded-full bg-blue-600"
          />
        </div>
      </div>

      {trip.status === 'PAUSED' && (
        <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
          <p className="text-sm font-semibold">Trip paused</p>
          <p className="mt-1 text-sm">
            {trip.pausedAt
              ? `Paused at ${new Date(trip.pausedAt).toLocaleString('en-IN')}.`
              : 'Pause time is syncing.'}
          </p>
          {trip.pauseReason && (
            <p className="mt-2 text-sm text-yellow-800">{trip.pauseReason}</p>
          )}
        </div>
      )}
    </motion.section>
  )
}
