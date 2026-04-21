import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RoutePlanner } from '../../pages/RoutePlanner'

const fetchRoutePlansMock = jest.fn()
const optimizeRoutesMock = jest.fn()
const createRoutePlanMock = jest.fn()
const updateRoutePlanMock = jest.fn()
const deleteRoutePlanMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchRoutePlans: () => fetchRoutePlansMock(),
  optimizeRoutes: (...args: unknown[]) => optimizeRoutesMock(...args),
  createRoutePlan: (...args: unknown[]) => createRoutePlanMock(...args),
  updateRoutePlan: (...args: unknown[]) => updateRoutePlanMock(...args),
  deleteRoutePlan: (...args: unknown[]) => deleteRoutePlanMock(...args),
}))

jest.mock('../../components/RoutePreviewMap', () => ({
  RoutePreviewMap: ({ title }: { title: string }) => <div data-testid="route-preview-map">{title}</div>,
}))

describe('RoutePlanner', () => {
  beforeEach(() => {
    fetchRoutePlansMock.mockResolvedValue([
      {
        id: 'RT-501',
        name: 'Western Corridor Morning Run',
        status: 'In Progress',
        distanceKm: 342,
        estimatedDuration: '6h 15m',
        stops: [
          { name: 'Mumbai Hub', sequence: 1, latitude: 19.076, longitude: 72.8777, status: 'COMPLETED' },
          { name: 'Lonavala', sequence: 2, latitude: 18.7546, longitude: 73.407, status: 'COMPLETED' },
          { name: 'Pune Depot', sequence: 3, latitude: 18.5204, longitude: 73.8567, status: 'IN_PROGRESS' },
        ],
      },
      {
        id: 'RT-503',
        name: 'Southern Last-Mile Sweep',
        status: 'Completed',
        distanceKm: 96,
        estimatedDuration: '2h 10m',
        stops: [
          { name: 'Bengaluru Center', sequence: 1, latitude: 12.9716, longitude: 77.5946, status: 'COMPLETED' },
          { name: 'Whitefield', sequence: 2, latitude: 12.9698, longitude: 77.7499, status: 'COMPLETED' },
        ],
      },
    ])
    optimizeRoutesMock.mockReset()
    createRoutePlanMock.mockReset()
    updateRoutePlanMock.mockReset()
    deleteRoutePlanMock.mockReset()
  })

  it('deletes a route without using the browser confirm dialog', async () => {
    let resolveDelete: (() => void) | undefined
    deleteRoutePlanMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        }),
    )

    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true)

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    const routeHeading = await screen.findByRole('heading', { name: /southern last-mile sweep/i })
    const routeCard = routeHeading.closest('article')

    expect(routeCard).not.toBeNull()

    fireEvent.click(within(routeCard as HTMLElement).getByRole('button', { name: /^delete$/i }))

    expect(deleteRoutePlanMock).toHaveBeenCalledWith('RT-503')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(within(routeCard as HTMLElement).getByRole('button', { name: /deleting/i })).toBeDisabled()

    resolveDelete?.()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /southern last-mile sweep/i })).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })

  it('keeps a leading zero for single digits and removes it at ten', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /add route/i }))

    const distanceInput = screen.getByLabelText(/distance \(km\)/i)

    expect(distanceInput).toHaveDisplayValue('0')

    fireEvent.change(distanceInput, { target: { value: '09' } })
    expect(distanceInput).toHaveDisplayValue('09')

    fireEvent.change(distanceInput, { target: { value: '010' } })
    expect(distanceInput).toHaveDisplayValue('10')
  })

  it('limits the distance input to two decimal places', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /add route/i }))

    const distanceInput = screen.getByLabelText(/distance \(km\)/i)

    fireEvent.change(distanceInput, { target: { value: '09.999' } })
    expect(distanceInput).toHaveDisplayValue('09.99')
  })

  it('creates a route with explicit stop coordinates', async () => {
    createRoutePlanMock.mockResolvedValue({
      id: 'RT-700',
      name: 'Test Route',
      status: 'Scheduled',
      distanceKm: 25,
      estimatedDuration: '1h 15m',
      stops: [
        { name: 'Alpha', sequence: 1, latitude: 19.1, longitude: 72.9, status: 'PENDING' },
        { name: 'Beta', sequence: 2, latitude: 19.2, longitude: 73.0, status: 'PENDING' },
      ],
    })

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /add route/i }))

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Test Route' } })
    fireEvent.change(screen.getByLabelText(/distance \(km\)/i), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText(/estimated duration/i), { target: { value: '1h 15m' } })

    fireEvent.click(screen.getByRole('button', { name: /add stop/i }))
    fireEvent.click(screen.getByRole('button', { name: /add stop/i }))

    fireEvent.change(screen.getAllByLabelText(/^name$/i)[1], { target: { value: 'Alpha' } })
    fireEvent.change(screen.getAllByLabelText(/^name$/i)[2], { target: { value: 'Beta' } })
    fireEvent.change(screen.getAllByLabelText(/latitude/i)[0], { target: { value: '19.1' } })
    fireEvent.change(screen.getAllByLabelText(/latitude/i)[1], { target: { value: '19.2' } })
    fireEvent.change(screen.getAllByLabelText(/longitude/i)[0], { target: { value: '72.9' } })
    fireEvent.change(screen.getAllByLabelText(/longitude/i)[1], { target: { value: '73.0' } })

    fireEvent.click(screen.getByRole('button', { name: /save route/i }))

    await waitFor(() => {
      expect(createRoutePlanMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Route',
        distanceKm: 25,
        estimatedDuration: '1h 15m',
        stops: [
          expect.objectContaining({ name: 'Alpha', sequence: 1, latitude: 19.1, longitude: 72.9 }),
          expect.objectContaining({ name: 'Beta', sequence: 2, latitude: 19.2, longitude: 73.0 }),
        ],
      }))
    })
  })

  it('applies route optimization results to the planner', async () => {
    optimizeRoutesMock.mockResolvedValue([
      {
        id: 'RT-501',
        name: 'Western Corridor Morning Run',
        status: 'In Progress',
        distanceKm: 315,
        estimatedDuration: '5h 41m',
        stops: [
          { name: 'Mumbai Hub', sequence: 1, latitude: 19.076, longitude: 72.8777, status: 'COMPLETED' },
          { name: 'Lonavala', sequence: 2, latitude: 18.7546, longitude: 73.407, status: 'COMPLETED' },
          { name: 'Pune Depot', sequence: 3, latitude: 18.5204, longitude: 73.8567, status: 'IN_PROGRESS' },
          { name: 'Satara Crossdock', sequence: 4, latitude: 17.6805, longitude: 74.0183, status: 'PENDING' },
        ],
      },
      {
        id: 'RT-503',
        name: 'Southern Last-Mile Sweep',
        status: 'Completed',
        distanceKm: 88,
        estimatedDuration: '1h 45m',
        stops: [
          { name: 'Bengaluru Center', sequence: 1, latitude: 12.9716, longitude: 77.5946, status: 'COMPLETED' },
          { name: 'Indiranagar', sequence: 2, latitude: 12.9784, longitude: 77.6408, status: 'COMPLETED' },
          { name: 'Whitefield', sequence: 3, latitude: 12.9698, longitude: 77.7499, status: 'COMPLETED' },
        ],
      },
    ])

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /optimize route/i }))

    expect(optimizeRoutesMock).toHaveBeenCalled()
    expect(
      await screen.findByText(/route optimization applied to 2 plans/i),
    ).toBeInTheDocument()
    expect(screen.getByText('315 km')).toBeInTheDocument()
    expect(screen.getByText('5h 41m')).toBeInTheDocument()
  })
})
