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

## Recent System Upgrades (Latest)

The following core features and architectural improvements were recently implemented:

- **Real-Time WebSocket Architecture**: Enabled STOMP-based WebSockets across the platform for live telemetry updates (speed, fuel, and location) without manual page refreshes.
- **Reactive State Management**: Integrated `Zustand` as the primary real-time store, allowing immediate UI feedback for vehicle movement and sensor data.
- **Modernized Authentication**: Redesigned the Login interface with a high-fidelity logistics aesthetic, cross-browser security enhancements (preventing duplicate reveal icons), and streamlined access for all six operational roles.
- **Enhanced Telemetry Integration**: Dashboards now feature live vehicle markers and reactive metrics strips that sync directly with the established STOMP stream.
- **Resilient Execution Flow**: Upgraded the `DriverDashboard` and `Trips` management board with robust refresh logic and background polling fallbacks for high-availability tracking.

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

Backend command quickstart:
- See `backend/README.md` for wrapper-based backend commands such as `.\mvnw.cmd spring-boot:run`, `.\mvnw.cmd test`, and `.\mvnw.cmd package`.

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
- `PAUSED`
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

The system currently supports six distinct operational roles:

| Role | Purpose |
| --- | --- |
| `ADMIN` | Full administrative control, user-role management, and audit governance. |
| `OPERATIONS_MANAGER` | Strategic fleet intelligence: KPIs, trends, and operational efficiency analysis. |
| `DISPATCHER` | Live fleet command: monitoring, driver assignment, and real-time alert handling. |
| `PLANNER` | Strategic planning: building routes, sequencing stops, and optimizing for efficiency. |
| `MAINTENANCE_MANAGER` | Maintenance cockpit: service orders, vehicle health, and workshop schedules. |
| `DRIVER` | Field execution: active trip management, route execution, and operational checklists. |

### Role-by-role explanation

#### Admin

Admin can use the full system. This role is the only one allowed to manage user roles through the admin API and access the Admin Dashboard.

Typical tasks:

- view all operational data and system stats
- create, update, and delete vehicles
- create, update, and delete drivers
- create, update, and delete routes
- create and dispatch trips
- view audit logs
- reassign user roles

#### Operations Manager

Operations Manager focuses on strategic fleet intelligence and overall efficiency.

Typical tasks:

- monitor KPI trends for the entire fleet
- analyze delay and fuel efficiency patterns
- review fleet-wide dashboard analytics
- review critical alerts and exceptions

#### Dispatcher

Dispatcher manages live operations, driver assignments, and trip execution.

Typical tasks:

- monitor active trips in real-time
- assign and reassign drivers to trips
- handle live alerts and trip exceptions
- coordinate with drivers during transit

#### Planner

Planner is responsible for strategic route building and trip scheduling.

Typical tasks:

- build and optimize route plans
- sequence stops for maximum efficiency
- create and schedule future trips
- validate route safety and compliance

#### Maintenance Manager

Maintenance Manager controls maintenance operations and vehicle health.

Typical tasks:

- create and manage maintenance alerts
- create maintenance schedules and workshop visits
- view vehicle health stats and maintenance trends
- acknowledge and resolve maintenance-related issues

#### Driver

Driver is an execution-focused role with access to own active assignments.

Typical tasks:

- manage active trip checklists (pickup, documents, delivery)
- view trip timeline and navigation
- monitor trip-specific safety and compliance alerts
- sign off on completed trips

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
| Admin | `Super Admin Console` | `USR-2` | `admin@gmail.com` | `password` | `Global` | User administration and full access |
| Operations Manager | `Operations Manager Console` | `USR-1` | `operations_manager@gmail.com` | `password` | `West and South India` | Strategic fleet intelligence |
| Dispatcher | `Dispatcher Console` | `USR-3` | `dispatcher@gmail.com` | `password` | `West Corridor` | Live fleet control |
| Planner | `Route Planner Console` | `USR-5` | `planner@gmail.com` | `password` | `Regional Hubs` | Strategic route planning |
| Maintenance Manager | `Maintenance Manager Console` | `USR-4` | `maintenance_manager@gmail.com` | `password` | `Workshop Bay` | Maintenance cockpit |
| Driver | `Driver Execution Console` | `DR-201` | `driver@gmail.com` | `password` | `Field Operations` | Driver operational flow |

### Copy-paste credentials

#### Admin
- Email: `admin@gmail.com`
- Password: `password`

#### Operations Manager
- Email: `operations_manager@gmail.com`
- Password: `password`

#### Dispatcher
- Email: `dispatcher@gmail.com`
- Password: `password`

#### Planner
- Email: `planner@gmail.com`
- Password: `password`

#### Maintenance Manager
- Email: `maintenance_manager@gmail.com`
- Password: `password`

#### Driver
- Email: `driver@gmail.com`
- Password: `password`

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

- email: `fleet_manager@gmail.com`
- password: `password`

## Local development without Docker

Docker is the easiest path, but the project can also be run manually.

### Backend

Requirements:

- Java 17
- MySQL

The repository now includes a Maven wrapper, so a separate Maven install is optional.

Run from `backend/`:

```powershell
.\mvnw.cmd spring-boot:run
```

Run the backend test suite from `backend/`:

```powershell
.\mvnw.cmd test
```

On macOS or Linux, use:

```bash
./mvnw spring-boot:run
./mvnw test
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

### Operations Manager walkthrough

1. Sign in as `operations_manager@gmail.com`.
2. Open the dashboard to review high-level KPIs and performance trends.
3. Review analytics reports for long-term fleet utilization.

### Dispatcher walkthrough

1. Sign in as `dispatcher@gmail.com`.
2. Monitor live trips and vehicle locations.
3. Handle incoming alerts and coordinate with field drivers.
4. Perform driver-trip reassignments in real-time.

### Planner walkthrough

1. Sign in as `planner@gmail.com`.
2. Build and optimize new route plans.
3. Sequence stops and schedule upcoming trip cycles.
4. Validate compliance and safety metrics for planned routes.

### Maintenance Manager walkthrough

1. Sign in as `maintenance_manager@gmail.com`.
2. Review service alerts and workshop status.
3. Schedule new maintenance visits and sign off on completed repairs.
4. Monitor vehicle health trends to prevent operational downtime.

### Driver walkthrough

1. Sign in as `driver@gmail.com`.
2. Access the active trip cockpit to view routes and stops.
3. Use operational checklists for pickups and deliveries.
4. Monitor live timeline and navigation context.

### Admin walkthrough

1. Sign in as `admin@gmail.com`.
2. Review systemic operational oversight.
3. Access Admin User Management to manage permissions and roles.
4. Review global audit logs for security oversight.

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
  "email": "fleet_manager@gmail.com",
  "password": "password"
}
```

Successful response shape:

```json
{
  "token": "fleet-session-...",
  "profile": {
    "id": "USR-1",
    "name": "Manager Operations",
    "role": "FLEET_MANAGER",
    "email": "fleet_manager@gmail.com",
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
