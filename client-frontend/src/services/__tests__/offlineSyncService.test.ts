import type { CreateFuelLogInput, SyncBatchResponse } from '../../types'

const createFuelLogMock = jest.fn()
const syncOfflineBatchMock = jest.fn()
const updateTripChecklistMock = jest.fn()

jest.mock('../apiService', () => ({
  createFuelLog: (...args: unknown[]) => createFuelLogMock(...args),
  syncOfflineBatch: (...args: unknown[]) => syncOfflineBatchMock(...args),
  updateTripChecklist: (...args: unknown[]) => updateTripChecklistMock(...args),
}))

type StoredRecord = Record<string, unknown> & { id: string }

class FakeRequest<T> {
  result!: T
  error: Error | null = null
  onsuccess: ((event: { target: FakeRequest<T> }) => void) | null = null
  onerror: ((event: { target: FakeRequest<T> }) => void) | null = null

  succeed(result: T) {
    this.result = result
    setTimeout(() => this.onsuccess?.({ target: this }), 0)
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  private completeScheduled = false
  private readonly store: Map<string, StoredRecord>

  constructor(store: Map<string, StoredRecord>) {
    this.store = store
  }

  objectStore() {
    return new FakeObjectStore(this.store, this)
  }

  scheduleComplete() {
    if (this.completeScheduled) {
      return
    }

    this.completeScheduled = true
    setTimeout(() => this.oncomplete?.(), 0)
  }
}

class FakeObjectStore {
  private readonly store: Map<string, StoredRecord>
  private readonly transaction: FakeTransaction

  constructor(store: Map<string, StoredRecord>, transaction: FakeTransaction) {
    this.store = store
    this.transaction = transaction
  }

  getAll() {
    const request = new FakeRequest<StoredRecord[]>()
    setTimeout(() => {
      request.succeed(Array.from(this.store.values()))
      this.transaction.scheduleComplete()
    }, 0)
    return request
  }

  put(value: StoredRecord) {
    const request = new FakeRequest<undefined>()
    setTimeout(() => {
      this.store.set(value.id, value)
      request.succeed(undefined)
      this.transaction.scheduleComplete()
    }, 0)
    return request
  }

  delete(id: string) {
    const request = new FakeRequest<undefined>()
    setTimeout(() => {
      this.store.delete(id)
      request.succeed(undefined)
      this.transaction.scheduleComplete()
    }, 0)
    return request
  }
}

class FakeDatabase {
  private readonly stores: Map<string, Map<string, StoredRecord>>
  readonly objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  }

  constructor(stores: Map<string, Map<string, StoredRecord>>) {
    this.stores = stores
  }

  createObjectStore(name: string) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map())
    }
    return {}
  }

  transaction(name: string) {
    const store = this.stores.get(name)
    if (!store) {
      throw new Error(`Object store ${name} is missing`)
    }

    return new FakeTransaction(store)
  }

  close() {
    return undefined
  }
}

function createFakeIndexedDb() {
  const stores = new Map<string, Map<string, StoredRecord>>()
  let initialized = false

  return {
    open: jest.fn(() => {
      const request = new FakeRequest<FakeDatabase>() as FakeRequest<FakeDatabase> & {
        onupgradeneeded: ((event: { target: FakeRequest<FakeDatabase> }) => void) | null
      }
      request.onupgradeneeded = null

      setTimeout(() => {
        const db = new FakeDatabase(stores)
        request.result = db
        if (!initialized) {
          initialized = true
          request.onupgradeneeded?.({ target: request })
        }
        request.onsuccess?.({ target: request })
      }, 0)

      return request
    }),
  }
}

describe('offlineSyncService', () => {
  beforeEach(() => {
    jest.resetModules()
    createFuelLogMock.mockReset()
    syncOfflineBatchMock.mockReset()
    updateTripChecklistMock.mockReset()
    window.localStorage.clear()
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: createFakeIndexedDb(),
    })
  })

  it('queues a fuel log when the network is unavailable and clears it after sync replay', async () => {
    createFuelLogMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const queueModule = await import('../offlineSyncService')
    const payload: CreateFuelLogInput = {
      tripId: 'TRIP-1001',
      amount: 38.4,
      cost: 3920,
      receipt: new File([new Blob(['receipt'])], 'fuel.jpg', { type: 'image/jpeg' }),
    }

    const queued = await queueModule.submitFuelLogWithOffline(payload)
    expect(queued.status).toBe('queued')

    syncOfflineBatchMock.mockImplementation(async ({ operations }: { operations: Array<{ clientRequestId: string }> }) => {
      const response: SyncBatchResponse = {
        processedAt: new Date().toISOString(),
        appliedCount: 1,
        duplicateCount: 0,
        conflictCount: 0,
        failedCount: 0,
        results: [{
          clientRequestId: operations[0].clientRequestId,
          type: 'FUEL_LOG',
          status: 'APPLIED',
          resolution: 'IDEMPOTENT_CREATE',
          entityId: '15',
          message: 'Fuel log synced.',
          processedAt: new Date().toISOString(),
        }],
      }
      return response
    })

    await queueModule.processOfflineQueue()

    const snapshot = await queueModule.getOfflineSyncSnapshot()
    expect(snapshot.queuedCount).toBe(0)
    expect(syncOfflineBatchMock).toHaveBeenCalledTimes(1)
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'fuel-log',
        status: 'SYNCED',
        entityId: '15',
      }),
    ]))
  })

  it('keeps only the latest queued trip-update snapshot per trip while preserving telemetry history', async () => {
    const queueModule = await import('../offlineSyncService')

    await queueModule.bufferTrackingSnapshot({
      vehicleId: 'VH-101',
      tripId: 'TRIP-1001',
      latitude: 18.52,
      longitude: 73.85,
      speed: 42,
      fuelLevel: 61,
      currentStop: 'Stop A',
      status: 'IN_PROGRESS',
      timestamp: '2026-04-21T10:00:00.000Z',
    })

    await queueModule.bufferTrackingSnapshot({
      vehicleId: 'VH-101',
      tripId: 'TRIP-1001',
      latitude: 18.53,
      longitude: 73.86,
      speed: 38,
      fuelLevel: 59,
      currentStop: 'Stop B',
      status: 'IN_PROGRESS',
      timestamp: '2026-04-21T10:05:00.000Z',
    })

    const snapshot = await queueModule.getOfflineSyncSnapshot()

    expect(snapshot.queuedCount).toBe(3)
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'trip-update', detail: 'Latest trip position queued for TRIP-1001' }),
      expect.objectContaining({ kind: 'telemetry', detail: 'Telemetry queued for TRIP-1001' }),
    ]))
  })
})
