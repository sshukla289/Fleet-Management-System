import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AlertsCenter } from '../../pages/AlertsCenter'

const useAuthMock = jest.fn()
const useDriverInboxMock = jest.fn()
const fetchTripsMock = jest.fn()
const fetchVehiclesMock = jest.fn()
const acknowledgeAlertMock = jest.fn()
const resolveAlertMock = jest.fn()
const replaceAlertMock = jest.fn()
const refreshMock = jest.fn()

jest.mock('../../context/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

jest.mock('../../hooks/useDriverInbox', () => ({
  useDriverInbox: () => useDriverInboxMock(),
}))

jest.mock('../../services/apiService', () => ({
  fetchTrips: () => fetchTripsMock(),
  fetchVehicles: () => fetchVehiclesMock(),
  acknowledgeAlert: (...args: unknown[]) => acknowledgeAlertMock(...args),
  resolveAlert: (...args: unknown[]) => resolveAlertMock(...args),
}))

const alertsFixture = [
  {
    id: 'AL-1',
    category: 'SAFETY',
    severity: 'CRITICAL',
    status: 'OPEN',
    title: 'Engine temp spike',
    description: 'Engine temperature crossed the critical threshold during active dispatch.',
    sourceType: 'telemetry',
    sourceId: 'VH-1001',
    relatedTripId: 'TRIP-1001',
    relatedVehicleId: 'VH-1001',
    metadataJson: null,
    createdAt: '2026-04-22T09:00:00',
    updatedAt: '2026-04-22T09:04:00',
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
  },
  {
    id: 'AL-2',
    category: 'LOW_FUEL',
    severity: 'MEDIUM',
    status: 'ACKNOWLEDGED',
    title: 'Fuel drift detected',
    description: 'Fuel reserves dipped below the preferred control band.',
    sourceType: 'telemetry',
    sourceId: 'VH-2002',
    relatedTripId: 'TRIP-2002',
    relatedVehicleId: 'VH-2002',
    metadataJson: null,
    createdAt: '2026-04-22T08:30:00',
    updatedAt: '2026-04-22T08:45:00',
    acknowledgedAt: '2026-04-22T08:40:00',
    resolvedAt: null,
    closedAt: null,
  },
] as const

describe('AlertsCenter admin governance', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      session: {
        token: 'test-token',
        profile: {
          id: 'USR-2',
          name: 'Super Admin Console',
          role: 'ADMIN',
          email: 'admin@gmail.com',
          assignedRegion: 'Global',
        },
      },
    })

    useDriverInboxMock.mockReturnValue({
      alerts: alertsFixture,
      notifications: [],
      loading: false,
      error: null,
      refresh: refreshMock,
      connectionState: 'connected',
      lastSyncedAt: '2026-04-22T09:05:00',
      unreadCount: 0,
      replaceAlert: replaceAlertMock,
      replaceNotification: jest.fn(),
      driverId: undefined,
      realtimeEnabled: true,
    })

    fetchTripsMock.mockResolvedValue([
      {
        tripId: 'TRIP-1001',
        routeId: 'RT-501',
        assignedVehicleId: 'VH-1001',
        assignedDriverId: 'DR-201',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        source: 'Mumbai',
        destination: 'Pune',
        stops: [],
        plannedStartTime: '2026-04-22T06:00:00',
        plannedEndTime: '2026-04-22T10:00:00',
        actualStartTime: '2026-04-22T06:10:00',
        actualEndTime: null,
        pausedAt: null,
        estimatedDistance: 144,
        actualDistance: 121,
        estimatedDuration: '04:00',
        actualDuration: null,
        dispatchStatus: 'DISPATCHED',
        complianceStatus: 'COMPLIANT',
        optimizationStatus: 'OPTIMIZED',
        remarks: null,
        pauseReason: null,
        delayMinutes: 12,
        fuelUsed: 18,
        completionProcessedAt: null,
      },
      {
        tripId: 'TRIP-2002',
        routeId: 'RT-602',
        assignedVehicleId: 'VH-2002',
        assignedDriverId: 'DR-301',
        status: 'DISPATCHED',
        priority: 'MEDIUM',
        source: 'Delhi',
        destination: 'Jaipur',
        stops: [],
        plannedStartTime: '2026-04-22T07:00:00',
        plannedEndTime: '2026-04-22T13:00:00',
        actualStartTime: null,
        actualEndTime: null,
        pausedAt: null,
        estimatedDistance: 281,
        actualDistance: 0,
        estimatedDuration: '06:00',
        actualDuration: null,
        dispatchStatus: 'DISPATCHED',
        complianceStatus: 'REVIEW_REQUIRED',
        optimizationStatus: 'OPTIMIZED',
        remarks: null,
        pauseReason: null,
        delayMinutes: 0,
        fuelUsed: null,
        completionProcessedAt: null,
      },
    ])

    fetchVehiclesMock.mockResolvedValue([
      {
        id: 'VH-1001',
        name: 'Atlas Prime',
        type: 'Heavy Truck',
        status: 'Active',
        location: 'Mumbai Hub',
        assignedRegion: 'North',
        fuelLevel: 42,
        mileage: 128540,
        driverId: 'DR-201',
      },
      {
        id: 'VH-2002',
        name: 'Desert Runner',
        type: 'Trailer',
        status: 'Active',
        location: 'Delhi Hub',
        assignedRegion: 'South',
        fuelLevel: 21,
        mileage: 86540,
        driverId: 'DR-301',
      },
    ])

    acknowledgeAlertMock.mockReset()
    resolveAlertMock.mockReset()
    replaceAlertMock.mockReset()
    refreshMock.mockReset()
  })

  it('pins critical alerts and filters the admin queue by severity, trip, and region', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AlertsCenter />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /admin alert governance/i })).toBeInTheDocument()

    const criticalBoard = screen.getByRole('heading', { name: /critical watchlist/i }).closest('section')
    const queueSection = screen.getByRole('heading', { name: /alert queue/i }).closest('section')

    expect(criticalBoard).not.toBeNull()
    expect(queueSection).not.toBeNull()

    expect(within(criticalBoard as HTMLElement).getByRole('heading', { name: /engine temp spike/i })).toBeInTheDocument()
    expect(within(queueSection as HTMLElement).getByRole('heading', { name: /engine temp spike/i })).toBeInTheDocument()
    expect(within(queueSection as HTMLElement).getByRole('heading', { name: /fuel drift detected/i })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: /severity/i }), { target: { value: 'MEDIUM' } })
    fireEvent.change(screen.getByRole('combobox', { name: /trip focus/i }), { target: { value: 'TRIP-2002' } })
    fireEvent.change(screen.getByRole('combobox', { name: /^region$/i }), { target: { value: 'South' } })

    await waitFor(() => {
      expect(within(queueSection as HTMLElement).queryByRole('heading', { name: /engine temp spike/i })).not.toBeInTheDocument()
      expect(within(queueSection as HTMLElement).getByRole('heading', { name: /fuel drift detected/i })).toBeInTheDocument()
    })
  })

  it('resolves alerts from the admin queue and updates the realtime feed state', async () => {
    resolveAlertMock.mockResolvedValue({
      ...alertsFixture[1],
      status: 'RESOLVED',
      resolvedAt: '2026-04-22T09:12:00',
      updatedAt: '2026-04-22T09:12:00',
    })

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AlertsCenter />
      </MemoryRouter>,
    )

    const queueSection = await screen.findByRole('heading', { name: /alert queue/i })
    const mediumCard = within(queueSection.closest('section') as HTMLElement)
      .getByRole('heading', { name: /fuel drift detected/i })
      .closest('article')

    expect(mediumCard).not.toBeNull()

    fireEvent.click(within(mediumCard as HTMLElement).getByRole('button', { name: /^resolve$/i }))

    await waitFor(() => {
      expect(resolveAlertMock).toHaveBeenCalledWith('AL-2')
      expect(replaceAlertMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'AL-2', status: 'RESOLVED' }))
    })
  })
})
