import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const titles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Fleet dashboard',
    subtitle: 'Overview of dispatch, maintenance, and telemetry status.',
  },
  '/vehicles': {
    title: 'Vehicles',
    subtitle: 'Manage the active fleet and service bay inventory.',
  },
  '/trips': {
    title: 'Trips',
    subtitle: 'Plan, validate, dispatch, and monitor active trip lifecycles.',
  },
  '/drivers': {
    title: 'Drivers',
    subtitle: 'Track duty status, assignments, and hours driven.',
  },
  '/maintenance': {
    title: 'Maintenance',
    subtitle: 'Review service alerts and overdue repair items.',
  },
  '/routes': {
    title: 'Routes',
    subtitle: 'Monitor route plans and optimization results.',
  },
  '/profile': {
    title: 'Profile',
    subtitle: 'Update the fleet owner account and password.',
  },
}

export function Navbar() {
  const { session } = useAuth()
  const { pathname } = useLocation()

  const title = useMemo(() => titles[pathname] ?? titles['/dashboard'], [pathname])

  return (
    <header className="navbar">
      <div className="navbar__title">
        <span className="navbar__eyebrow">Organization</span>
        <h1>{title.title}</h1>
        <p>{title.subtitle}</p>
      </div>

      <div className="navbar__controls">
        <button className="navbar__org" type="button">
          <span className="navbar__org-label">Demo Fleet</span>
          <span className="navbar__org-chevron">v</span>
        </button>
        <button aria-label="Notifications" className="navbar__notification" type="button">
          <span className="navbar__notification-badge">3</span>
        </button>
        <div className="navbar__profile">
          <span className="avatar">
            {session?.profile.name
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('') ?? 'FM'}
          </span>
        </div>
      </div>
    </header>
  )
}
