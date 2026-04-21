import type { ChecklistType, TripChecklist } from '../../types'
import type { ExecutionTrip } from '../../types/tripExecution'

interface TripChecklistPanelProps {
  trip: ExecutionTrip
  checklists: TripChecklist[]
  selectedType: ChecklistType
  savingType: ChecklistType | null
  saveError?: string | null
  onSelectType: (type: ChecklistType) => void
  onToggleItem: (type: ChecklistType, key: string) => void
}

function checklistLabel(type: ChecklistType) {
  return type === 'PRE' ? 'Pre-trip' : 'Post-trip'
}

function checklistHint(type: ChecklistType) {
  return type === 'PRE'
    ? 'Required before the driver can start the trip.'
    : 'Required before the driver can complete the trip.'
}

function isTripUnderway(status: ExecutionTrip['status']) {
  return status === 'IN_PROGRESS' || status === 'PAUSED' || status === 'COMPLETED'
}

function isStepLocked(type: ChecklistType, trip: ExecutionTrip) {
  return type === 'POST' && !isTripUnderway(trip.status)
}

export function TripChecklistPanel({
  trip,
  checklists,
  selectedType,
  savingType,
  saveError,
  onSelectType,
  onToggleItem,
}: TripChecklistPanelProps) {
  const preChecklist = checklists.find((checklist) => checklist.type === 'PRE')
  const postChecklist = checklists.find((checklist) => checklist.type === 'POST')
  const selectedChecklist = checklists.find((checklist) => checklist.type === selectedType) ?? preChecklist ?? postChecklist ?? null

  const steps: ChecklistType[] = ['PRE', 'POST']

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Driver checklist</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Compliance steps</h2>
          <p className="mt-1 text-sm text-slate-500">Check each item once and it saves immediately.</p>
        </div>
        {selectedChecklist && (
          <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Progress</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {selectedChecklist.items.filter((item) => item.completed).length}/{selectedChecklist.items.length}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {steps.map((type, index) => {
          const checklist = checklists.find((entry) => entry.type === type)
          const completedItems = checklist?.items.filter((item) => item.completed).length ?? 0
          const totalItems = checklist?.items.length ?? 0
          const locked = isStepLocked(type, trip)
          const active = selectedType === type

          return (
            <button
              key={type}
              type="button"
              onClick={() => !locked && onSelectType(type)}
              disabled={locked}
              className={`rounded-3xl border p-4 text-left transition ${
                active
                  ? 'border-blue-300 bg-blue-50 shadow-sm'
                  : locked
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                    : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                  checklist?.completed
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                }`}>
                  {index + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {locked ? 'Locked' : checklist?.completed ? 'Complete' : 'Pending'}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">{checklistLabel(type)}</h3>
              <p className="mt-1 text-sm text-slate-500">{checklistHint(type)}</p>
              <div className="mt-4">
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${checklist?.completed ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${totalItems === 0 ? 0 : (completedItems / totalItems) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {completedItems}/{totalItems} items checked
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {selectedChecklist && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{checklistLabel(selectedChecklist.type)}</h3>
              <p className="mt-1 text-sm text-slate-500">{checklistHint(selectedChecklist.type)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
              selectedChecklist.completed
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {selectedChecklist.completed ? 'Ready' : 'In progress'}
            </span>
          </div>

          {isStepLocked(selectedChecklist.type, trip) ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Post-trip sign-off unlocks once the trip is underway.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {selectedChecklist.items.map((item) => (
                <label
                  key={item.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                    item.completed
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={item.completed}
                    disabled={savingType === selectedChecklist.type}
                    onChange={() => onToggleItem(selectedChecklist.type, item.key)}
                  />
                  <span className="flex-1 text-sm font-medium text-slate-800">{item.label}</span>
                </label>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {savingType === selectedChecklist.type
                ? 'Saving checklist...'
                : selectedChecklist.completed
                  ? 'Checklist complete. The matching trip action is now unlocked.'
                  : 'Check every item to unlock the next required trip action.'}
            </p>
            {saveError && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                {saveError}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
