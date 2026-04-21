import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { fetchNotificationCount } from '../services/apiService'

const titles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Operations control tower',
    subtitle: 'Operational KPIs, action queue, alerts, and fleet readiness.',
  },
  '/admin/dashboard': {
    title: 'System Control & Governance',
    subtitle: 'Manage systemic roles, user access models, and review security audit trails.',
  },
  '/maintenance/dashboard': {
    title: 'Maintenance Cockpit',
    subtitle: 'Manage service orders, vehicle health, and workshop schedules.',
  },
  '/driver/dashboard': {
    title: 'Driver Dashboard',
    subtitle: 'Manage your active trips, routes, and operational checklists.',
  },
  '/driver/trip-execution': {
    title: 'Trip Execution',
    subtitle: 'Complete pre-trip and post-trip checklists before each driver action.',
  },
  '/dispatcher/dashboard': {
    title: 'Dispatcher Dashboard',
    subtitle: 'Real-time fleet command: monitoring, driver assignment, and live alerts.',
  },
  '/planner/dashboard': {
    title: 'Route Planner Dashboard',
    subtitle: 'Strategic planning: building routes, sequencing stops, and optimizing for efficiency.',
  },
  '/operations/dashboard': {
    title: 'Operations Manager Dashboard',
    subtitle: 'Strategic fleet intelligence: KPIs, trends, and operational efficiency analysis.',
  },
  '/vehicles': {
    title: 'Vehicles',
    subtitle: 'Manage the active fleet and service bay inventory.',
  },
  '/trips': {
    title: 'Trips',
    subtitle: 'Plan, validate, dispatch, and monitor active trip lifecycles.',
  },
  '/alerts': {
    title: 'Alerts Center',
    subtitle: 'Review maintenance, compliance, and trip exceptions.',
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
  '/analytics/reports': {
    title: 'Analytics Reports',
    subtitle: 'Operational trends for trips, vehicles, drivers, alerts, and maintenance.',
  },
  '/notifications': {
    title: 'Notifications',
    subtitle: 'In-app operational notifications and acknowledgements.',
  },
  '/audit-logs': {
    title: 'Audit logs',
    subtitle: 'Structured records for critical business actions.',
  },
}

const dynamicTitleMatchers: Array<{
  prefix: string
  title: { title: string; subtitle: string }
}> = [
  { prefix: '/vehicles/', title: titles['/vehicles'] },
]

function resolveTitle(pathname: string) {
  const staticTitle = titles[pathname]
  if (staticTitle) {
    return staticTitle
  }

  return dynamicTitleMatchers.find((matcher) => pathname.startsWith(matcher.prefix))?.title ?? titles['/dashboard']
}

export function Navbar() {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const title = useMemo(() => resolveTitle(pathname), [pathname])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)


  useEffect(() => {
    async function loadCount() {
      try {
        const count = await fetchNotificationCount()
        setUnreadCount(count)
      } catch (error) {
        console.error('Failed to fetch notification count', error)
      }
    }

    void loadCount()
    const interval = setInterval(() => void loadCount(), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleCountUpdate = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail
      if (typeof detail === 'number') {
        setUnreadCount(detail)
      }
    }

    window.addEventListener('fleet:notifications:count', handleCountUpdate as EventListener)
    return () => window.removeEventListener('fleet:notifications:count', handleCountUpdate as EventListener)
  }, [])

  return (
    <header className="navbar">
      <div className="navbar__title">
        <h1>{title.title}</h1>
      </div>

      <div className="navbar__controls">

        <button
          aria-label="Notifications"
          className="navbar__notification"
          type="button"
          onClick={() => navigate('/notifications')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          {unreadCount > 0 && <span className="navbar__notification-badge">{unreadCount}</span>}
        </button>
        <button 
          className="navbar__logout-button" 
          disabled={isLoggingOut}
          onClick={async () => {
            setIsLoggingOut(true)
            try {
              // Set a timeout to force logout if the API hangs
              const logoutPromise = logout()
              const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000))
              await Promise.race([logoutPromise, timeoutPromise])
            } catch (error) {
              console.error('Logout failed but proceeding to clear session', error)
            } finally {
              navigate('/login', { replace: true })
            }
          }}
        >
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" x2="9" y1="12" y2="12"></line>
          </svg>
          <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>

      </div>
    </header>
  )
}
