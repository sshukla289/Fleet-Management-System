import type { CreateIssueInput, CreateSosInput } from '../../types'

const reportIssueMock = jest.fn()
const sendSosMock = jest.fn()

jest.mock('../apiService', () => ({
  reportIssue: (...args: unknown[]) => reportIssueMock(...args),
  sendSos: (...args: unknown[]) => sendSosMock(...args),
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

describe('driverEmergencyQueue', () => {
  beforeEach(() => {
    jest.resetModules()
    reportIssueMock.mockReset()
    sendSosMock.mockReset()
    window.localStorage.clear()
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: createFakeIndexedDb(),
    })
  })

  it('persists queued issue reports and exposes them after module reload', async () => {
    reportIssueMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const queueModule = await import('../driverEmergencyQueue')
    const payload: CreateIssueInput = {
      type: 'ACCIDENT',
      description: 'Minor collision reported on bypass',
      tripId: 'TRIP-1001',
      lat: 18.52,
      lng: 73.85,
      image: new File([new Blob(['evidence'])], 'crash.jpg', { type: 'image/jpeg' }),
    }

    const result = await queueModule.submitIssueWithQueue(payload)
    expect(result.status).toBe('queued')

    const reloadedModule = await import('../driverEmergencyQueue')
    const queuedItems = await reloadedModule.listQueuedEmergencyJobs()
    const receipts = await reloadedModule.listEmergencyDeliveryReceipts()

    expect(queuedItems).toHaveLength(1)
    expect(queuedItems[0]).toEqual(expect.objectContaining({
      kind: 'issue',
      tripId: 'TRIP-1001',
    }))
    expect(queuedItems[0].label).toContain('ACCIDENT')
    expect(receipts).toHaveLength(1)
    expect(receipts[0]).toEqual(expect.objectContaining({
      kind: 'issue',
      tripId: 'TRIP-1001',
      status: 'QUEUED',
      retryCount: 0,
    }))
  })

  it('retries queued issues and SOS jobs and clears the queue after success', async () => {
    reportIssueMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    sendSosMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    reportIssueMock.mockResolvedValue({ id: 'IS-22' })
    sendSosMock.mockResolvedValue({ alertId: 'AL-88' })

    const queueModule = await import('../driverEmergencyQueue')
    const issuePayload: CreateIssueInput = {
      type: 'BREAKDOWN',
      description: 'Engine stopped',
      tripId: 'TRIP-9001',
      lat: 19.07,
      lng: 72.88,
      image: new File([new Blob(['engine'])], 'engine.png', { type: 'image/png' }),
    }
    const sosPayload: CreateSosInput = {
      tripId: 'TRIP-9001',
      lat: 19.07,
      lng: 72.88,
    }

    await queueModule.submitIssueWithQueue(issuePayload)
    await queueModule.submitSosWithQueue(sosPayload)
    expect(await queueModule.listQueuedEmergencyJobs()).toHaveLength(2)

    await queueModule.processEmergencyQueue()

    expect(reportIssueMock).toHaveBeenCalledTimes(2)
    expect(sendSosMock).toHaveBeenCalledTimes(2)
    expect(await queueModule.listQueuedEmergencyJobs()).toHaveLength(0)
    const receipts = await queueModule.listEmergencyDeliveryReceipts()
    expect(receipts).toHaveLength(2)
    expect(receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'issue',
        status: 'DELIVERED',
        deliveredEntityId: 'IS-22',
        retryCount: 1,
      }),
      expect.objectContaining({
        kind: 'sos',
        status: 'DELIVERED',
        deliveredEntityId: 'AL-88',
        retryCount: 1,
      }),
    ]))

    const retriedIssuePayload = reportIssueMock.mock.calls[1][0] as CreateIssueInput
    expect(retriedIssuePayload.image).toBeInstanceOf(File)
    expect(retriedIssuePayload.image?.name).toBe('engine.png')
  })
})
