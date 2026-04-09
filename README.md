# Fleet Management System

Production-oriented fleet operations platform built around the trip lifecycle.

## Lifecycle

The system is designed around a single operational spine:

`Plan -> Validate -> Optimize -> Dispatch -> Track -> Alert -> Complete -> Analyze -> Maintain`

### 11-step business flow

1. Login
2. Dashboard shows operational KPIs and the action queue
3. Planner creates or imports trips
4. System checks:
   - vehicle availability
   - driver availability
   - maintenance blocks
   - compliance constraints
   - driver hour limits
   - route feasibility
   - time conflicts
5. Route optimization runs using route data and constraints
6. Dispatch trip
7. Telemetry streams live updates
8. Event engine generates alerts
9. Dashboard highlights exceptions
10. Trip closes
11. Post-trip analytics and maintenance scheduling update

## Target Architecture

### Core domain

The `Trip` aggregate is the center of the platform.

It connects:

- vehicle
- driver
- route
- dispatch
- telemetry
- alerts
- compliance
- analytics
- maintenance

### Backend modules

- Auth & RBAC
- Vehicle Management
- Driver Management
- Route Management
- Trip Planning
- Allocation & Validation Engine
- Dispatch Management
- Telemetry Tracking
- Event & Alert Engine
- Dashboard / Control Tower
- Maintenance Planning
- Compliance Management
- Analytics & Reports
- Notifications
- Audit Logging

### Frontend modules

- Login
- Dashboard
- Vehicles
- Vehicle Detail
- Drivers
- Driver Detail
- Trips
- Trip Planner
- Trip Detail / Live Tracking
- Dispatch Board
- Alerts Center
- Maintenance
- Compliance Center
- Analytics / Reports
- Profile
- Admin / User Management

## Implemented domain model

### Trip entity

The backend now includes a central trip entity with:

- `tripId`
- `routeId`
- `assignedVehicleId`
- `assignedDriverId`
- `status`
- `priority`
- `source`
- `destination`
- `stops`
- `plannedStartTime`
- `plannedEndTime`
- `actualStartTime`
- `actualEndTime`
- `estimatedDistance`
- `actualDistance`
- `estimatedDuration`
- `actualDuration`
- `dispatchStatus`
- `complianceStatus`
- `optimizationStatus`
- `remarks`

### Trip lifecycle statuses

- `DRAFT`
- `VALIDATED`
- `OPTIMIZED`
- `DISPATCHED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `BLOCKED`

### Supporting lifecycle statuses

- Dispatch: `NOT_DISPATCHED`, `QUEUED`, `DISPATCHED`, `RELEASED`
- Compliance: `PENDING`, `COMPLIANT`, `REVIEW_REQUIRED`, `BLOCKED`
- Optimization: `NOT_STARTED`, `READY`, `OPTIMIZED`, `FAILED`

## First implementation batch

The first batch focuses on the foundation that unlocks the rest of the workflow.

### Implemented

- Trip Management module
- Validation engine
- Dispatch flow
- Telemetry-to-trip linkage
- Trip control board page
- Explicit mock-mode gating in the frontend API layer
- Root workflow documentation

### Backend files added

- `backend/src/main/java/com/fleet/modules/trip/entity/Trip.java`
- `backend/src/main/java/com/fleet/modules/trip/entity/TripStatus.java`
- `backend/src/main/java/com/fleet/modules/trip/entity/TripPriority.java`
- `backend/src/main/java/com/fleet/modules/trip/entity/TripDispatchStatus.java`
- `backend/src/main/java/com/fleet/modules/trip/entity/TripComplianceStatus.java`
- `backend/src/main/java/com/fleet/modules/trip/entity/TripOptimizationStatus.java`
- `backend/src/main/java/com/fleet/modules/trip/repository/TripRepository.java`
- `backend/src/main/java/com/fleet/modules/trip/service/TripService.java`
- `backend/src/main/java/com/fleet/modules/trip/service/TripValidationService.java`
- `backend/src/main/java/com/fleet/modules/trip/service/TripOptimizationService.java`
- `backend/src/main/java/com/fleet/modules/trip/service/TripDispatchService.java`
- `backend/src/main/java/com/fleet/modules/trip/controller/TripController.java`

### Backend files updated

- `backend/src/main/java/com/fleet/modules/telemetry/entity/Telemetry.java`
- `backend/src/main/java/com/fleet/modules/telemetry/dto/TelemetryDTO.java`
- `backend/src/main/java/com/fleet/modules/telemetry/repository/TelemetryRepository.java`
- `backend/src/main/java/com/fleet/modules/telemetry/service/TelemetryService.java`
- `backend/src/main/java/com/fleet/modules/telemetry/controller/TelemetryController.java`
- `backend/src/main/java/com/fleet/modules/maintenance/repository/MaintenanceAlertRepository.java`
- `backend/src/main/java/com/fleet/config/DataSeeder.java`

### Frontend files added or updated

- `client-frontend/src/pages/Trips.tsx`
- `client-frontend/src/types/index.ts`
- `client-frontend/src/services/apiService.ts`
- `client-frontend/src/App.tsx`
- `client-frontend/src/components/Sidebar.tsx`
- `client-frontend/src/components/Navbar.tsx`
- `client-frontend/src/App.css`

## Database and entity design

### Current storage approach

The existing project uses MySQL through Spring Data JPA.

### Recommended table direction

- `trips`
- `trip_stops`
- `telemetry`
- `maintenance_alerts`
- `vehicles`
- `drivers`
- `route_plans`
- `users`

### Future schema improvements

- add foreign keys where the current code only stores IDs
- normalize trip status history into an audit table
- add trip event stream table for exceptions and alerts
- add compliance snapshots for immutable trip validation records

## API design

### Trip API

- `GET /api/trips`
- `GET /api/trips/{tripId}`
- `POST /api/trips`
- `POST /api/trips/{tripId}/validate`
- `POST /api/trips/{tripId}/optimize`
- `POST /api/trips/{tripId}/dispatch`
- `POST /api/trips/{tripId}/start`
- `POST /api/trips/{tripId}/complete`
- `GET /api/trips/{tripId}/telemetry`

### Telemetry API

- `POST /api/telemetry`
- `GET /api/telemetry/{vehicleId}`
- `GET /api/telemetry/trip/{tripId}`

### Production rule

The frontend no longer silently falls back to mock data unless mock mode is explicitly enabled.

Set:

- `VITE_USE_MOCK_API=true`

to allow local mock behavior.

## Frontend redesign

### Current direction

The app is being refactored from a CRUD demo into a control tower.

### Navigation now emphasizes

- Dashboard
- Trips
- Vehicles
- Drivers
- Routes
- Profile

### Trips page behavior

- create a new trip
- validate readiness
- optimize the trip route
- dispatch it
- start it
- complete it
- review live telemetry

## Migration plan

### Phase 1

- Trip Management
- Validation Engine
- Dispatch Flow
- Telemetry-to-Trip linkage

### Phase 2

- Dashboard KPIs
- Alert engine
- Maintenance blocking
- Compliance checks

### Phase 3

- Analytics
- Post-trip processing
- Notifications
- Audit logs

## Notes for future work

- Replace string-based resource statuses in the older modules with enum-backed models where practical.
- Add role-based access control around planner, dispatcher, maintenance, and admin flows.
- Replace mock data in the frontend with a hard opt-in mock flag only.
- Add trip history and audit trails before introducing deeper analytics.

## Run mode

### Frontend

- Production mode expects the backend API to be available.
- Mock mode is only enabled when `VITE_USE_MOCK_API=true`.

### Backend

- Spring Boot API on the existing port configuration.
- MySQL remains the persistence layer.

