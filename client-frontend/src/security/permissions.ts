import type { AppRole } from '../types'

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'System Admin',
  DRIVER: 'Driver',
  DISPATCHER: 'Dispatcher',
  PLANNER: 'Planner',
  OPERATIONS_MANAGER: 'Operations Manager',
  MAINTENANCE_MANAGER: 'Maintenance Manager',
}

export const ALL_ROLES: AppRole[] = [
  'ADMIN',
  'DRIVER',
  'DISPATCHER',
  'PLANNER',
  'OPERATIONS_MANAGER',
  'MAINTENANCE_MANAGER',
]

const roleAliases: Record<string, AppRole> = {
  ADMIN: 'ADMIN',
  ROLE_ADMIN: 'ADMIN',
  SYSTEM_ADMIN: 'ADMIN',
  DRIVER: 'DRIVER',
  ROLE_DRIVER: 'DRIVER',
  DISPATCHER: 'DISPATCHER',
  ROLE_DISPATCHER: 'DISPATCHER',
  PLANNER: 'PLANNER',
  ROLE_PLANNER: 'PLANNER',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  ROLE_OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  FLEET_OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  FLEET_MANAGER: 'OPERATIONS_MANAGER',
  MAINTENANCE_MANAGER: 'MAINTENANCE_MANAGER',
  ROLE_MAINTENANCE_MANAGER: 'MAINTENANCE_MANAGER',
}

export function normalizeRole(role: string | undefined | null): AppRole | undefined {
  if (!role) {
    return undefined
  }

  const normalized = role.trim().replace(/[-/\s]+/g, '_').toUpperCase()
  return roleAliases[normalized]
}

export function hasAnyRole(role: string | undefined, allowedRoles: readonly AppRole[]) {
  const normalized = normalizeRole(role)
  if (!normalized) {
    return false
  }

  return allowedRoles.includes(normalized)
}

export function canManageTrips(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER'])
}

export function canOperateTripExecution(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'DRIVER'])
}

export function canManageVehicles(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER'])
}

export function canManageDrivers(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER'])
}

export function canManageRoutes(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'PLANNER'])
}

export function canManageMaintenance(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'MAINTENANCE_MANAGER'])
}

export function canManageAlerts(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER', 'DRIVER'])
}

export function canAccessAnalytics(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessAuditLogs(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER'])
}

export function canAccessVehicles(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER'])
}

export function canAccessDrivers(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER'])
}

export function canAccessRoutes(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER'])
}

export function canAccessMaintenance(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'MAINTENANCE_MANAGER'])
}

export function canAccessAlerts(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}

export function canAccessTrips(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}

export function canAccessNotifications(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}

export function canAccessDashboard(role: string | undefined) {
  return hasAnyRole(role, ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'PLANNER', 'MAINTENANCE_MANAGER'])
}

export function canAccessProfile(role: string | undefined) {
  return hasAnyRole(role, ALL_ROLES)
}
