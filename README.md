# VolunteerHub - Final Project Report

## Team Information
- **Yaming Liu**
    - Student Number: 1006871440
    - Email: yaming.liu@mail.utoronto.ca
- **Dhruvi Patel**
    - Student Number: 1006310939
    - Email: dhruviii.patel@mail.utoronto.ca

## Demo Video
Google Drive Link: 

## Motivation
Coordinating volunteers is a surprisingly hard and time-consuming task for small organizations and community groups. Most teams still rely on a mix of Google Sheets, Excel files, email threads, WhatsApp groups, or paper sign-up sheets. These methods are slow, error-prone, and provide no reliable way of knowing who has actually committed to volunteering. When event details or attendance of volunteers changes at the last minute, updating everyone becomes nearly impossible, and coordinators often spend hours manually trying to get responses.

Although existing commercial solutions exist, most small groups would not want to pay monthly fees, share their member data with third parties, or learn complex platforms. A simple self-hosted and free tool like VolunteerHub, would suffice.

That's why we built VolunteerHub. We kept the scope minimal and focused on a clean REST API instead of building a full user interface. Our goal was to create a backend that is extremely easy to understand, test, deploy, and maintain, while still demonstrating every required cloud concept in depth. A simple, well-documented API can be used immediately with tools like Postman or curl, and an optional frontend can always be added later if desired. This decision allowed us to deliver a fully containerized, orchestrated, monitored, continuously deployed, and automatically backed-up system within the course timeline without sacrificing quality.

VolunteerHub directly solves the real coordination problem we experience every semester in student clubs, and it gave us the perfect way to master Docker, Docker Compose, Docker Swarm, persistent volumes, orchestration, monitoring, CI/CD, and backup strategies, as laid out in the learning objectives of ECE1779.

## Objectives

The primary objective of this project was to design, implement, and deploy a fully functional, stateful, cloud-native application that satisfies all technical requirements of ECE1779 while remaining simple, reliable, and useful in real life.
Through this implementation, we specifically aimed to:

- Build a centralized volunteer coordination platform (VolunteerHub) that allows coordinators to create, edit, and delete events, assign volunteers, and see who has accepted, marked tentative, or declined, and that allows volunteers to view their assigned events and update their participation status.
- Demonstrate mastery of every core cloud computing concept taught in the course:
    - Containerization of the Node.js + Express backend and PostgreSQL using Docker
    - Multi-container local development with Docker Compose
    - Persistent storage using a DigitalOcean Volume so data survives container restarts, redeployments, and Droplet reboots
    - Production orchestration using Docker Swarm with two API replicas, built-in load balancing, rolling updates, and automatic restart policies
    - Health endpoints (/health/alive and /health/db) and monitoring via DigitalOcean built-in graphs and email alerts and also local cAdvisor
- Implement two complete advanced features:
    - Establishing fully automated nightly PostgreSQL backups to DigitalOcean Spaces with a tested single command restore capability
    - Achieving secure, automated, zero-downtime continuous deployment via a GitHub Actions CI/CD pipeline that builds, pushes the image, and triggers a rolling update on the Swarm cluster

- Keep the system lightweight by providing a well-documented REST API instead of a frontend, making it instantly usable with Postman/curl and ensuring easy stack deployment.

## Technical Stack

The backend of VolunteerHub is written in Node.js 22 with Express and runs inside a single Docker container built from a lightweight Dockerfile based on node:22. PostgreSQL 16 serves as the relational database, using the official postgres:16 image. Authentication is handled through JWT tokens signed with a secret key, while passwords are hashed with bcrypt. For easier testing during development, we added custom middleware that allows impersonation of either a coordinator or a volunteer simply by sending an X-Dev-User header. Role-based access control (RBAC) is enforced at the route level so that only coordinators can create, edit, delete events or assign volunteers, while volunteers can only update their own assignment status.

Local development and testing are performed with Docker Compose, defined in compose.yaml, which starts both the API and PostgreSQL containers together with a named volume for data persistence. In production we chose Docker Swarm as our orchestration platform (instead of Kubernetes) because it provides all required features, including replication, load balancing, rolling updates, placement constraints, and restart policies, all while remaining extremely simple to manage on a single Droplet. The Swarm stack is declared in docker-stack.yml and runs two replicas of the API service for redundancy and load distribution, while the PostgreSQL service is pinned to the manager node where the DigitalOcean Block Storage Volume is mounted. This volume guarantees that all user, event, and assignment data persists across container restarts, Swarm redeployments, or Droplet reboots.

Health checking is provided by two endpoints (/health/alive and /health/db), and monitoring is achieved through DigitalOcean's built-in droplet metrics with email alerts configured for CPU above 80% and disk usage above 90%. Locally we also run cAdvisor for detailed container-level statistics.

Continuous deployment is fully automated with GitHub Actions that build and push the API image to Docker Hub (authenticated via repository secrets) and then SSH into the Droplet to execute a zero-downtime docker stack deploy. Database backups run automatically every night using a cron job that executes pg_dump in compressed custom format, uploads the dump to a dedicated DigitalOcean Spaces bucket in the tor1 region using the AWS CLI, and logs everything to a file. Recovery is possible in one command due to the restore_latest.sh script that downloads the newest backup and fully restores the database.

All secrets and configuration (database credentials, JWT secret, etc.) are supplied through environment variables, kept in a .env file on the Droplet for the Swarm stack and backup scripts, and in GitHub repository secrets for the CI/CD pipeline.

The entire application therefore runs on DigitalOcean using one Droplet, one Block Storage Volume, and one Space.

## Features

VolunteerHub offers a many core features for volunteer coordination, all delivered through a REST API. Users begin by registering with an email, password, name, and role, where the system validates input for security and uniqueness, hashes the password using bcrypt, and stores the new user in the PostgreSQL database. This registration process directly supports our first objective by enabling the two main roles (coordinator and volunteer) that form the foundation of the app. Login follows a similar secure path, comparing the hashed password and issuing a JWT token upon success, which includes the user's ID and role for subsequent authentication. This JWT mechanism, combined with the extractBearer function to parse Authorization headers, fulfills the implementation of secure backend services and integration with PostgreSQL for persistent user data storage.

For easier development and testing, we implemented a changeable dev-time impersonation middleware that attaches a predefined user (admin for coordinator or vol for volunteer) to the request when the X-Dev-User header is provided and ALLOW_IMPERSONATION is enabled. This feature streamlines demonstrations and ensures that the system is kept lightweight, as it allows quick role switching without repeated database interactions during local runs with Docker Compose. Role-based access control is enforced on every protected route using the requireRole middleware, which checks the user's role from either the JWT or impersonation and returns 401 or 403 errors if unauthorized. 

Coordinators can create events by sending a POST to /events with required fields like title, description, date, times, location, and creator ID, which the system validates and inserts into the events table in PostgreSQL. They can list all events with GET /events (sorted by date and time), retrieve a specific event by ID, update fields via PATCH /events/:id (restricted to the creator), or delete via DELETE /events/:id (also creator-only). These CRUD operations directly fulfill our first objective by enabling coordinators to manage events effectively and tie into the course's state management requirement through persistent storage in PostgreSQL with a DigitalOcean Volume, ensuring data like event details survives container restarts or Swarm redeployments. The use of Docker for containerizing the Node.js backend and Docker Compose for local multi-container setup (API + database) makes these features easy to develop and test.

Assignment management allows coordinators to add volunteers to events with POST /events/:eventId/assign (checking for duplicates) and remove them with DELETE /assignments/:id, both restricted by RBAC. Volunteers update their status (accepted, tentative, declined) via PATCH /assignments/:id/status, which modifies the volunteer_assignments table and is limited to their own user ID. Again, this fulfills the requirement of having a relational database like PostgreSQL, where the schema (users, events, volunteer_assignments tables with UUID keys, foreign references, and an enum for status) ensures data integrity and persistence. Orchestration with Docker Swarm, running two API replicas for load balancing and high availability, supports these features in production.

Health and monitoring are built-in features: /health/alive confirms the process is running, and /health/db verifies database connectivity with a simple query. These endpoints fulfill course requirements for observability and integrate with DigitalOcean's metrics, where we configured alerts for high CPU and disk usage. Local cAdvisor (via monitoring.compose.yaml) provides container-level insights, demonstrating full monitoring compliance.

Our two advanced features extend the core system as required. Our first advanced feature is automated backup and recovery. This system includes an automated backup and recovery mechanism for the PostgreSQL database. A cron‑scheduled backup.sh script runs nightly on the DigitalOcean Droplet, using pg_dump in custom format to generate timestamped backups of the Swarm‑managed database and upload them to a dedicated DigitalOcean Spaces bucket via the S3‑compatible AWS CLI. A complementary restore_latest.sh script has been validated to support one‑command disaster recovery: it retrieves the most recent backup from Spaces, drops and recreates the target database, and uses pg_restore to fully reconstruct the schema and data. This feature directly fulfills backup/recovery requirements, protects persistent data off-site, and demonstrates readiness for data loss cases. Our second advanced feature is CI/CD Pipeline with GitHub Actions. A secure CI/CD pipeline is implemented using GitHub Actions to automate build and deployment of the VolunteerHub API. On every push to the main branch, the workflow builds the Docker image, authenticates to Docker Hub using encrypted repository secrets (for example DOCKERHUB_USERNAME and DOCKERHUB_TOKEN), and pushes an updated image tag. The pipeline then performs a remote deployment step by establishing an SSH connection to the DigitalOcean Droplet using a private key stored in GitHub Secrets and executing docker stack deploy to apply a rolling update to the Swarm stack, ensuring zero‑downtime releases of the backend service.

By focusing on an API-only design without a frontend, we make VolunteerHub instantly usable with tools like Postman while keeping it lightweight for small groups to deploy on a single Droplet.

## User Guide


## Development Guide

This section explains how to set up the **Development Environment** for VolunteerHub, including
environment variables, database & storage configuration, and how to run and test the app locally.

> All steps assume a Windows machine with Docker Desktop installed. Commands are written for a
> standard terminal (PowerShell / Git Bash).

---

### 1. Prerequisites

Make sure you have the following installed:

- **Git** – to clone the repository  
- **Docker Desktop** – includes Docker Engine + Docker Compose  
- (Optional) **Node.js 20+** – only needed if you ever want to run `node app.js` directly

Check:

```bash
git --version
docker --version
docker compose version
```

---

### 2. Clone the Repository

```bash
# Choose any folder, e.g. C:\Users\<you>\Projects
git clone https://github.com/pdhruvii/VolunteerHub.git
cd VolunteerHub
```

At this point you should see files like:

- `app.js`
- `Dockerfile`
- `compose.yaml`
- `docker-stack.yml`
- `init.sql`
- `auth/devAuth.js`
- `auth/jwtAuth.js`
- (optionally) `ops/backup.sh`, `ops/restore_latest.sh` for production backups

---

### 3. Configure Environment Variables (local `.env`)

Create a file named `.env` in the **project root** (`VolunteerHub/.env`):

```env
# App
PORT=3000
API_KEY=local-api-key

# Database connection (from API's point of view)
DB_HOST=db
DB_PORT=5432
DB_USER=voluser
DB_PASSWORD=volpass
DB_NAME=volunteerhub

# JWT configuration
JWT_SECRET=some-long-random-secret
JWT_EXPIRES=1h

# Dev-only settings
ALLOW_IMPERSONATION=true
ENABLE_ROUTE_RBAC=true
```

Notes:

- `DB_USER`, `DB_PASSWORD`, `DB_NAME` must match what `compose.yaml` passes into the Postgres
  container (it uses them as `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
- `JWT_SECRET` should be a random string; for local dev any long string is fine.
- `ALLOW_IMPERSONATION=true` and `ENABLE_ROUTE_RBAC=true` make dev/testing easier:
  - you can impersonate fixed dev users with `X-Dev-User: admin` / `vol`
  - route-level role checks are enabled

---

### 4. Database & Storage in Development

The development database is a **PostgreSQL container** started by Docker Compose.

Key points:

- Image: `postgres:16`
- Port: `5432` (exposed to your host machine)
- Initialization script: `init.sql` is automatically run the first time the DB volume is created
- Persistent storage: Docker volume `db-data`

From `compose.yaml`:

```yaml
services:
  db:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

- The `db-data` volume lives inside Docker Desktop. Even if you stop the container, the data stays.
- `init.sql`:
  - Enables the `uuid-ossp` extension.
  - Creates `users`, `events`, and `volunteer_assignments` tables.
  - Defines the `assignment_status` enum.

You **do not** need to manually create tables; they are created automatically on first run.

---

### 5. Start the Stack Locally (API + DB)

From the project root:

```bash
docker compose up -d
```

What this does:

- Builds the API image from `Dockerfile`
- Starts two containers:
  - `api` – Node.js Express server
  - `db` – PostgreSQL database
- Runs the DB healthcheck (`pg_isready`) before starting the API

Check containers:

```bash
docker compose ps
```

You should see both `api` and `db` as **running**.

---

### 6. Verify the API Is Running

Open a browser or use curl/Postman:

- Process health:

  ```text
  GET http://localhost:3000/health/alive
  ```

  Expected: HTTP `200 OK`.

- Database health:

  ```text
  GET http://localhost:3000/health/db
  ```

  Expected: HTTP `200 OK` if the database is reachable; `500` if not.

If these two checks pass, your local environment is up.

---

### 7. Local Testing – Typical Flows

You can use **Postman**, **Insomnia**, or just **curl**.

#### 7.1. Register Users

Endpoint:

```http
POST http://localhost:3000/register
Content-Type: application/json
```

Coordinator example:

```json
{
  "email": "coord@example.com",
  "password": "secret123",
  "name": "Alice Coordinator",
  "role": "coordinator"
}
```

Volunteer example:

```json
{
  "email": "vol@example.com",
  "password": "secret123",
  "name": "Bob Volunteer",
  "role": "volunteer"
}
```

Response will include a new user `id`.

#### 7.2. Login to Get JWT

```http
POST http://localhost:3000/login
Content-Type: application/json
```

Body:

```json
{
  "email": "coord@example.com",
  "password": "secret123"
}
```

Copy the `token` from the response; you’ll use it in the `Authorization` header:

```http
Authorization: Bearer <JWT_TOKEN_HERE>
```

#### 7.3. Create an Event (Coordinator)

```http
POST http://localhost:3000/events
Authorization: Bearer <COORDINATOR_JWT>
Content-Type: application/json
```

Body:

```json
{
  "title": "Food Drive",
  "description": "Collect and distribute food",
  "event_date": "2025-01-20",
  "start_time": "10:00",
  "end_time": "14:00",
  "location": "Community Center"
}
```

#### 7.4. Assign Volunteer to Event (Coordinator)

```http
POST http://localhost:3000/events/<EVENT_ID>/assign
Authorization: Bearer <COORDINATOR_JWT>
Content-Type: application/json
```

Body:

```json
{
  "userId": "<VOLUNTEER_USER_ID>"
}
```

Response includes an assignment `id`.

#### 7.5. Volunteer Updates Status

```http
PATCH http://localhost:3000/assignments/<ASSIGNMENT_ID>/status
Authorization: Bearer <VOLUNTEER_JWT>
Content-Type: application/json
```

Body:

```json
{
  "status": "accepted"
}
```

You can also test `"tentative"` and `"declined"`.

---

### 8. Optional: Dev-time Impersonation

For quick testing (when `ALLOW_IMPERSONATION=true`):

- The middleware `devAuthenticate` lets you impersonate two fixed users:

  - `X-Dev-User: admin` → coordinator
  - `X-Dev-User: vol` → volunteer

Usage pattern:

```http
Authorization: Bearer local-api-key
X-Dev-User: admin
```

This bypasses login for development, but **only makes sense if those UUIDs exist in the DB** or if you are just testing routes that don’t hit the database for `created_by` checks. For realistic behaviour, it’s still recommended to use `/register` + `/login`.

---

### 9. Stopping and Cleaning Up

To stop the local stack:

```bash
docker compose down
```

To stop and remove the database volume (warning: deletes all local data):

```bash
docker compose down -v
```

---

### 10. Notes on Production vs Development Storage

- **Development:**
  - Uses the `db-data` Docker volume managed by Docker Desktop.
  - No DigitalOcean resources are required.

- **Production (on DigitalOcean Swarm):**
  - The database container mounts a **DigitalOcean Volume** at `/var/lib/postgresql/data`.
  - Automated backups use `pg_dump` + DigitalOcean **Spaces** via the scripts in `ops/backup.sh`
    and `ops/restore_latest.sh` (run on the server, not in local dev).

For the development guide, you only need Docker Desktop + the local `db-data` volume.

## Deployment Information

- http://138.197.165.117:3000/
- http://138.197.165.117:3000/health/alive
- http://138.197.165.117:3000/health/db

## Individual Contributions

Dhruvi Patel and Yaming Liu worked as an extremely collaborative team from the beginning until submission. We screen-shared, shared files, and pair-programmed very frequently. We designed everything together, and constantly reviewed each other's work. The Git history shows large final commits because we only pushed once the files and entire system were fully tested and polished together.

Dhruvi Patel took primary ownership of the application core and security foundations while always collaborating closely with Yaming. She designed and implemented the complete PostgreSQL schema with all tables, UUID keys, relationships, cascades, and the assignment status. She wrote the registration and login endpoints with bcrypt hashing and validation, the full event CRUD operations (create, list, retrieve, update, delete) with creator-only rules, the volunteer assignment creation and removal endpoints, and the volunteer status update endpoint. She implemented the JWT authentication middleware (signing, verification, and Bearer token extraction), the dev-time impersonation system using the X-Dev-User header, and the role-based requireRole checks. She configured Docker Compose for local development, provisioned the DigitalOcean Droplet, attached and mounted the Block Storage Volume with proper formatting, configured DigitalOcean monitoring and email alerts for CPU and disk thresholds.

Yaming Liu took primary ownership of the production orchestration and operational components while always collaborating closely with Dhruvi. He wrote the production Dockerfile and the complete docker-stack.yml with two API replicas, placement constraints pinning the database to the manager node, rolling-update settings, and restart policies. He implemented the health-check endpoints /health/alive and /health/db together with the flexible access-gate middleware supporting both JWT and API_KEY authentication. He designed and built the secure GitHub Actions CI/CD pipeline (Docker build, Docker Hub push using repository secrets, SSH deployment with stored private key, and zero-downtime docker stack deploy), created the full automated backup and recovery system (backup.sh, restore_latest.sh, nightly cron job, DigitalOcean Spaces bucket, and AWS CLI configuration), initialized Docker Swarm on the Droplet, performed all production deployments and rolling updates and persistence verification, and added the cAdvisor monitoring configuration.

Every feature was jointly tested and approved together, before the final commits. This close collaboration delivered a polished, production-ready VolunteerHub that runs reliably in the cloud and meets every course requirement.

## Lessons Learned and Concluding Remarks

This project turned out to be a valuable learning experience for us. Building and running a real stateful application in production taught us a lot.

A key lesson was how simple Docker Swarm is once you understand placement constraints and overlay networks. Getting the database to stay on the manager node with the attached volume took only one line in docker-stack.yml, yet it completely solved data persistence across redeployments. We now see why Swarm is ideal for smaller production workloads instead of jumping straight to Kubernetes, especially for projects like VolunteerHub.

We also learned that real operational reliability comes from repetitive automation. Writing the tedious backup.sh and restore_latest.sh scripts helped us restore everything in under a minute with one command, improving efficiency significantly. The same goes for the GitHub Actions pipeline as well, since we are able to update production automatically with zero downtime with every push.

Working without a frontend forced us to make the API extremely clean and well-documented, which was a good decision. Testing with Postman, Thunder Client, and curl is faster than any UI, and we now believe that building a solid, versioned REST API first is the right way to develop almost any full-stack project. We were also reminded that secrets management matters even for a course project, as taught in class. Using GitHub repository secrets for Docker Hub credentials and the Droplet SSH key, and never committing anything sensitive, made the CI/CD pipeline feel truly production-grade.

Finally, pair-programming turned a time-consuming final project into something enjoyable and something we are both proud of. It proved that with the technologies taught in ECE1779 (Docker, Compose, Swarm, PostgreSQL, persistent volumes, monitoring, CI/CD, and automated backups) it is entirely possible to build and operate a reliable, self-hosted production service on a single droplet. Thank you for the challenge!

