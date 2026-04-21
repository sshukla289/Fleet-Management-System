import type { CreateIssueInput, CreateSosInput, DriverIssue, IssueType, SosAlert } from '../types'
import { reportIssue, sendSos } from './apiService'

const DB_NAME = 'fleet-driver-emergency'
const STORE_NAME = 'jobs'
const DB_VERSION = 1
const QUEUE_EVENT = 'fleet:emergency-queue:changed'
const RECEIPT_STORAGE_KEY = 'fleet:emergency-delivery-receipts'
const MAX_RECEIPTS = 24

type QueueJobKind = 'issue' | 'sos'

type StoredIssuePayload = {
  type: IssueType
  description: string
  tripId?: string
  lat?: number
  lng?: number
  imageBlob?: Blob
  imageName?: string
  imageType?: string
}

type StoredSosPayload = {
  tripId?: string
  lat?: number
  lng?: number
}

type StoredJob =
  | {
      id: string
      kind: 'issue'
      createdAt: string
      attemptCount: number
      lastError?: string
      payload: StoredIssuePayload
    }
  | {
      id: string
      kind: 'sos'
      createdAt: string
      attemptCount: number
      lastError?: string
      payload: StoredSosPayload
    }

export type QueuedEmergencyJobSummary = {
  id: string
  kind: QueueJobKind
  createdAt: string
  attemptCount: number
  label: string
  tripId?: string
  lastError?: string
}

export type QueueSubmissionResult<T> =
  | { status: 'sent'; response: T }
  | { status: 'queued'; queueId: string }

export type EmergencyDeliveryReceiptStatus = 'QUEUED' | 'RETRYING' | 'DELIVERED'

type StoredEmergencyDeliveryReceipt = {
  id: string
  kind: QueueJobKind
  label: string
  detail: string
  tripId?: string
  createdAt: string
  status: EmergencyDeliveryReceiptStatus
  retryCount: number
  lastRetriedAt?: string
  deliveredAt?: string
  lastError?: string
  deliveredEntityId?: string
}

export type EmergencyDeliveryReceiptSummary = {
  id: string
  kind: QueueJobKind
  label: string
  detail: string
  tripId?: string
  createdAt: string
  status: EmergencyDeliveryReceiptStatus
  retryCount: number
  lastRetriedAt?: string
  deliveredAt?: string
  lastError?: string
  deliveredEntityId?: string
}

let processingPromise: Promise<void> | null = null

function emitQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
  }
}

function wrapRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open queue database'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, task: (store: IDBObjectStore) => Promise<T>) {
  const db = await openDatabase()

  try {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const result = await task(store)

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Queue transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Queue transaction aborted'))
    })

    return result
  } finally {
    db.close()
  }
}

async function listJobsInternal() {
  return withStore('readonly', async (store) => {
    const jobs = await wrapRequest(store.getAll() as IDBRequest<StoredJob[]>)
    return jobs.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
  })
}

async function saveJob(job: StoredJob) {
  await withStore('readwrite', async (store) => {
    await wrapRequest(store.put(job))
    return undefined
  })
  emitQueueChanged()
}

async function deleteJob(id: string) {
  await withStore('readwrite', async (store) => {
    await wrapRequest(store.delete(id))
    return undefined
  })
  emitQueueChanged()
}

function createJobId(prefix: QueueJobKind) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildReceiptDetail(kind: QueueJobKind, tripId?: string) {
  const tripSuffix = tripId ? ` on ${tripId}` : ''
  return kind === 'sos' ? `Emergency SOS${tripSuffix}` : `Issue report${tripSuffix}`
}

function buildIssueLabel(type: IssueType) {
  return `Issue · ${type.replace(/_/g, ' ')}`
}

function readReceipts() {
  if (typeof window === 'undefined') {
    return [] as StoredEmergencyDeliveryReceipt[]
  }

  try {
    const raw = window.localStorage.getItem(RECEIPT_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as StoredEmergencyDeliveryReceipt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function receiptSortValue(receipt: StoredEmergencyDeliveryReceipt) {
  return new Date(receipt.deliveredAt ?? receipt.lastRetriedAt ?? receipt.createdAt).getTime()
}

function writeReceipts(receipts: StoredEmergencyDeliveryReceipt[]) {
  if (typeof window === 'undefined') {
    return
  }

  const next = [...receipts]
    .sort((left, right) => receiptSortValue(right) - receiptSortValue(left))
    .slice(0, MAX_RECEIPTS)
  window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(next))
}

function upsertReceipt(
  receiptId: string,
  updater: (current: StoredEmergencyDeliveryReceipt | undefined) => StoredEmergencyDeliveryReceipt | undefined,
) {
  const receipts = readReceipts()
  const current = receipts.find((receipt) => receipt.id === receiptId)
  const nextReceipt = updater(current)

  if (!nextReceipt) {
    return
  }

  const next = current
    ? receipts.map((receipt) => (receipt.id === receiptId ? nextReceipt : receipt))
    : [nextReceipt, ...receipts]

  writeReceipts(next)
  emitQueueChanged()
}

function summarizeReceipt(receipt: StoredEmergencyDeliveryReceipt): EmergencyDeliveryReceiptSummary {
  return { ...receipt }
}

function queueReceiptForJob(job: StoredJob) {
  const receipt: StoredEmergencyDeliveryReceipt = {
    id: job.id,
    kind: job.kind,
    label: job.kind === 'issue' ? buildIssueLabel(job.payload.type) : 'Emergency SOS',
    detail: buildReceiptDetail(job.kind, job.payload.tripId),
    tripId: job.payload.tripId,
    createdAt: job.createdAt,
    status: 'QUEUED',
    retryCount: 0,
  }

  upsertReceipt(job.id, () => receipt)
}

function markReceiptRetrying(job: StoredJob, attemptedAt: string) {
  upsertReceipt(job.id, (current) => ({
    id: job.id,
    kind: job.kind,
    label: current?.label ?? (job.kind === 'issue' ? buildIssueLabel(job.payload.type) : 'Emergency SOS'),
    detail: current?.detail ?? buildReceiptDetail(job.kind, job.payload.tripId),
    tripId: current?.tripId ?? job.payload.tripId,
    createdAt: current?.createdAt ?? job.createdAt,
    status: 'RETRYING',
    retryCount: (current?.retryCount ?? 0) + 1,
    lastRetriedAt: attemptedAt,
    deliveredAt: current?.deliveredAt,
    lastError: undefined,
    deliveredEntityId: current?.deliveredEntityId,
  }))
}

function markReceiptQueued(job: StoredJob, lastError?: string) {
  upsertReceipt(job.id, (current) => ({
    id: job.id,
    kind: job.kind,
    label: current?.label ?? (job.kind === 'issue' ? buildIssueLabel(job.payload.type) : 'Emergency SOS'),
    detail: current?.detail ?? buildReceiptDetail(job.kind, job.payload.tripId),
    tripId: current?.tripId ?? job.payload.tripId,
    createdAt: current?.createdAt ?? job.createdAt,
    status: 'QUEUED',
    retryCount: current?.retryCount ?? 0,
    lastRetriedAt: current?.lastRetriedAt,
    deliveredAt: current?.deliveredAt,
    lastError,
    deliveredEntityId: current?.deliveredEntityId,
  }))
}

function markReceiptDelivered(job: StoredJob, deliveredAt: string, deliveredEntityId?: string) {
  upsertReceipt(job.id, (current) => ({
    id: job.id,
    kind: job.kind,
    label: current?.label ?? (job.kind === 'issue' ? buildIssueLabel(job.payload.type) : 'Emergency SOS'),
    detail: current?.detail ?? buildReceiptDetail(job.kind, job.payload.tripId),
    tripId: current?.tripId ?? job.payload.tripId,
    createdAt: current?.createdAt ?? job.createdAt,
    status: 'DELIVERED',
    retryCount: current?.retryCount ?? 0,
    lastRetriedAt: current?.lastRetriedAt,
    deliveredAt,
    lastError: undefined,
    deliveredEntityId,
  }))
}

function isNetworkLikeError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true
  }

  if (error instanceof TypeError) {
    return true
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
}

function summarize(job: StoredJob): QueuedEmergencyJobSummary {
  if (job.kind === 'issue') {
    return {
      id: job.id,
      kind: job.kind,
      createdAt: job.createdAt,
      attemptCount: job.attemptCount,
      label: `${job.payload.type}: ${job.payload.description.slice(0, 42)}`,
      tripId: job.payload.tripId,
      lastError: job.lastError,
    }
  }

  return {
    id: job.id,
    kind: job.kind,
    createdAt: job.createdAt,
    attemptCount: job.attemptCount,
    label: 'Emergency SOS',
    tripId: job.payload.tripId,
    lastError: job.lastError,
  }
}

function reviveIssuePayload(payload: StoredIssuePayload): CreateIssueInput {
  const image = payload.imageBlob
    ? new File(
        [payload.imageBlob],
        payload.imageName ?? `issue-image.${payload.imageType?.split('/')[1] ?? 'jpg'}`,
        { type: payload.imageType ?? payload.imageBlob.type ?? 'image/jpeg' },
      )
    : null

  return {
    type: payload.type,
    description: payload.description,
    tripId: payload.tripId,
    lat: payload.lat,
    lng: payload.lng,
    image,
  }
}

async function queueIssue(input: CreateIssueInput) {
  const job: StoredJob = {
    id: createJobId('issue'),
    kind: 'issue',
    createdAt: new Date().toISOString(),
    attemptCount: 0,
    payload: {
      type: input.type,
      description: input.description,
      tripId: input.tripId,
      lat: input.lat,
      lng: input.lng,
      imageBlob: input.image ?? undefined,
      imageName: input.image?.name,
      imageType: input.image?.type,
    },
  }

  await saveJob(job)
  queueReceiptForJob(job)
  return job.id
}

async function queueSos(input: CreateSosInput) {
  const job: StoredJob = {
    id: createJobId('sos'),
    kind: 'sos',
    createdAt: new Date().toISOString(),
    attemptCount: 0,
    payload: {
      tripId: input.tripId,
      lat: input.lat,
      lng: input.lng,
    },
  }

  await saveJob(job)
  queueReceiptForJob(job)
  return job.id
}

async function updateJobError(job: StoredJob, error: unknown) {
  await saveJob({
    ...job,
    attemptCount: job.attemptCount + 1,
    lastError: error instanceof Error ? error.message : 'Queue retry failed',
  })
}

export async function submitIssueWithQueue(input: CreateIssueInput): Promise<QueueSubmissionResult<DriverIssue>> {
  try {
    const response = await reportIssue(input)
    void processEmergencyQueue()
    return { status: 'sent', response }
  } catch (error) {
    if (!isNetworkLikeError(error)) {
      throw error
    }

    const queueId = await queueIssue(input)
    return { status: 'queued', queueId }
  }
}

export async function submitSosWithQueue(input: CreateSosInput): Promise<QueueSubmissionResult<SosAlert>> {
  try {
    const response = await sendSos(input)
    void processEmergencyQueue()
    return { status: 'sent', response }
  } catch (error) {
    if (!isNetworkLikeError(error)) {
      throw error
    }

    const queueId = await queueSos(input)
    return { status: 'queued', queueId }
  }
}

export async function listQueuedEmergencyJobs() {
  const jobs = await listJobsInternal()
  return jobs.map(summarize)
}

export async function listEmergencyDeliveryReceipts(limit?: number) {
  const receipts = readReceipts().map(summarizeReceipt)
  return typeof limit === 'number' ? receipts.slice(0, limit) : receipts
}

export async function processEmergencyQueue() {
  if (processingPromise) {
    return processingPromise
  }

  processingPromise = (async () => {
    const jobs = await listJobsInternal()
    for (const job of jobs) {
      const attemptedAt = new Date().toISOString()
      markReceiptRetrying(job, attemptedAt)

      try {
        if (job.kind === 'issue') {
          const response = await reportIssue(reviveIssuePayload(job.payload))
          markReceiptDelivered(job, new Date().toISOString(), response.id)
        } else {
          const response = await sendSos(job.payload)
          markReceiptDelivered(job, new Date().toISOString(), response.alertId)
        }

        await deleteJob(job.id)
      } catch (error) {
        await updateJobError(job, error)
        markReceiptQueued(job, error instanceof Error ? error.message : 'Queue retry failed')
        if (isNetworkLikeError(error)) {
          break
        }
      }
    }
  })()

  try {
    await processingPromise
  } finally {
    processingPromise = null
  }
}

export { QUEUE_EVENT }
