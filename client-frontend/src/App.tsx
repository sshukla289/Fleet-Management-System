import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './context/useAuth'
import { Dashboard } from './pages/Dashboard'
import { AnalyticsReports } from './pages/AnalyticsReports'
import { AuditLogs } from './pages/AuditLogs'
import { AlertsCenter } from './pages/AlertsCenter'
import { DriverList } from './pages/DriverList'
import { Login } from './pages/Login'
import { MaintenanceAlerts } from './pages/MaintenanceAlerts'
import { Profile } from './pages/Profile'
import { RoutePlanner } from './pages/RoutePlanner'
import { Trips } from './pages/Trips'
import { Notifications } from './pages/Notifications'
import { VehicleDetail } from './pages/VehicleDetail'
import { VehicleList } from './pages/VehicleList'
import './App.css'

function ProtectedLayout() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout />
}

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-shell__body">
        <Sidebar />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route element={<ProtectedLayout />}>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics/reports" element={<AnalyticsReports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/alerts" element={<AlertsCenter />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/vehicles" element={<VehicleList />} />
        <Route path="/vehicles/:id" element={<VehicleDetail />} />
        <Route path="/drivers" element={<DriverList />} />
        <Route path="/maintenance" element={<MaintenanceAlerts />} />
        <Route path="/routes" element={<RoutePlanner />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}

export default App
