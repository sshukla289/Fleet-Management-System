import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../../pages/Dashboard'

describe('Dashboard', () => {
  it('renders the fleet dashboard heading', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /fleet dashboard/i })).toBeInTheDocument()
    expect((await screen.findAllByText(/atlas prime/i)).length).toBeGreaterThan(0)
  })

  it('allows latitude and longitude fields to stay blank while editing', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /speed profile/i })

    const latitudeInput = await screen.findByLabelText(/latitude/i)
    const longitudeInput = screen.getByLabelText(/longitude/i)

    fireEvent.change(latitudeInput, { target: { value: '' } })
    fireEvent.change(longitudeInput, { target: { value: '' } })

    expect(latitudeInput).toHaveDisplayValue('')
    expect(longitudeInput).toHaveDisplayValue('')
  })
})
