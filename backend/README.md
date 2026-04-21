# Backend Quickstart

This backend is a Spring Boot application for trip execution, telemetry, alerts, notifications, RBAC, and supporting fleet operations workflows.

## Requirements

- Java 17
- MySQL

Maven is optional because the repository includes a Maven wrapper.

## Common Commands

Run from `backend/`.

### Start the API

```powershell
.\mvnw.cmd spring-boot:run
```

### Run the Test Suite

```powershell
.\mvnw.cmd test
```

### Package the Backend

```powershell
.\mvnw.cmd package
```

On macOS or Linux, use:

```bash
./mvnw spring-boot:run
./mvnw test
./mvnw package
```

## Configuration

The datasource and service defaults live in `backend/src/main/resources/application.yml`.

Make sure your local MySQL configuration matches those settings, or provide environment variable overrides before starting the app.

## Current Lifecycle Notes

Trip execution now supports:

- `DISPATCHED`
- `IN_PROGRESS`
- `PAUSED`
- `COMPLETED`

Pause and resume flows are covered by backend tests, and the wrapper-based test command above is the recommended verification path.
