import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchTripTelemetry, fetchTrips } from '../services/apiService'
import { useAuth } from '../context/useAuth'
import type { CreateIssueInput, IssueType, Trip } from '../types'
import {
  listEmergencyDeliveryReceipts,
  listQueuedEmergencyJobs,
  processEmergencyQueue,
  QUEUE_EVENT,
  submitIssueWithQueue,
  submitSosWithQueue,
  type EmergencyDeliveryReceiptSummary,
  type QueuedEmergencyJobSummary,
} from '../services/driverEmergencyQueue'

type LocationSource = 'gps' | 'telemetry'

type KnownLocation = {
  lat: number
  lng: number
  source: LocationSource
  timestamp: string
}

const ACTIVE_TRIP_ORDER: Trip['status'][] = ['IN_PROGRESS', 'PAUSED', 'DISPATCHED']
const ISSUE_TYPES: { value: IssueType; label: string; hint: string }[] = [
  { value: 'BREAKDOWN', label: 'Breakdown', hint: 'Vehicle cannot continue safely.' },
  { value: 'ACCIDENT', label: 'Accident', hint: 'Collision, impact, or injury risk.' },
  { value: 'DELAY', label: 'Delay', hint: 'Traffic, checkpoint, or route hold-up.' },
  { value: 'OTHER', label: 'Other', hint: 'Anything else that needs ops support.' },
]

function pickActiveTrip(trips: Trip[]) {
  for (const status of ACTIVE_TRIP_ORDER) {
    const match = trips.find((trip) => trip.status === status)
    if (match) {
      return match
    }
  }

  return null
}

function formatLocation(location: KnownLocation | null) {
  if (!location) {
    return 'Waiting for live location...'
  }

  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} · ${location.source === 'gps' ? 'GPS' : 'Vehicle ping'}`
}

function formatReceiptTime(value?: string) {
  if (!value) {
    return null
  }

  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function describeReceiptStatus(receipt: EmergencyDeliveryReceiptSummary) {
  if (receipt.status === 'DELIVERED') {
    return `Delivered successfully${receipt.deliveredAt ? ` at ${formatReceiptTime(receipt.deliveredAt)}` : ''}`
  }

  if (receipt.lastRetriedAt) {
    return `Retried at ${formatReceiptTime(receipt.lastRetriedAt)}`
  }

  return `Queued at ${formatReceiptTime(receipt.createdAt)}`
}

export function DriverEmergencyHub() {
  const { session } = useAuth()
  const driverId = session?.profile.id
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)
  const [knownLocation, setKnownLocation] = useState<KnownLocation | null>(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [issueType, setIssueType] = useState<IssueType>('BREAKDOWN')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [submittingIssue, setSubmittingIssue] = useState(false)
  const [submittingSos, setSubmittingSos] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingJobs, setPendingJobs] = useState<QueuedEmergencyJobSummary[]>([])
  const [deliveryReceipts, setDeliveryReceipts] = useState<EmergencyDeliveryReceiptSummary[]>([])
  const [retryingQueue, setRetryingQueue] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])

  const loadQueueState = useCallback(async () => {
    try {
      const [queued, receipts] = await Promise.all([
        listQueuedEmergencyJobs(),
        listEmergencyDeliveryReceipts(4),
      ])
      setPendingJobs(queued)
      setDeliveryReceipts(receipts)
    } catch {
      // Queue state is a resilience enhancement; ignore if the browser blocks storage.
    }
  }, [])

  const syncTripContext = useCallback(async () => {
    try {
      const trips = await fetchTrips()
      const nextTrip = pickActiveTrip(trips)
      setActiveTrip(nextTrip)

      if (!nextTrip) {
        return
      }

      if (knownLocation?.source === 'gps') {
        return
      }

      const telemetry = await fetchTripTelemetry(nextTrip.tripId)
      const latestPoint = telemetry.at(-1)
      if (latestPoint) {
        setKnownLocation((current) => current?.source === 'gps'
          ? current
          : {
              lat: latestPoint.latitude,
              lng: latestPoint.longitude,
              source: 'telemetry',
              timestamp: latestPoint.timestamp,
            })
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync trip context.')
    }
  }, [knownLocation?.source])

  useEffect(() => {
    void syncTripContext()
    void loadQueueState()
    const interval = window.setInterval(() => {
      void syncTripContext()
      void processEmergencyQueue()
      void loadQueueState()
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [loadQueueState, syncTripContext])

  useEffect(() => {
    const handleQueueChange = () => {
      void loadQueueState()
    }

    const handleOnline = () => {
      void processEmergencyQueue().then(() => loadQueueState())
    }

    window.addEventListener(QUEUE_EVENT, handleQueueChange)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener(QUEUE_EVENT, handleQueueChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [loadQueueState])

  useEffect(() => {
    if (!navigator.geolocation) {
      return undefined
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setKnownLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: 'gps',
          timestamp: new Date(position.timestamp).toISOString(),
        })
      },
      () => undefined,
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      },
    )

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!previewUrl) {
      return undefined
    }

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!message && !error) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setMessage(null)
      setError(null)
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [error, message])

  if (session?.profile.role !== 'DRIVER' || !driverId) {
    return null
  }

  const issueTypeHint = ISSUE_TYPES.find((option) => option.value === issueType)?.hint ?? ''
  const issueDisabled = submittingIssue || !description.trim()
  const latestReceipt = deliveryReceipts[0] ?? null

  const handleIssueSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmittingIssue(true)
    setError(null)

    const payload: CreateIssueInput = {
      type: issueType,
      description: description.trim(),
      tripId: activeTrip?.tripId,
      lat: knownLocation?.lat,
      lng: knownLocation?.lng,
      image: imageFile,
    }

    try {
      const response = await submitIssueWithQueue(payload)
      if (response.status === 'sent') {
        setMessage(`Issue ${response.response.id} sent to operations.`)
      } else {
        setMessage('No signal. Issue saved securely and will retry automatically.')
      }
      setIssueOpen(false)
      setDescription('')
      setIssueType('BREAKDOWN')
      setImageFile(null)
      await loadQueueState()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to report the issue right now.')
    } finally {
      setSubmittingIssue(false)
    }
  }

  const handleSosConfirm = async () => {
    setSubmittingSos(true)
    setError(null)

    try {
      const response = await submitSosWithQueue({
        tripId: activeTrip?.tripId,
        lat: knownLocation?.lat,
        lng: knownLocation?.lng,
      })
      if (response.status === 'sent') {
        setMessage(`SOS sent. Alert ${response.response.alertId} is now live.`)
      } else {
        setMessage('Signal dropped. SOS is queued and will fire automatically on reconnect.')
      }
      setSosOpen(false)
      await loadQueueState()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to trigger SOS right now.')
    } finally {
      setSubmittingSos(false)
    }
  }

  const handleRetryQueue = async () => {
    setRetryingQueue(true)
    try {
      await processEmergencyQueue()
      await loadQueueState()
      setMessage('Queued emergency items retried.')
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Unable to retry queued items.')
    } finally {
      setRetryingQueue(false)
    }
  }

  return (
    <>
      {(message || error) && (
        <div className="fixed right-4 top-20 z-[860] max-w-sm rounded-2xl border border-white/20 bg-slate-950/90 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">
          {error ?? message}
        </div>
      )}

      <div className="fixed bottom-24 right-4 z-[850] flex flex-col items-end gap-3 md:bottom-6">
        {pendingJobs.length > 0 && (
          <div className="driver-emergency-queue">
            <div>
              <strong>{pendingJobs.length} pending</strong>
              <p>{pendingJobs[0]?.kind === 'sos' ? 'SOS waiting to resend' : 'Issue report waiting to resend'}</p>
            </div>
            <button type="button" onClick={() => { void handleRetryQueue() }} disabled={retryingQueue}>
              {retryingQueue ? 'Retrying...' : 'Retry now'}
            </button>
          </div>
        )}
        {latestReceipt && (
          <div className="driver-emergency-receipt-card">
            <div>
              <strong>{latestReceipt.label}</strong>
              <p>{describeReceiptStatus(latestReceipt)}</p>
            </div>
            <span className={`status-pill ${latestReceipt.status === 'DELIVERED' ? 'status-pill--mint' : latestReceipt.status === 'RETRYING' ? 'status-pill--blue' : 'status-pill--amber'}`}>
              {latestReceipt.status === 'DELIVERED' ? 'Delivered' : latestReceipt.status === 'RETRYING' ? 'Retrying' : 'Queued'}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setIssueOpen(true)
            setError(null)
          }}
          className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5"
        >
          Report issue
        </button>
        <button
          type="button"
          onClick={() => {
            setSosOpen(true)
            setError(null)
          }}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-red-200 bg-red-600 text-xl font-black tracking-[0.2em] text-white shadow-[0_24px_60px_rgba(220,38,38,0.45)] transition hover:scale-[1.02]"
          aria-label="Trigger SOS emergency alert"
        >
          SOS
        </button>
      </div>

      {issueOpen && (
        <div className="fixed inset-0 z-[870] flex items-end justify-center bg-slate-950/60 p-4 md:items-center">
          <div className="w-full max-w-xl rounded-[28px] border border-white/15 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Driver issue reporting</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">Send issue details fast</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Trip: <span className="font-semibold text-slate-900">{activeTrip?.tripId ?? 'No active trip detected'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIssueOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleIssueSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Issue type</span>
                <select
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value as IssueType)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  {ISSUE_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">{issueTypeHint}</p>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What happened and what help do you need?"
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">Auto location</p>
                <p className="mt-1 text-sm text-slate-600">{formatLocation(knownLocation)}</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
              </label>

              {previewUrl && (
                <img src={previewUrl} alt="Issue preview" className="h-36 w-full rounded-2xl object-cover" />
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setIssueOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issueDisabled}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingIssue ? 'Sending issue...' : 'Send issue report'}
                </button>
              </div>

              {pendingJobs.length > 0 && (
                <div className="driver-emergency-queued-list">
                  <strong>Queued for retry</strong>
                  <ul>
                    {pendingJobs.slice(0, 3).map((job) => (
                      <li key={job.id}>
                        <span>{job.label}</span>
                        <span>{new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {deliveryReceipts.length > 0 && (
                <div className="driver-emergency-receipts">
                  <strong>Delivery receipts</strong>
                  <ul>
                    {deliveryReceipts.map((receipt) => (
                      <li key={receipt.id}>
                        <div>
                          <span>{receipt.label}</span>
                          <small>{receipt.detail}</small>
                        </div>
                        <span>{describeReceiptStatus(receipt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {sosOpen && (
        <div className="fixed inset-0 z-[880] flex items-end justify-center bg-slate-950/70 p-4 md:items-center">
          <div className="w-full max-w-md rounded-[32px] border border-red-200/60 bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-600 text-2xl font-black tracking-[0.2em] text-white shadow-lg">
              SOS
            </div>
            <h3 className="mt-5 text-center text-2xl font-semibold text-slate-950">Emergency confirmation</h3>
            <p className="mt-3 text-center text-sm text-slate-600">
              This will immediately alert operations with your driver ID, trip ID, and latest location.
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">Driver:</span> {driverId}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Trip:</span> {activeTrip?.tripId ?? 'Unavailable'}</p>
              <p className="mt-1"><span className="font-semibold text-slate-900">Location:</span> {formatLocation(knownLocation)}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setSosOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSosConfirm()}
                disabled={submittingSos}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingSos ? 'Sending SOS...' : 'Confirm SOS'}
              </button>
            </div>

            {pendingJobs.length > 0 && (
              <p className="mt-4 text-center text-xs text-slate-500">
                {pendingJobs.length} emergency item{pendingJobs.length === 1 ? '' : 's'} already queued for automatic retry.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
