import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { hasAnyRole } from '../security/permissions'
import type { AppRole } from '../types'

const groups = [
  {
    title: 'MENU',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER'] },
      { label: 'Analytics', path: '/analytics/reports', icon: <svg viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER'] },
      { label: 'Audit logs', path: '/audit-logs', icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER'] },
    ],
  },
  {
    title: 'FLEET CONTROL',
    items: [
      { label: 'Vehicles', path: '/vehicles', icon: <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER'] },
      { label: 'Trips', path: '/trips', icon: <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER', 'DRIVER'] },
      { label: 'Alerts', path: '/alerts', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER', 'DRIVER'] },
      { label: 'Drivers', path: '/drivers', icon: <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER'] },
      { label: 'Maintenance', path: '/maintenance', icon: <svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'MAINTENANCE_MANAGER'] },
      { label: 'Routes', path: '/routes', icon: <svg viewBox="0 0 24 24"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>, roles: ['ADMIN', 'OPERATIONS_MANAGER', 'PLANNER'] },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [{ label: 'Profile', path: '/profile', icon: <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>, roles: ['ADMIN', 'DRIVER', 'DISPATCHER', 'PLANNER', 'OPERATIONS_MANAGER', 'MAINTENANCE_MANAGER'] }],
  },
] as const satisfies Array<{
  title: string
  items: Array<{
    label: string
    path: string
    icon: React.ReactNode
    roles: readonly AppRole[]
  }>
}>

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { session } = useAuth()
  const role = session?.profile.role
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAnyRole(role, item.roles)),
    }))
    .filter((group) => group.items.length > 0)


  const location = useLocation()

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      {/* Collapse toggle */}
      {onToggle && (
        <button
          className="sidebar__collapse-btn"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
          </svg>
        </button>
      )}

      {/* Logo */}
      <div className="sidebar__brand">
        <img src="/logo.png" alt="Express Logistics Logo" className="sidebar__logo-img" />
      </div>

      {/* Navigation */}
      <div className="sidebar__nav">
        {visibleGroups.map((group) => (
          <div key={group.title} className="sidebar__section">
            <h2 className="sidebar__title">{group.title}</h2>
            {group.items.map((item) => {
              const isDashboard = item.label === 'Dashboard'
              const isActive = isDashboard 
                ? location.pathname.endsWith('/dashboard') 
                : location.pathname === item.path

              return (
                <NavLink
                  key={item.path}
                  className={`sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="sidebar__icon">{item.icon}</span>
                  <span className="sidebar__link-label">{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>
    </aside>
  )
}