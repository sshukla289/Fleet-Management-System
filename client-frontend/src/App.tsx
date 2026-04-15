import { useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './context/useAuth'
import { hasAnyRole } from './security/permissions'
import { AdminDashboard } from './pages/AdminDashboard'
import { AnalyticsReports } from './pages/AnalyticsReports'
import { AuditLogs } from './pages/AuditLogs'
import { AlertsCenter } from './pages/AlertsCenter'
import { DriverList } from './pages/DriverList'
import { Login } from './pages/Login'
import { MaintenanceAlerts } from './pages/MaintenanceAlerts'
import { MaintenanceDashboard } from './pages/MaintenanceDashboard'
import { OperationsDashboard } from './pages/OperationsDashboard'
import { Profile } from './pages/Profile'
import { RoutePlanner } from './pages/RoutePlanner'
import { PlannerDashboard } from './pages/PlannerDashboard'
import { Trips } from './pages/Trips'
import { DriverDashboard } from './pages/DriverDashboard'
import { DispatcherDashboard } from './pages/DispatcherDashboard'
import { Notifications } from './pages/Notifications'
import { VehicleDetail } from './pages/VehicleDetail'
import { VehicleList } from './pages/VehicleList'
import type { AppRole } from './types'
import './App.css'

function LoadingScreen() {
  return (
    <div className="premium-loader">
      <div className="premium-loader__glass">
        <div className="premium-loader__spinner"></div>
        <div className="premium-loader__text">
          <h3>EXPRESS LOGISTICS</h3>
          <p>Syncing fleet data...</p>
        </div>
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const { isAuthenticated, isLoadingSession } = useAuth()

  if (isLoadingSession) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout />
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-shell__body${collapsed ? ' app-shell__body--collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="app-shell__content">
        <Navbar />
        <main className="app-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function defaultPathForRole(role: string | undefined): string {
  if (hasAnyRole(role, ['DRIVER'])) {
    return '/driver/dashboard'
  }

  if (hasAnyRole(role, ['ADMIN'])) {
    return '/admin/dashboard'
  }

  if (hasAnyRole(role, ['MAINTENANCE_MANAGER'])) {
    return '/maintenance/dashboard'
  }

  if (hasAnyRole(role, ['OPERATIONS_MANAGER'])) {
    return '/operations/dashboard'
  }

  if (hasAnyRole(role, ['PLANNER'])) {
    return '/planner/dashboard'
  }

  if (hasAnyRole(role, ['DISPATCHER'])) {
    return '/dispatcher/dashboard'
  }

  return '/profile'
}

function RoleRoute({ allowedRoles }: { allowedRoles: AppRole[] }) {
  const { session } = useAuth()

  if (!hasAnyRole(session?.profile.role, allowedRoles)) {
    return <Navigate to={defaultPathForRole(session?.profile.role)} replace />
  }

  return <Outlet />
}

function App() {
  const { isAuthenticated, session } = useAuth()
  const defaultPath = defaultPathForRole(session?.profile.role)

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={defaultPath} replace /> : <Login />}
      />
      <Route element={<ProtectedLayout />}>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? defaultPath : '/login'} replace />}
        />
        
        {/* Role-based dashboard aliases */}
        <Route path="/admin/dashboard" element={<RoleRoute allowedRoles={['ADMIN']} />}>
          <Route index element={<AdminDashboard />} />
        </Route>
        <Route path="/maintenance/dashboard" element={<RoleRoute allowedRoles={['MAINTENANCE_MANAGER']} />}>
          <Route index element={<MaintenanceDashboard />} />
        </Route>
        <Route path="/driver/dashboard" element={<RoleRoute allowedRoles={['DRIVER']} />}>
          <Route index element={<DriverDashboard />} />
        </Route>
        <Route path="/dispatcher/dashboard" element={<RoleRoute allowedRoles={['DISPATCHER']} />}>
          <Route index element={<DispatcherDashboard />} />
        </Route>
        <Route path="/planner/dashboard" element={<RoleRoute allowedRoles={['PLANNER']} />}>
          <Route index element={<PlannerDashboard />} />
        </Route>
        <Route path="/operations/dashboard" element={<RoleRoute allowedRoles={['OPERATIONS_MANAGER']} />}>
          <Route index element={<OperationsDashboard />} />
        </Route>

        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER']} />}>
          <Route path="/dashboard" element={<Navigate to={defaultPath} replace />} />
          <Route path="/analytics/reports" element={<AnalyticsReports />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER']} />}>
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER']} />}>
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/alerts" element={<AlertsCenter />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/vehicles" element={<VehicleList />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER']} />}>
          <Route path="/drivers" element={<DriverList />} />
          <Route path="/routes" element={<RoutePlanner />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/maintenance" element={<MaintenanceAlerts />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
