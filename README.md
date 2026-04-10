# Fleet Management System

Fleet Management System is a role-based operations platform for planning trips, assigning vehicles and drivers, tracking live telemetry, handling alerts, managing maintenance, and reviewing analytics across the fleet lifecycle.

This README is written for someone who is new to the codebase and new to the product. It explains what the project does, how to run it, how authentication works, what each role can do, and how to explore the system safely.

## What the project does

The application is built around one main operational lifecycle:

`Plan -> Validate -> Optimize -> Dispatch -> Track -> Alert -> Complete -> Analyze -> Maintain`

In practical terms, the system helps an operations team:

- manage vehicles, drivers, routes, and trips
- validate whether a trip is ready to run
- dispatch trips only when compliance and maintenance checks allow it
- capture live telemetry during trip execution
- raise operational alerts and notifications
- review dashboards, analytics, and audit logs
- manage access using role-based access control (RBAC)

## Product modules

### Backend modules

- Auth and RBAC
- Profile management
- Admin user management
- Vehicle management
- Driver management
- Route planning
- Trip planning and dispatch
- Telemetry tracking
- Alerts
- Maintenance alerts and maintenance schedules
- Compliance checks
- Dashboard analytics
- Operational analytics
- Notifications
- Audit logging

### Frontend pages

- Login
- Dashboard
- Trips
- Vehicles
- Drivers
- Routes
- Alerts Center
- Maintenance
- Analytics and Reports
- Notifications
- Audit Logs
- Profile
- Admin user management

## Architecture overview

The system has three main runtime parts:

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Operator-facing UI |
| Backend | Spring Boot + Spring Security + Spring Data JPA | Business logic, RBAC, APIs |
| Database | MySQL 8.4 | Persistent storage |

### High-level flow

1. A user signs in through the frontend.
2. The backend returns a token and the user profile.
3. The frontend stores that session in local storage and attaches the token to API requests.
4. Spring Security checks the token and role before each protected action.
5. Business services enforce extra access rules, especially for drivers.

### Project structure

```text
backend/            Spring Boot API, security, services, repositories, entities
client-frontend/    React application and API client
docs/               Project notes and stabilization report
scripts/            Local helper scripts such as git hook installation
docker-compose.yml  Full local development stack
DOCKER.md           Docker-focused development notes
```

## Core domain model

The `Trip` aggregate is the center of the product. It connects:

- vehicle
- driver
- route
- dispatch state
- telemetry
- alerts
- compliance state
- analytics
- maintenance impact

### Main trip fields

- trip ID
- route ID
- assigned vehicle ID
- assigned driver ID
- source and destination
- planned and actual start/end time
- estimated and actual distance
- estimated and actual duration
- trip status
- dispatch status
- compliance status
- optimization status
- remarks

### Trip lifecycle statuses

- `DRAFT`
- `VALIDATED`
- `OPTIMIZED`
- `DISPATCHED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `BLOCKED`

### Supporting statuses

- Dispatch: `NOT_DISPATCHED`, `QUEUED`, `DISPATCHED`, `RELEASED`
- Compliance: `PENDING`, `COMPLIANT`, `REVIEW_REQUIRED`, `BLOCKED`
- Optimization: `NOT_STARTED`, `READY`, `OPTIMIZED`, `FAILED`

## Authentication and security

The backend uses token-based authentication.

### Public routes

These routes can be called without logging in:

- `GET /`
- `GET /api/health`
- `POST /api/auth/login`

Everything else requires authentication.

### Login flow

1. Call `POST /api/auth/login` with email and password.
2. The backend returns:
   - `token`
   - `profile`
3. Send the token as:

```http
Authorization: Bearer <token>
```

### Frontend session behavior

The frontend:

- stores the authenticated session in local storage
- automatically sends the bearer token on protected API requests
- clears the stored session if the backend returns `401`

### Security note about drivers

Controller-level RBAC allows drivers to access some trip, telemetry, alert, and notification endpoints, but service-layer checks further restrict them to their own assigned trip or active vehicle context. This means drivers cannot see other drivers' operational data even if the endpoint itself is driver-enabled.

## Roles and responsibilities

The system currently supports five roles:

| Role | Purpose |
| --- | --- |
| `ADMIN` | Full administrative control, including user-role management |
| `FLEET_MANAGER` | Fleet-wide operational control across planning, maintenance, analytics, and audit visibility |
| `DISPATCHER_PLANNER` | Day-to-day route, driver, and trip planning and dispatch operations |
| `MAINTENANCE_MANAGER` | Maintenance scheduling, maintenance issue handling, operational visibility, and exception review |
| `DRIVER` | Execute assigned trips, submit telemetry, and monitor only driver-relevant data |

### Role-by-role explanation

#### Admin

Admin can use the full system. This role is the only one allowed to manage user roles through the admin API.

Typical tasks:

- view all operational data
- create, update, and delete vehicles
- create, update, and delete drivers
- create, update, and delete routes
- create and dispatch trips
- view audit logs
- reassign user roles

#### Fleet Manager

Fleet Manager is the main operational owner of the fleet. This role has broad control over operations, but not user-role administration.

Typical tasks:

- create and manage vehicles
- manage routes and drivers
- create, validate, optimize, dispatch, and cancel trips
- review maintenance issues and schedules
- review compliance, dashboard metrics, alerts, and analytics
- review audit logs

#### Dispatcher / Planner

Dispatcher / Planner focuses on routing, driver coordination, and trip execution readiness.

Typical tasks:

- manage drivers and route plans
- create trips
- validate, optimize, dispatch, start, complete, and cancel trips
- view vehicles, maintenance data, dashboard data, analytics, alerts, and compliance results
- assign driver shifts

#### Maintenance Manager

Maintenance Manager controls maintenance operations and can participate in operational monitoring, but does not manage trips end-to-end.

Typical tasks:

- create and manage maintenance alerts
- create maintenance schedules
- view trips, telemetry, vehicles, routes, alerts, dashboard metrics, analytics, and compliance checks
- acknowledge and resolve alerts

#### Driver

Driver is an execution-focused role with the narrowest permissions.

Typical tasks:

- view only assigned trips
- start and complete only own trips
- submit and view telemetry only for own assigned or active trip context
- view driver-visible alerts and notifications related to own work
- manage own profile and password

## RBAC capability matrix

The table below reflects the access rules in the backend code.

| Capability | Admin | Fleet Manager | Dispatcher / Planner | Maintenance Manager | Driver |
| --- | --- | --- | --- | --- | --- |
| Login, logout, view own profile, change own password | Yes | Yes | Yes | Yes | Yes |
| View dashboard analytics and action queue | Yes | Yes | Yes | Yes | No |
| View trip analytics, vehicle analytics, driver analytics | Yes | Yes | Yes | Yes | No |
| View all trips | Yes | Yes | Yes | Yes | No |
| View own assigned trips | Yes | Yes | Yes | Yes | Yes |
| Create trip | Yes | Yes | Yes | No | No |
| Validate trip | Yes | Yes | Yes | No | No |
| Optimize trip | Yes | Yes | Yes | No | No |
| Dispatch trip | Yes | Yes | Yes | No | No |
| Cancel trip | Yes | Yes | Yes | No | No |
| Start trip | Yes | Yes | Yes | No | Yes, own only |
| Complete trip | Yes | Yes | Yes | No | Yes, own only |
| View trip telemetry | Yes | Yes | Yes | Yes | Yes, own only |
| Submit telemetry | Yes | Yes | Yes | No | Yes, own only |
| View vehicles | Yes | Yes | Yes | Yes | No |
| Create, update, delete vehicles | Yes | Yes | No | No | No |
| View drivers | Yes | Yes | Yes | No | No |
| Create, update, delete drivers | Yes | Yes | Yes | No | No |
| Assign driver shift | Yes | Yes | Yes | No | No |
| View routes | Yes | Yes | Yes | Yes | No |
| Create, update, delete routes | Yes | Yes | Yes | No | No |
| Optimize routes | Yes | Yes | Yes | No | No |
| View maintenance alerts | Yes | Yes | Yes | Yes | No |
| Create, update, delete maintenance alerts | Yes | Yes | No | Yes | No |
| View maintenance schedules | Yes | Yes | Yes | Yes | No |
| Create maintenance schedules | Yes | Yes | No | Yes | No |
| View compliance checks | Yes | Yes | Yes | Yes | No |
| View alerts | Yes | Yes | Yes | Yes | Yes, filtered |
| Create alerts | Yes | Yes | Yes | Yes | No |
| Acknowledge and resolve alerts | Yes | Yes | Yes | Yes | No |
| View notifications | Yes | Yes | Yes | Yes | Yes, filtered |
| Mark notifications as read | Yes | Yes | Yes | Yes | Yes, filtered |
| View audit logs | Yes | Yes | No | No | No |
| View users and change roles | Yes | No | No | No | No |

## Demo data and seeded accounts

By default, seeded demo data is disabled.

- `APP_SEED_ENABLED=false` is the default
- set `APP_SEED_ENABLED=true` only for local bootstrap, demos, or testing

When seeding is enabled, the backend creates sample:

- vehicles
- drivers
- routes
- trips
- alerts
- maintenance data
- telemetry points
- users

### Seeded login credentials by role

These demo accounts are available only when seeding is enabled. They are meant for local development, demos, and onboarding only.

| Role | Display name | User ID | Login email | Password | Assigned region | Typical use |
| --- | --- | --- | --- | --- | --- | --- |
| Fleet Manager | `Shreya Operations` | `USR-1` | `manager@fleetcontrol.dev` | `password123` | `West and South India` | Full operations walkthrough |
| Admin | `Admin Ops` | `USR-2` | `admin@fleetcontrol.dev` | `password123` | `Global` | User administration and full access |
| Dispatcher / Planner | `Dispatch Planner` | `USR-3` | `dispatcher@fleetcontrol.dev` | `password123` | `West Corridor` | Trip and route operations |
| Maintenance Manager | `Maintenance Lead` | `USR-4` | `maintenance@fleetcontrol.dev` | `password123` | `Workshop Bay` | Maintenance flows |
| Driver | `Driver Console` | `DR-201` | `driver@fleetcontrol.dev` | `password123` | `Field` | Driver-only experience |

### Copy-paste credentials

#### Admin

- Email: `admin@fleetcontrol.dev`
- Password: `password123`

#### Fleet Manager

- Email: `manager@fleetcontrol.dev`
- Password: `password123`

#### Dispatcher / Planner

- Email: `dispatcher@fleetcontrol.dev`
- Password: `password123`

#### Maintenance Manager

- Email: `maintenance@fleetcontrol.dev`
- Password: `password123`

#### Driver

- Email: `driver@fleetcontrol.dev`
- Password: `password123`

## Runtime URLs

When running with Docker Compose, the default local URLs are:

| Service | URL | Notes |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | Main UI |
| Backend API root | `http://localhost:8080` | Public API info route |
| Backend health | `http://localhost:8080/api/health` | Simple health check |
| API base URL | `http://localhost:8080/api` | Used by frontend |
| MySQL | `localhost:3306` | Development database |

## Quick start

Docker is the recommended way to run the project locally.

### Prerequisites

- Docker Desktop with Docker Compose support

### 1. Create local environment file

Copy `.env.example` to `.env`.

Example PowerShell command:

```powershell
Copy-Item .env.example .env
```

### 2. Update environment values

At minimum, review:

- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `SPRING_JPA_HIBERNATE_DDL_AUTO`
- `SPRING_JPA_SHOW_SQL`
- `APP_SEED_ENABLED`

Recommended for first-time local usage:

- keep `SPRING_JPA_HIBERNATE_DDL_AUTO=update`
- set `APP_SEED_ENABLED=true` if you want demo users and demo data

### 3. Start the stack

```powershell
docker compose up --build
```

### 4. Open the application

- frontend: `http://localhost:5173`
- backend root: `http://localhost:8080`
- backend health: `http://localhost:8080/api/health`

### 5. Sign in

If seeding is enabled, start with:

- email: `manager@fleetcontrol.dev`
- password: `password123`

## Local development without Docker

Docker is the easiest path, but the project can also be run manually.

### Backend

Requirements:

- Java 17
- Maven
- MySQL

Run from `backend/`:

```powershell
mvn spring-boot:run
```

The backend expects MySQL configuration that matches the datasource settings in `backend/src/main/resources/application.yml` or environment overrides.

### Frontend

Requirements:

- Node.js
- npm

Run from `client-frontend/`:

```powershell
npm install
npm run dev
```

Build for production:

```powershell
npm run build
```

Run tests:

```powershell
npm test
```

Run lint:

```powershell
npm run lint
```

## Docker development workflow

The repository is already set up for an efficient Docker-based workflow.

### What updates without a full image rebuild

- `backend/src/**` changes are mounted into the backend container
- `client-frontend/src/**` changes are mounted into the frontend container
- frontend static files and TypeScript config files are mounted into the frontend container

After backend Java changes, restart only the backend service:

```powershell
docker compose restart backend
```

### When a rebuild is expected

- `backend/pom.xml` changes
- `client-frontend/package.json` changes
- `client-frontend/package-lock.json` changes
- Dockerfile changes

### Useful Docker commands

```powershell
docker compose up --build
docker compose restart backend
docker compose down
docker compose down -v
```

## Environment variables

### Backend and database

| Variable | Default | Purpose |
| --- | --- | --- |
| `MYSQL_DATABASE` | `fleet_db` | MySQL database name |
| `MYSQL_USER` | `fleet_app` | Application DB user |
| `MYSQL_PASSWORD` | `change-me` in `.env.example` | Application DB password |
| `MYSQL_ROOT_PASSWORD` | `change-root-password` in `.env.example` | MySQL root password |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | `update` | JPA schema strategy |
| `SPRING_JPA_SHOW_SQL` | `false` in `.env.example` | SQL log visibility |
| `APP_SEED_ENABLED` | `false` | Enables demo data and demo users |

### Frontend

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_USE_MOCK_API` | not set | Enables explicit frontend mock mode |

### API base URL

The frontend defaults to:

```text
http://localhost:8080/api
```

## First walkthrough for a new user

This sequence is a good way to understand the product quickly.

### Fleet Manager walkthrough

1. Sign in as `manager@fleetcontrol.dev`.
2. Open the dashboard to review KPIs, action queue, and exceptions.
3. Open Vehicles and Drivers to inspect fleet resources.
4. Open Routes to review or create a route plan.
5. Open Trips and create a new trip.
6. Validate the trip.
7. Optimize the trip.
8. Dispatch the trip.
9. Open telemetry and alerts to monitor execution.
10. Review analytics and audit logs.

### Dispatcher / Planner walkthrough

1. Sign in as `dispatcher@fleetcontrol.dev`.
2. Review drivers and assign a shift if needed.
3. Review or optimize routes.
4. Create a trip.
5. Validate and optimize the trip.
6. Dispatch the trip.
7. Track trip telemetry and open alerts.

### Maintenance Manager walkthrough

1. Sign in as `maintenance@fleetcontrol.dev`.
2. Review maintenance alerts.
3. Create or update maintenance alerts and schedules.
4. Check dashboard exceptions and compliance status.
5. Review affected trips, vehicles, routes, and alerts.

### Driver walkthrough

1. Sign in as `driver@fleetcontrol.dev`.
2. Open trips and view only assigned work.
3. Start an assigned trip.
4. Submit or review telemetry for the assigned trip or vehicle.
5. Complete the trip after execution.
6. Review driver-visible alerts and notifications.

### Admin walkthrough

1. Sign in as `admin@fleetcontrol.dev`.
2. Review the full operational workspace.
3. Open admin user management.
4. View users and change roles through the admin API or admin UI flow.

## API overview

This section groups the main backend endpoints by function.

### System and auth

- `GET /`
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/profile/change-password`

### Admin users

- `GET /api/admin/users`
- `PUT /api/admin/users/{id}/roles`

### Trips

- `GET /api/trips`
- `GET /api/trips/{tripId}`
- `POST /api/trips`
- `POST /api/trips/{tripId}/validate`
- `POST /api/trips/{tripId}/optimize`
- `POST /api/trips/{tripId}/dispatch`
- `POST /api/trips/{tripId}/start`
- `POST /api/trips/{tripId}/complete`
- `POST /api/trips/{tripId}/cancel`
- `GET /api/trips/{tripId}/telemetry`

### Telemetry

- `POST /api/telemetry`
- `GET /api/telemetry/{vehicleId}`
- `GET /api/telemetry/trip/{tripId}`

### Vehicles

- `GET /api/vehicles`
- `GET /api/vehicles/{id}`
- `POST /api/vehicles`
- `PUT /api/vehicles/{id}`
- `DELETE /api/vehicles/{id}`

### Drivers

- `GET /api/drivers`
- `POST /api/drivers`
- `POST /api/drivers/assign-shift`
- `PUT /api/drivers/{id}`
- `DELETE /api/drivers/{id}`

### Routes

- `GET /api/routes`
- `POST /api/routes`
- `POST /api/routes/optimize`
- `PUT /api/routes/{id}`
- `DELETE /api/routes/{id}`

### Alerts and notifications

- `GET /api/alerts`
- `GET /api/alerts/{id}`
- `POST /api/alerts`
- `POST /api/alerts/{id}/acknowledge`
- `POST /api/alerts/{id}/resolve`
- `GET /api/notifications`
- `POST /api/notifications/{id}/read`

### Maintenance

- `GET /api/maintenance-alerts`
- `POST /api/maintenance-alerts`
- `PUT /api/maintenance-alerts/{id}`
- `DELETE /api/maintenance-alerts/{id}`
- `GET /api/maintenance/schedules`
- `POST /api/maintenance/schedules`

### Dashboard, compliance, analytics, audit

- `GET /api/dashboard/action-queue`
- `GET /api/dashboard/exceptions`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/trips`
- `GET /api/analytics/vehicles`
- `GET /api/analytics/drivers`
- `GET /api/compliance/checks/{tripId}`
- `GET /api/audit-logs`
- `GET /api/audit-logs/entity/{entityType}/{entityId}`

## Example login request

Use this when testing with Postman, curl, or another API client.

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "manager@fleetcontrol.dev",
  "password": "password123"
}
```

Successful response shape:

```json
{
  "token": "fleet-session-...",
  "profile": {
    "id": "USR-1",
    "name": "Shreya Operations",
    "role": "FLEET_MANAGER",
    "email": "manager@fleetcontrol.dev",
    "assignedRegion": "West and South India"
  }
}
```

## Development quality checks

Frontend checks currently used in the repo:

- `npm run lint`
- `npm test`
- `npm run build`

## Local git safety setup

To prevent pushes that would fail frontend CI, enable the tracked pre-push hook once per clone:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-git-hooks.ps1
```

This hook runs:

- `npm run lint`
- `npm test`
- `npm run build`

## Troubleshooting

### I get `Unauthorized`

That usually means one of these:

- you opened a protected API endpoint without logging in
- your token is missing or expired
- the frontend cleared the stored session after a `401`

Start by checking:

- backend root: `http://localhost:8080`
- backend health: `http://localhost:8080/api/health`
- frontend login page: `http://localhost:5173`

### I cannot log in with the demo accounts

Check whether `APP_SEED_ENABLED=true` is set before starting the backend. If the database was initialized without demo users, restart with seeding enabled. If you need a clean local reset, run:

```powershell
docker compose down -v
docker compose up --build
```

### My backend starts but the UI has no useful data

This usually means demo data was not seeded. Set `APP_SEED_ENABLED=true` in `.env` and restart.

### I changed database credentials and things look inconsistent

Old MySQL volumes can preserve old state. Reset local volumes if needed:

```powershell
docker compose down -v
docker compose up --build
```

### Frontend mock mode

The frontend does not silently fall back to mock mode. Mock mode is only enabled when:

```text
VITE_USE_MOCK_API=true
```

## Notes for maintainers

- Driver access is intentionally stricter at the service layer than at the controller layer.
- Audit visibility is limited to Admin and Fleet Manager.
- Role management is limited to Admin.
- The recommended local path is Docker-based development.
- If backend source changes do not appear immediately in Docker, restart the backend service.
