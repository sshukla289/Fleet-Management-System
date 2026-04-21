import { motion } from 'framer-motion'
import type { ExecutionTrip } from '../../types/tripExecution'

interface ActionPanelProps {
  trip: ExecutionTrip
  actionInProgress: string | null
  actionError?: string | null
  pauseReason: string
  preTripChecklistComplete: boolean
  postTripChecklistComplete: boolean
  preTripProgressLabel: string
  postTripProgressLabel: string
  onPauseReasonChange: (value: string) => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onComplete: () => void
  mobile?: boolean
}

function ActionButton({
  label,
  tone,
  disabled,
  busy,
  onClick,
}: {
  label: string
  tone: 'primary' | 'success' | 'warning' | 'danger'
  disabled: boolean
  busy: boolean
  onClick: () => void
}) {
  const toneClasses = tone === 'primary'
    ? 'bg-blue-600 text-white'
    : tone === 'success'
      ? 'bg-green-500 text-white'
      : tone === 'warning'
        ? 'bg-yellow-500 text-slate-950'
        : 'bg-red-500 text-white'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 flex-1 items-center justify-center rounded-2xl px-4 text-base font-semibold shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses}`}
    >
      {busy ? 'Processing...' : label}
    </button>
  )
}

export function ActionPanel({
  trip,
  actionInProgress,
  actionError,
  pauseReason,
  preTripChecklistComplete,
  postTripChecklistComplete,
  preTripProgressLabel,
  postTripProgressLabel,
  onPauseReasonChange,
  onStart,
  onPause,
  onResume,
  onComplete,
  mobile = false,
}: ActionPanelProps) {
  const allStopsCompleted = trip.stops.every((stop) => stop.status === 'COMPLETED')
  const busy = actionInProgress !== null
  const tripReadyForPostChecklist = trip.status === 'IN_PROGRESS' || trip.status === 'PAUSED' || trip.status === 'COMPLETED'
  const containerClasses = mobile
    ? 'sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur'
    : 'border-t border-slate-200 bg-white p-4'

  const lifecycleHint = trip.status === 'DISPATCHED'
    ? preTripChecklistComplete
      ? 'Pre-trip checklist is complete. Start the trip when the driver is ready.'
      : 'Complete the pre-trip checklist to unlock trip start.'
    : trip.status === 'IN_PROGRESS'
      ? allStopsCompleted
        ? postTripChecklistComplete
          ? 'All stops are closed and post-trip sign-off is complete.'
          : 'Finish the post-trip checklist to unlock trip completion.'
        : 'Pause anytime. Trip completion unlocks after all stops are closed and post-trip sign-off is done.'
      : trip.status === 'PAUSED'
        ? 'Resume when the vehicle is ready to continue the route.'
        : 'Actions update automatically based on the trip lifecycle.'

  return (
    <motion.div layout className={containerClasses}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trip actions</p>
          <p className="mt-1 text-sm text-slate-600">{lifecycleHint}</p>
        </div>
      </div>

      <div className="mb-3 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Pre-trip checklist</span>
          <span className={preTripChecklistComplete ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
            {preTripProgressLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Post-trip checklist</span>
          <span className={postTripChecklistComplete ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
            {postTripProgressLabel}
          </span>
        </div>
      </div>

      {!tripReadyForPostChecklist && (
        <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Post-trip sign-off becomes available once the trip is underway.
        </div>
      )}

      {actionError && (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {trip.status === 'IN_PROGRESS' && (
        <label className="mb-3 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Pause Note
          </span>
          <input
            type="text"
            value={pauseReason}
            onChange={(event) => onPauseReasonChange(event.target.value)}
            placeholder="Optional pause reason"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
          />
        </label>
      )}

      {trip.status === 'DISPATCHED' && (
        <div className="flex gap-3">
          <ActionButton
            label="Start Trip"
            tone="primary"
            disabled={busy || !preTripChecklistComplete}
            busy={actionInProgress === 'start'}
            onClick={onStart}
          />
        </div>
      )}

      {trip.status === 'IN_PROGRESS' && (
        <div className="flex gap-3">
          <ActionButton
            label="Pause Trip"
            tone="warning"
            disabled={busy}
            busy={actionInProgress === 'pause'}
            onClick={onPause}
          />
          <ActionButton
            label="Complete Trip"
            tone={allStopsCompleted ? 'success' : 'warning'}
            disabled={busy || !allStopsCompleted || !postTripChecklistComplete}
            busy={actionInProgress === 'complete'}
            onClick={onComplete}
          />
        </div>
      )}

      {trip.status === 'PAUSED' && (
        <div className="flex gap-3">
          <ActionButton
            label="Resume Trip"
            tone="primary"
            disabled={busy}
            busy={actionInProgress === 'resume'}
            onClick={onResume}
          />
        </div>
      )}

      {trip.status === 'COMPLETED' && (
        <div className="rounded-2xl bg-green-50 p-4 text-green-800 ring-1 ring-green-200">
          <p className="text-sm font-semibold">Trip completed successfully</p>
          <p className="mt-1 text-sm text-green-700">All stops have been closed and delivery execution is complete.</p>
        </div>
      )}
    </motion.div>
  )
}
