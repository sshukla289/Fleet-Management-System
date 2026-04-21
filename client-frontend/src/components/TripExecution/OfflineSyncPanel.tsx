import type { OfflineSyncReceiptSummary } from '../../services/offlineSyncService'

interface OfflineSyncPanelProps {
  queuedCount: number
  processing: boolean
  receipts: OfflineSyncReceiptSummary[]
  onRetry: () => void
}

function statusClasses(status: OfflineSyncReceiptSummary['status']) {
  switch (status) {
    case 'SYNCED':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case 'SYNCING':
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    case 'CONFLICT':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    case 'FAILED':
      return 'bg-red-50 text-red-700 ring-1 ring-red-200'
    default:
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  }
}

function statusLabel(status: OfflineSyncReceiptSummary['status']) {
  switch (status) {
    case 'SYNCED':
      return 'Synced'
    case 'SYNCING':
      return 'Syncing'
    case 'CONFLICT':
      return 'Conflict'
    case 'FAILED':
      return 'Failed'
    default:
      return 'Queued'
  }
}

export function OfflineSyncPanel({ queuedCount, processing, receipts, onRetry }: OfflineSyncPanelProps) {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine

  return (
    <section className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Offline sync</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">Queue resilience</h3>
          <p className="mt-1 text-sm text-slate-500">
            Trip updates, checklist changes, telemetry, and fuel logs stay buffered while the connection is unstable.
          </p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${online ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{queuedCount}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Queued jobs</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {processing ? 'Syncing buffered work now' : queuedCount > 0 ? 'Queued work is waiting for sync' : 'All buffered work is clear'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {processing
              ? 'Large queues are replayed in batches with retry backoff.'
              : queuedCount > 0
                ? 'Use retry now after connectivity improves.'
                : 'Nothing is waiting to be retried.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={processing || queuedCount === 0}
          className="rounded-2xl border border-slate-300 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing ? 'Syncing...' : 'Retry now'}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {receipts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            Sync activity will appear here once the driver console starts buffering or replaying work.
          </div>
        ) : (
          receipts.map((receipt) => (
            <div key={receipt.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{receipt.label}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses(receipt.status)}`}>
                      {statusLabel(receipt.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{receipt.detail}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {new Date(receipt.completedAt ?? receipt.lastAttemptAt ?? receipt.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Attempts: {receipt.attemptCount}</p>
                  {receipt.resolution && <p className="mt-1">{receipt.resolution.replace(/_/g, ' ')}</p>}
                  {receipt.lastError && <p className="mt-1 text-red-600">{receipt.lastError}</p>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
