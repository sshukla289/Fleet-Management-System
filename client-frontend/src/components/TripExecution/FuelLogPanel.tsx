import { useState, type FormEvent } from 'react'
import type { CreateFuelLogInput, FuelLog } from '../../types'
import { resolveApiAssetUrl } from '../../services/apiService'
import type { OfflineSyncSubmissionResult } from '../../services/offlineSyncService'

interface FuelLogPanelProps {
  tripId: string
  logs: FuelLog[]
  submitting: boolean
  submitError?: string | null
  onSubmit: (input: CreateFuelLogInput) => Promise<OfflineSyncSubmissionResult<FuelLog>>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function FuelLogPanel({ tripId, logs, submitting, submitError, onSubmit }: FuelLogPanelProps) {
  const [amount, setAmount] = useState('')
  const [cost, setCost] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [localMessage, setLocalMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'emerald' | 'amber'>('emerald')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number.parseFloat(amount)
    const parsedCost = Number.parseFloat(cost)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isFinite(parsedCost) || parsedCost <= 0) {
      setMessageTone('amber')
      setLocalMessage('Enter a valid amount and cost before saving the fuel entry.')
      return
    }

    const result = await onSubmit({
      tripId,
      amount: parsedAmount,
      cost: parsedCost,
      receipt,
      loggedAt: new Date().toISOString(),
    })

    setAmount('')
    setCost('')
    setReceipt(null)
    setMessageTone(result.status === 'sent' ? 'emerald' : 'amber')
    setLocalMessage(
      result.status === 'sent'
        ? 'Fuel log saved to the server.'
        : 'Fuel log queued safely and will sync when the network is stable again.',
    )
  }

  return (
    <section className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fuel logging</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">Capture refuel evidence</h3>
          <p className="mt-1 text-sm text-slate-500">
            Record refuel amount, cost, and receipt evidence without waiting for perfect connectivity.
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Recent logs</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">{logs.length}</p>
        </div>
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Liters or gallons"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cost</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            placeholder="Total cost"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Receipt upload</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-[0.9rem] text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.16em] file:text-white"
          />
          <p className="mt-2 text-xs text-slate-500">{receipt ? receipt.name : 'PNG, JPEG, and WebP receipts are supported.'}</p>
        </label>

        <div className="lg:col-span-3">
          {(submitError || localMessage) && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                submitError
                  ? 'border border-red-200 bg-red-50 text-red-700'
                  : messageTone === 'emerald'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {submitError ?? localMessage}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-lg transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving fuel log...' : 'Save fuel log'}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No fuel entries recorded for this trip yet.
          </div>
        ) : (
          logs.slice(0, 4).map((log) => (
            <div key={log.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {log.amount.toFixed(2)} units logged
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {new Date(log.loggedAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    {formatCurrency(log.cost)}
                  </span>
                  {log.receiptUrl && (
                    <a
                      href={resolveApiAssetUrl(log.receiptUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                    >
                      View receipt
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
