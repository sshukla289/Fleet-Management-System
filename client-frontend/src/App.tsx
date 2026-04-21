import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { DriverEmergencyHub } from './components/DriverEmergencyHub'
import { useAuth } from './context/useAuth'
import { hasAnyRole } from './security/permissions'
import type { AppRole } from './types'
import './App.css'

const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard })))
const AdminUsersPage = lazy(() => import('./pages/AdminUsers').then((module) => ({ default: module.AdminUsersPage })))
const AnalyticsReports = lazy(() => import('./pages/AnalyticsReports').then((module) => ({ default: module.AnalyticsReports })))
const AuditLogs = lazy(() => import('./pages/AuditLogs').then((module) => ({ default: module.AuditLogs })))
const AlertsCenter = lazy(() => import('./pages/AlertsCenter').then((module) => ({ default: module.AlertsCenter })))
const DriverList = lazy(() => import('./pages/DriverList').then((module) => ({ default: module.DriverList })))
const DispatcherDashboard = lazy(() => import('./pages/DispatcherDashboard').then((module) => ({ default: module.DispatcherDashboard })))
const DriverPerformance = lazy(() => import('./pages/DriverPerformance').then((module) => ({ default: module.DriverPerformance })))
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })))
const MaintenanceAlerts = lazy(() => import('./pages/MaintenanceAlerts').then((module) => ({ default: module.MaintenanceAlerts })))
const MaintenanceDashboard = lazy(() => import('./pages/MaintenanceDashboard').then((module) => ({ default: module.MaintenanceDashboard })))
const Notifications = lazy(() => import('./pages/Notifications').then((module) => ({ default: module.Notifications })))
const OperationsDashboard = lazy(() => import('./pages/OperationsDashboard').then((module) => ({ default: module.OperationsDashboard })))
const PlannerDashboard = lazy(() => import('./pages/PlannerDashboard').then((module) => ({ default: module.PlannerDashboard })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))
const RoutePlanner = lazy(() => import('./pages/RoutePlanner').then((module) => ({ default: module.RoutePlanner })))
const Trips = lazy(() => import('./pages/Trips').then((module) => ({ default: module.Trips })))
const TripExecutionPage = lazy(() => import('./pages/TripExecutionPage').then((module) => ({ default: module.TripExecutionPage })))
const VehicleDetail = lazy(() => import('./pages/VehicleDetail').then((module) => ({ default: module.VehicleDetail })))
const VehicleList = lazy(() => import('./pages/VehicleList').then((module) => ({ default: module.VehicleList })))

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

function RouteLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
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
  const { session } = useAuth()

  return (
    <div className={`app-shell__body${collapsed ? ' app-shell__body--collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="app-shell__content">
        <Navbar />
        <main className="app-shell__main">
          <Outlet />
        </main>
        {session?.profile.role === 'DRIVER' && <DriverEmergencyHub />}
      </div>
    </div>
  )
}

function defaultPathForRole(role: string | undefined): string {
  if (hasAnyRole(role, ['DRIVER'])) {
    return '/driver/trip-execution'
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
        element={isAuthenticated ? <Navigate to={defaultPath} replace /> : <RouteLoader><Login /></RouteLoader>}
      />
      <Route element={<ProtectedLayout />}>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? defaultPath : '/login'} replace />}
        />
        
        {/* Role-based dashboard aliases */}
        <Route path="/admin/dashboard" element={<RoleRoute allowedRoles={['ADMIN']} />}>
          <Route index element={<RouteLoader><AdminDashboard /></RouteLoader>} />
        </Route>
        <Route path="/admin/users" element={<RoleRoute allowedRoles={['ADMIN']} />}>
          <Route index element={<RouteLoader><AdminUsersPage /></RouteLoader>} />
        </Route>
        <Route path="/maintenance/dashboard" element={<RoleRoute allowedRoles={['MAINTENANCE_MANAGER']} />}>
          <Route index element={<RouteLoader><MaintenanceDashboard /></RouteLoader>} />
        </Route>
        <Route path="/driver/dashboard" element={<RoleRoute allowedRoles={['DRIVER']} />}>
          <Route index element={<Navigate to="/driver/trip-execution" replace />} />
        </Route>
        <Route path="/driver/trip-execution" element={<RoleRoute allowedRoles={['DRIVER']} />}>
          <Route index element={<RouteLoader><TripExecutionPage /></RouteLoader>} />
        </Route>
        <Route path="/driver/performance" element={<RoleRoute allowedRoles={['DRIVER']} />}>
          <Route index element={<RouteLoader><DriverPerformance /></RouteLoader>} />
        </Route>
        <Route path="/dispatcher/dashboard" element={<RoleRoute allowedRoles={['DISPATCHER']} />}>
          <Route index element={<RouteLoader><DispatcherDashboard /></RouteLoader>} />
        </Route>
        <Route path="/planner/dashboard" element={<RoleRoute allowedRoles={['PLANNER']} />}>
          <Route index element={<RouteLoader><PlannerDashboard /></RouteLoader>} />
        </Route>
        <Route path="/operations/dashboard" element={<RoleRoute allowedRoles={['OPERATIONS_MANAGER']} />}>
          <Route index element={<RouteLoader><OperationsDashboard /></RouteLoader>} />
        </Route>

        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER']} />}>
          <Route path="/dashboard" element={<Navigate to={defaultPath} replace />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/analytics/reports" element={<RouteLoader><AnalyticsReports /></RouteLoader>} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER']} />}>
          <Route path="/audit-logs" element={<RouteLoader><AuditLogs /></RouteLoader>} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER']} />}>
          <Route path="/notifications" element={<RouteLoader><Notifications /></RouteLoader>} />
          <Route path="/alerts" element={<RouteLoader><AlertsCenter /></RouteLoader>} />
          <Route path="/profile" element={<RouteLoader><Profile /></RouteLoader>} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/trips" element={<RouteLoader><Trips /></RouteLoader>} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/vehicles" element={<RouteLoader><VehicleList /></RouteLoader>} />
          <Route path="/vehicles/:id" element={<RouteLoader><VehicleDetail /></RouteLoader>} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER']} />}>
          <Route path="/drivers" element={<RouteLoader><DriverList /></RouteLoader>} />
          <Route path="/routes" element={<RouteLoader><RoutePlanner /></RouteLoader>} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'OPERATIONS_MANAGER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/maintenance" element={<RouteLoader><MaintenanceAlerts /></RouteLoader>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
