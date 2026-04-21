import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { ExecutionStop, ExecutionStopStatus } from '../../types/tripExecution'

interface StopTimelineProps {
  stops: ExecutionStop[]
  currentStopId: string | null
  tripStarted: boolean
  actionInProgress: string | null
  onStopAction: (stopSequence: number, nextStatus: ExecutionStopStatus) => void
}

function getStatusClasses(status: ExecutionStopStatus, active: boolean) {
  if (status === 'COMPLETED') {
    return {
      badge: 'bg-green-50 text-green-700 ring-1 ring-green-200',
      dot: 'bg-green-500 ring-4 ring-green-100',
      line: 'bg-green-200',
      card: 'border-green-200 bg-green-50/40',
    }
  }

  if (status === 'IN_PROGRESS' || active) {
    return {
      badge: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
      dot: 'bg-yellow-400 ring-4 ring-yellow-100',
      line: 'bg-slate-200',
      card: 'border-yellow-200 bg-yellow-50/60',
    }
  }

  return {
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    dot: 'bg-slate-300 ring-4 ring-slate-100',
    line: 'bg-slate-200',
    card: 'border-slate-200 bg-white',
  }
}

function getAction(stop: ExecutionStop, currentStopId: string | null, tripStarted: boolean) {
  if (!tripStarted || stop.id !== currentStopId) {
    return null
  }

  if (stop.status === 'PENDING') {
    return { label: 'Mark In Progress', status: 'IN_PROGRESS' as const, button: 'bg-yellow-500 text-slate-950' }
  }

  if (stop.status === 'IN_PROGRESS') {
    return { label: 'Mark Completed', status: 'COMPLETED' as const, button: 'bg-green-500 text-white' }
  }

  return null
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return null
  }

  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function StopTimeline({
  stops,
  currentStopId,
  tripStarted,
  actionInProgress,
  onStopAction,
}: StopTimelineProps) {
  const activeStopRef = useRef<HTMLDivElement | null>(null)
  const sortedStops = [...stops].sort((left, right) => left.sequence - right.sequence)
  const completedCount = sortedStops.filter((stop) => stop.status === 'COMPLETED').length

  useEffect(() => {
    activeStopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentStopId])

  return (
    <section className="rounded-2xl bg-white p-4 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stop timeline</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Ordered execution flow</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {completedCount}/{sortedStops.length}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {sortedStops.map((stop, index) => {
          const isActive = stop.id === currentStopId
          const styles = getStatusClasses(stop.status, isActive)
          const action = getAction(stop, currentStopId, tripStarted)

          return (
            <motion.div
              key={stop.id}
              ref={isActive ? activeStopRef : undefined}
              layout
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-3"
            >
              <div className="flex w-7 flex-col items-center">
                <span className={`h-4 w-4 rounded-full ${styles.dot}`} />
                {index < sortedStops.length - 1 && <span className={`mt-2 h-full min-h-12 w-0.5 ${styles.line}`} />}
              </div>

              <div className={`flex-1 rounded-2xl border p-4 shadow-sm transition ${styles.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Stop {stop.sequence}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                          Current
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 text-base font-semibold text-slate-900">{stop.name}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{stop.address}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${styles.badge}`}>
                    {stop.status}
                  </span>
                </div>

                {stop.notes && (
                  <div className="mt-3 rounded-2xl bg-slate-950/[0.03] p-3 text-sm text-slate-600">
                    {stop.notes}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {formatTimestamp(stop.arrivedAt) && (
                    <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                      Arrived {formatTimestamp(stop.arrivedAt)}
                    </span>
                  )}
                  {formatTimestamp(stop.completedAt) && (
                    <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-slate-200">
                      Completed {formatTimestamp(stop.completedAt)}
                    </span>
                  )}
                </div>

                {action && (
                  <button
                    type="button"
                    onClick={() => onStopAction(stop.sequence, action.status)}
                    disabled={actionInProgress !== null}
                    className={`mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold shadow-sm transition disabled:cursor-wait disabled:opacity-60 ${action.button}`}
                  >
                    {actionInProgress === `stop-${stop.sequence}` ? 'Updating stop...' : action.label}
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
