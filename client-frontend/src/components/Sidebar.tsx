import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const groups = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: '01' }],
  },
  {
    title: 'Fleet control',
    items: [
      { label: 'Vehicles', path: '/vehicles', icon: '02' },
      { label: 'Trips', path: '/trips', icon: '05' },
      { label: 'Drivers', path: '/drivers', icon: '03' },
      { label: 'Routes', path: '/routes', icon: '04' },
    ],
  },
  {
    title: 'Account',
    items: [{ label: 'Profile', path: '/profile', icon: 'PR' }],
  },
]

export function Sidebar() {
  const { logout, session } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">F</div>
        <div>
          <strong>Demo Fleet</strong>
          <p>Operations control room</p>
        </div>
      </div>

      <div className="sidebar__nav">
        {groups.map((group) => (
          <div key={group.title} className="sidebar__section">
            <h2 className="sidebar__title">{group.title}</h2>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
                to={item.path}
              >
                <span className="sidebar__icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__profile">
          <span className="sidebar__avatar">
            {session?.profile.name
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('') ?? 'FM'}
          </span>
          <div>
            <strong>{session?.profile.name ?? 'Fleet Owner'}</strong>
            <p>{session?.profile.role ?? 'Operations lead'}</p>
          </div>
        </div>
        <button className="sidebar__logout" type="button" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
