import type {
  ChecklistType,
  CreateFuelLogInput,
  FuelLog,
  StopStatus,
  TripChecklist,
  UpdateTripChecklistInput,
} from '../types'
import { createFuelLog, syncOfflineBatch, updateTripChecklist as apiUpdateTripChecklist } from './apiService'

const DB_NAME = 'fleet-offline-sync'
const STORE_NAME = 'operations'
const DB_VERSION = 1
const HISTORY_STORAGE_KEY = 'fleet:offline-sync:history'
const MAX_HISTORY = 40
const MAX_BATCH_SIZE = 20

export const OFFLINE_SYNC_EVENT = 'fleet:offline-sync:changed'

type OfflineOperationKind = 'fuel-log' | 'trip-update' | 'checklist' | 'telemetry'
export type OfflineSyncReceiptStatus = 'QUEUED' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED'

type FuelLogOperationPayload = {
  tripId: string
  amount: number
  cost: number
  receiptDataUrl?: string
  loggedAt: string
}

type ChecklistOperationPayload = {
  tripId: string
  type: ChecklistType
  items: UpdateTripChecklistInput['items']
}

type TripUpdateOperationPayload = {
  tripId: string
  latitude: number
  longitude: number
  speed: number
  fuel: number
  currentStop?: string | null
  status?: StopStatus | null
  timestamp: string
}

type TelemetryOperationPayload = {
  vehicleId?: string
  tripId: string
  latitude: number
  longitude: number
  speed: number
  fuelLevel: number
  timestamp: string
}

type StoredOperation =
  | {
      id: string
      kind: 'fuel-log'
      createdAt: string
      clientRecordedAt: string
      attemptCount: number
      nextRetryAt?: string
      lastError?: string
      payload: FuelLogOperationPayload
    }
  | {
      id: string
      kind: 'checklist'
      createdAt: string
      clientRecordedAt: string
      attemptCount: number
      nextRetryAt?: string
      lastError?: string
      payload: ChecklistOperationPayload
    }
  | {
      id: string
      kind: 'trip-update'
      createdAt: string
      clientRecordedAt: string
      attemptCount: number
      nextRetryAt?: string
      lastError?: string
      payload: TripUpdateOperationPayload
    }
  | {
      id: string
      kind: 'telemetry'
      createdAt: string
      clientRecordedAt: string
      attemptCount: number
      nextRetryAt?: string
      lastError?: string
      payload: TelemetryOperationPayload
    }

type StoredSyncReceipt = {
  id: string
  jobId: string
  kind: OfflineOperationKind
  label: string
  detail: string
  tripId?: string
  createdAt: string
  status: OfflineSyncReceiptStatus
  attemptCount: number
  lastAttemptAt?: string
  completedAt?: string
  lastError?: string
  resolution?: string
  entityId?: string
}

export type OfflineSyncReceiptSummary = StoredSyncReceipt

export type OfflineSyncSubmissionResult<T> =
  | { status: 'sent'; response: T }
  | { status: 'queued'; queueId: string }

export type TrackingSnapshotInput = {
  vehicleId?: string
  tripId: string
  latitude: number
  longitude: number
  speed: number
  fuelLevel: number
  currentStop?: string | null
  status?: StopStatus | null
  timestamp?: string
}

export type OfflineSyncSnapshot = {
  queuedCount: number
  processing: boolean
  receipts: OfflineSyncReceiptSummary[]
}

let processingPromise: Promise<void> | null = null

function emitOfflineSyncChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_EVENT))
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
    request.onerror = () => reject(request.error ?? new Error('Unable to open offline sync database'))
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
      transaction.onerror = () => reject(transaction.error ?? new Error('Offline sync transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Offline sync transaction aborted'))
    })

    return result
  } finally {
    db.close()
  }
}

async function listOperationsInternal() {
  return withStore('readonly', async (store) => {
    const jobs = await wrapRequest(store.getAll() as IDBRequest<StoredOperation[]>)
    return jobs.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
  })
}

async function saveOperation(operation: StoredOperation) {
  await withStore('readwrite', async (store) => {
    await wrapRequest(store.put(operation))
    return undefined
  })
  emitOfflineSyncChanged()
}

async function deleteOperation(id: string) {
  await withStore('readwrite', async (store) => {
    await wrapRequest(store.delete(id))
    return undefined
  })
  emitOfflineSyncChanged()
}

async function removeExistingTripUpdate(tripId: string) {
  const operations = await listOperationsInternal()
  const existing = operations.filter((operation) => operation.kind === 'trip-update' && operation.payload.tripId === tripId)
  await Promise.all(existing.map((operation) => deleteOperation(operation.id)))
}

function buildReceiptId(operation: StoredOperation) {
  if (operation.kind === 'telemetry' || operation.kind === 'trip-update') {
    return `${operation.kind}-${operation.payload.tripId}`
  }
  return operation.id
}

function buildReceipt(operation: StoredOperation): StoredSyncReceipt {
  const label = operation.kind === 'fuel-log'
    ? 'Fuel log'
    : operation.kind === 'checklist'
      ? `${operation.payload.type} checklist`
      : operation.kind === 'trip-update'
        ? 'Trip update'
        : 'Telemetry buffer'

  const detail = operation.kind === 'fuel-log'
    ? `Fuel log for ${operation.payload.tripId}`
    : operation.kind === 'checklist'
      ? `Checklist queued for ${operation.payload.tripId}`
      : operation.kind === 'trip-update'
        ? `Latest trip position queued for ${operation.payload.tripId}`
        : `Telemetry queued for ${operation.payload.tripId}`

  return {
    id: buildReceiptId(operation),
    jobId: operation.id,
    kind: operation.kind,
    label,
    detail,
    tripId: operation.payload.tripId,
    createdAt: operation.createdAt,
    status: 'QUEUED',
    attemptCount: 0,
  }
}

function readReceipts() {
  if (typeof window === 'undefined') {
    return [] as StoredSyncReceipt[]
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as StoredSyncReceipt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeReceipts(receipts: StoredSyncReceipt[]) {
  if (typeof window === 'undefined') {
    return
  }

  const next = [...receipts]
    .sort((left, right) => new Date(right.completedAt ?? right.lastAttemptAt ?? right.createdAt).getTime()
      - new Date(left.completedAt ?? left.lastAttemptAt ?? left.createdAt).getTime())
    .slice(0, MAX_HISTORY)
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
}

function upsertReceipt(
  receiptId: string,
  updater: (current: StoredSyncReceipt | undefined) => StoredSyncReceipt,
) {
  const receipts = readReceipts()
  const current = receipts.find((receipt) => receipt.id === receiptId)
  const nextReceipt = updater(current)
  const next = current
    ? receipts.map((receipt) => (receipt.id === receiptId ? nextReceipt : receipt))
    : [nextReceipt, ...receipts]

  writeReceipts(next)
  emitOfflineSyncChanged()
}

function queueReceipt(operation: StoredOperation) {
  const receipt = buildReceipt(operation)
  upsertReceipt(receipt.id, () => receipt)
}

function markReceiptSyncing(operation: StoredOperation, attemptedAt: string) {
  const baseReceipt = buildReceipt(operation)
  upsertReceipt(buildReceiptId(operation), (current) => ({
    ...baseReceipt,
    attemptCount: (current?.attemptCount ?? 0) + 1,
    lastAttemptAt: attemptedAt,
    completedAt: current?.completedAt,
    status: 'SYNCING',
    lastError: undefined,
    resolution: current?.resolution,
    entityId: current?.entityId,
  }))
}

function markReceiptQueued(operation: StoredOperation, lastError?: string) {
  const baseReceipt = buildReceipt(operation)
  upsertReceipt(buildReceiptId(operation), (current) => ({
    ...baseReceipt,
    attemptCount: current?.attemptCount ?? operation.attemptCount,
    lastAttemptAt: current?.lastAttemptAt,
    completedAt: current?.completedAt,
    status: 'QUEUED',
    lastError,
    resolution: current?.resolution,
    entityId: current?.entityId,
  }))
}

function markReceiptCompleted(
  operation: StoredOperation,
  status: Exclude<OfflineSyncReceiptStatus, 'QUEUED' | 'SYNCING'>,
  message?: string,
  resolution?: string,
  entityId?: string | null,
) {
  const baseReceipt = buildReceipt(operation)
  upsertReceipt(buildReceiptId(operation), (current) => ({
    ...baseReceipt,
    attemptCount: current?.attemptCount ?? operation.attemptCount,
    lastAttemptAt: current?.lastAttemptAt,
    completedAt: new Date().toISOString(),
    status,
    lastError: status === 'FAILED' ? message : undefined,
    resolution,
    entityId: entityId ?? undefined,
  }))
}

function getRetryDelayMs(attemptCount: number) {
  return Math.min(15_000 * 2 ** Math.max(0, attemptCount), 5 * 60_000)
}

function isDueForRetry(operation: StoredOperation) {
  if (!operation.nextRetryAt) {
    return true
  }

  return new Date(operation.nextRetryAt).getTime() <= Date.now()
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

function createClientRequestId(kind: OfflineOperationKind) {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read the selected receipt file.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the selected receipt file.'))
    reader.readAsDataURL(file)
  })
}

function toSyncOperation(operation: StoredOperation) {
  return {
    clientRequestId: operation.id,
    type: operation.kind === 'fuel-log'
      ? 'FUEL_LOG'
      : operation.kind === 'checklist'
        ? 'CHECKLIST'
        : operation.kind === 'trip-update'
          ? 'TRIP_UPDATE'
          : 'TELEMETRY',
    clientRecordedAt: operation.clientRecordedAt,
    conflictPolicy: operation.kind === 'checklist' ? 'KEEP_MOST_COMPLETE' : 'SERVER_LATEST',
    payload: operation.payload,
  } as const
}

async function queueOperation(operation: StoredOperation) {
  await saveOperation(operation)
  queueReceipt(operation)
  return operation.id
}

export async function submitFuelLogWithOffline(input: CreateFuelLogInput): Promise<OfflineSyncSubmissionResult<FuelLog>> {
  const clientRequestId = input.clientRequestId?.trim() || createClientRequestId('fuel-log')
  const loggedAt = input.loggedAt ?? new Date().toISOString()

  try {
    const response = await createFuelLog({
      ...input,
      clientRequestId,
      loggedAt,
    })
    void processOfflineQueue()
    return { status: 'sent', response }
  } catch (error) {
    if (!isNetworkLikeError(error)) {
      throw error
    }

    const queueId = await queueOperation({
      id: clientRequestId,
      kind: 'fuel-log',
      createdAt: new Date().toISOString(),
      clientRecordedAt: loggedAt,
      attemptCount: 0,
      payload: {
        tripId: input.tripId,
        amount: input.amount,
        cost: input.cost,
        receiptDataUrl: input.receipt ? await fileToDataUrl(input.receipt) : undefined,
        loggedAt,
      },
    })
    return { status: 'queued', queueId }
  }
}

export async function updateTripChecklistWithOffline(
  tripId: string,
  type: ChecklistType,
  input: UpdateTripChecklistInput,
): Promise<OfflineSyncSubmissionResult<TripChecklist>> {
  try {
    const response = await apiUpdateTripChecklist(tripId, type, input)
    void processOfflineQueue()
    return { status: 'sent', response }
  } catch (error) {
    if (!isNetworkLikeError(error)) {
      throw error
    }

    const queueId = await queueOperation({
      id: createClientRequestId('checklist'),
      kind: 'checklist',
      createdAt: new Date().toISOString(),
      clientRecordedAt: new Date().toISOString(),
      attemptCount: 0,
      payload: {
        tripId,
        type,
        items: input.items,
      },
    })
    return { status: 'queued', queueId }
  }
}

export async function bufferTrackingSnapshot(snapshot: TrackingSnapshotInput) {
  const timestamp = snapshot.timestamp ?? new Date().toISOString()

  await removeExistingTripUpdate(snapshot.tripId)
  await queueOperation({
    id: createClientRequestId('trip-update'),
    kind: 'trip-update',
    createdAt: timestamp,
    clientRecordedAt: timestamp,
    attemptCount: 0,
    payload: {
      tripId: snapshot.tripId,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      speed: snapshot.speed,
      fuel: snapshot.fuelLevel,
      currentStop: snapshot.currentStop,
      status: snapshot.status,
      timestamp,
    },
  })

  await queueOperation({
    id: createClientRequestId('telemetry'),
    kind: 'telemetry',
    createdAt: timestamp,
    clientRecordedAt: timestamp,
    attemptCount: 0,
    payload: {
      vehicleId: snapshot.vehicleId,
      tripId: snapshot.tripId,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      speed: snapshot.speed,
      fuelLevel: snapshot.fuelLevel,
      timestamp,
    },
  })
}

export async function listOfflineSyncReceipts(limit?: number) {
  const receipts = readReceipts()
  return typeof limit === 'number' ? receipts.slice(0, limit) : receipts
}

export async function getOfflineSyncSnapshot(): Promise<OfflineSyncSnapshot> {
  const operations = await listOperationsInternal()
  return {
    queuedCount: operations.length,
    processing: processingPromise !== null,
    receipts: await listOfflineSyncReceipts(8),
  }
}

export async function processOfflineQueue() {
  if (processingPromise) {
    return processingPromise
  }

  processingPromise = (async () => {
    const operations = (await listOperationsInternal())
      .filter(isDueForRetry)
      .slice(0, MAX_BATCH_SIZE)

    if (operations.length === 0) {
      return
    }

    const attemptedAt = new Date().toISOString()
    operations.forEach((operation) => markReceiptSyncing(operation, attemptedAt))

    try {
      const response = await syncOfflineBatch({
        operations: operations.map(toSyncOperation),
      })

      const resultsById = new Map(response.results.map((result) => [result.clientRequestId, result]))
      for (const operation of operations) {
        const result = resultsById.get(operation.id)
        if (!result) {
          await deleteOperation(operation.id)
          markReceiptCompleted(operation, 'FAILED', 'Sync response did not include this queued operation.')
          continue
        }

        if (result.status === 'APPLIED' || result.status === 'DUPLICATE') {
          await deleteOperation(operation.id)
          markReceiptCompleted(operation, 'SYNCED', result.message, result.resolution ?? undefined, result.entityId)
          continue
        }

        if (result.status === 'CONFLICT') {
          await deleteOperation(operation.id)
          markReceiptCompleted(operation, 'CONFLICT', result.message, result.resolution ?? undefined, result.entityId)
          continue
        }

        await deleteOperation(operation.id)
        markReceiptCompleted(operation, 'FAILED', result.message, result.resolution ?? undefined, result.entityId)
      }
    } catch (error) {
      const retryMessage = error instanceof Error ? error.message : 'Offline sync failed.'
      for (const operation of operations) {
        const nextAttemptCount = operation.attemptCount + 1
        await saveOperation({
          ...operation,
          attemptCount: nextAttemptCount,
          lastError: retryMessage,
          nextRetryAt: new Date(Date.now() + getRetryDelayMs(nextAttemptCount)).toISOString(),
        })
        markReceiptQueued({
          ...operation,
          attemptCount: nextAttemptCount,
        }, retryMessage)
      }

      if (!isNetworkLikeError(error)) {
        throw error
      }
    }
  })()

  try {
    await processingPromise
  } finally {
    processingPromise = null
    emitOfflineSyncChanged()
  }
}
