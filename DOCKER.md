# Docker Development Workflow

1. Copy `.env.example` to `.env` and set stronger local passwords.
2. Start the stack with `docker compose up --build`.
3. Keep it running while you edit code.

The MySQL service now uses the `mysql_data_v2` volume. This avoids credential drift from older initializations while keeping the old `mysql_data` volume untouched.

What now updates without a full image rebuild:
- `backend/src/**` changes are read directly by the backend container. Restart only the backend service with `docker compose restart backend` when you want Java changes picked up.
- `client-frontend/src/**`, `public/**`, `index.html`, `vite.config.ts`, and TypeScript config changes are mounted into the frontend container, so Vite can reload them without rebuilding the image.
- Database data stays in the `mysql_data` volume and dependency caches stay in named volumes, so container restarts stay lightweight.
- Backend Maven dependencies are cached in the `backend_m2` volume, allowing the backend container to download missing dependencies even with a read-only root filesystem.

When a rebuild is still expected:
- `backend/pom.xml` changes
- `client-frontend/package.json` or `client-frontend/package-lock.json` changes
- Dockerfile changes

Useful commands:
- `docker compose up --build`
- `docker compose restart backend`
- `docker compose down`
- `docker compose down -v`

Backend wrapper commands outside Docker:
- `cd backend`
- `.\mvnw.cmd spring-boot:run`
- `.\mvnw.cmd test`

Notes:
- The backend repo includes a Maven wrapper, so a separate Maven install is optional for local Windows development.
- On macOS or Linux, use `./mvnw spring-boot:run` and `./mvnw test`.
