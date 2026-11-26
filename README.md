# Helpdesk Ticket System

A mini helpdesk where users raise support tickets and administrators manage and resolve them. It has a REST API (Node, Express, TypeScript, PostgreSQL) and a React frontend.

## Live demo

| | Link |
|---|---|
| Frontend | https://helpdesk-ticket-system-w8sl.vercel.app |
| API | https://helpdesk-api-6wdc.onrender.com/api (health: `/api/health`) |

> Both are on free hosting. The API sleeps when idle, so the **first request can take 30 to 60 seconds**. Open the health link once to wake it up.

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `ChangeMe123!` |
| User | register any new account on `/register` | |

Registration always creates a `USER`. The admin account is created by a seed script.

## Tech stack

- **Backend:** Node.js, Express 5, TypeScript, `pg` (plain SQL), zod, JWT, bcryptjs, helmet, express-rate-limit
- **Database:** PostgreSQL on Neon
- **Frontend:** React, Vite, TypeScript, Tailwind CSS v4, React Router, Axios, react-hot-toast, react-icons
- **Testing:** Vitest and Supertest (13 tests), plus a Postman collection
- **Deployment:** Render (Docker) for the API, Vercel for the frontend

## Features

- Register and log in with JWT; roles `USER` and `ADMIN` with route-level and service-level access control
- Tickets: create, view own, edit and delete (only while `OPEN`), track status
- Comments by the ticket owner and by admins, linked to ticket and author
- Admin: view all tickets, filter by status and priority, change status and priority, reply to any ticket
- **Event-driven workflow:** `ticket.created`, `ticket.updated`, `ticket.status_changed`, `comment.added`, `ticket.resolved` are written to an activity log shown on each ticket
- Search, sorting, filtering and pagination
- Dashboard with ticket statistics (counts by status and priority, average resolution time)
- Automated API tests, Postman collection, Docker support

## Project structure

```
helpdesk-ticket-system/
  docs/                          Postman collection, test screenshot
  docker-compose.yml
  helpdesk-api/
    src/
      config.ts                  env validation and DB pool
      errors.ts                  AppError and error middleware
      events.ts                  event bus and listeners
      middleware.ts              authenticate and requireRole
      db/                        schema.sql, migrate.ts, seedAdmin.ts
      modules/
        auth/                    routes and service
        tickets/                 routes, ticket service, comment service
      index.ts                   app setup and server start
    tests/api.test.ts
    Dockerfile
  helpdesk-web/
    src/
      api/ context/ components/ pages/ constants.ts types.ts
```

Each backend module separates **routes** (parsing, validation, responses) from **services** (business rules and SQL).

## Local setup

Prerequisites: Node.js 20+ and a PostgreSQL database (a free Neon project works).

### Backend

```bash
cd helpdesk-api
npm install
cp .env.example .env     # then fill in the values
npm run migrate          # creates the tables
npm run seed:admin       # creates the admin user
npm run dev              # http://localhost:4000
```

`helpdesk-api/.env`:

```
PORT=4000
DATABASE_URL=postgresql://user:pass@host/db?sslmode=verify-full
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=1d
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<choose a strong password>
FRONTEND_URL=http://localhost:5173   # optional, restricts CORS
```

Generate a secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Frontend

```bash
cd helpdesk-web
npm install
echo "VITE_API_URL=http://localhost:4000/api" > .env
npm run dev              # http://localhost:5173
```

## Database design

```
users 1 ---- * tickets 1 ---- * comments * ---- 1 users
                  1
                  |
                  * activity_logs * ---- 0..1 users (actor)
```

| Table | Purpose | Notes |
|---|---|---|
| `users` | Accounts | UUID key, unique email, bcrypt `password_hash`, `role` limited to USER or ADMIN by a CHECK constraint |
| `tickets` | Support tickets | Belongs to a user (`ON DELETE CASCADE`). CHECK constraints on status, priority and category. `resolved_at` supports average-resolution-time stats |
| `comments` | Conversation on a ticket | Belongs to a ticket and an author; deleted with the ticket |
| `activity_logs` | Append-only audit trail of events | `actor_id` uses `ON DELETE SET NULL`, so history survives user deletion. `metadata` is JSONB so each event type can store different details |

Indexes: `tickets(user_id)` for "my tickets", `tickets(status, priority)` for admin filters, `comments(ticket_id)` and `activity_logs(ticket_id)` for the detail page.

The full schema is in `helpdesk-api/src/db/schema.sql`.

## Event handling

Services publish an event after the database write succeeds, for example `publish("ticket.created", { ticketId, actorId })`. Listeners in `events.ts` subscribe to every event and insert a row into `activity_logs`. A failing listener is caught and logged, so it can never break the request that triggered it.

| Event | Fired when |
|---|---|
| `ticket.created` | A ticket is submitted |
| `ticket.updated` | The owner edits content or an admin changes priority |
| `ticket.status_changed` | An admin changes the status (stores from and to) |
| `comment.added` | A user or admin comments |
| `ticket.resolved` | Status becomes RESOLVED (fired together with `status_changed`) |

New actions such as email or in-app notifications can be added as extra listeners without touching the services.

## API documentation

Base URL: `/api`. Send `Authorization: Bearer <token>` on protected routes. A ready-to-run Postman collection is in [`docs/helpdesk.postman_collection.json`](docs/helpdesk.postman_collection.json).

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/health` | public | |
| POST | `/auth/register` | public | `{name, email, password}`; role is ignored |
| POST | `/auth/login` | public | returns `{token, user}` |
| GET | `/auth/me` | any user | |
| POST | `/tickets` | user, admin | `{title, description, category?, priority?}` |
| GET | `/tickets` | user: own, admin: all | `?status=&priority=&q=&sort=&order=&page=&limit=` |
| GET | `/tickets/stats` | user: own, admin: all | dashboard statistics |
| GET | `/tickets/:id` | owner or admin | |
| PATCH | `/tickets/:id` | owner, only while OPEN | edit title, description, category, priority |
| DELETE | `/tickets/:id` | owner while OPEN, or admin | |
| PATCH | `/tickets/:id/manage` | admin | `{status?, priority?}` |
| GET, POST | `/tickets/:id/comments` | owner or admin | `{body}` |
| GET | `/tickets/:id/activity` | owner or admin | event history |

Statuses: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`. Priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. Categories: `GENERAL`, `BILLING`, `TECHNICAL`, `ACCOUNT`, `OTHER`.

Errors return `{ "message": "..." }`, and validation errors also include an `errors` array.

## Security decisions

- Passwords are hashed with bcrypt; password hashes are never returned.
- JWTs expire after one day and are verified on every protected route.
- The role is never read from the request body, so new accounts are always `USER`. The admin is seeded.
- Ownership is checked in the service layer, not only in routes.
- Another user's ticket returns **404 instead of 403**, so IDs cannot be probed.
- All SQL is parameterized; sortable columns are whitelisted by zod.
- Input is validated with zod on every route.
- `helmet` headers, a 100 KB body limit, and rate limiting on `/auth` (100 requests per 15 minutes).
- CORS can be locked to the frontend origin through `FRONTEND_URL`.
- Secrets live in environment variables; `.env` is git-ignored.

## Testing

```bash
cd helpdesk-api
npm test
```

13 tests cover registration, role injection, duplicate emails, authentication, validation, access control between users, admin-only routes, status rules, comments, event logging and stats. They run against the configured database with unique emails per run and clean up after themselves.

![Test results](docs/test-results.png)

The Postman collection (51 requests with test scripts) was run against the live API: import it, set `adminPassword` in the collection variables, then use the Collection Runner. A request that tries a `DROP TABLE` title was checked locally; the live host's firewall blocks that payload before it reaches the API.

## Docker

```bash
docker compose up --build    # API on http://localhost:4000
```

The multi-stage `helpdesk-api/Dockerfile` builds the TypeScript and runs the compiled output. The database is external (Neon), so no database container is needed. The same Dockerfile is used for the Render deployment. I have not run `docker compose` on my local machine, but the image builds and runs on Render.

## Design decisions and trade-offs

- **Plain SQL with `pg` instead of an ORM:** fewer moving parts and the schema is explicit and easy to explain.
- **Events through Node's `EventEmitter`:** simple and enough for one server instance. A queue such as BullMQ would be the next step if work had to survive restarts or run across instances.
- **Users can edit and delete only `OPEN` tickets:** once an admin starts work, the content should not change underneath them.
- **Comments are allowed on `RESOLVED` tickets but not `CLOSED` ones**, so a user can reply "thanks" or report that the fix did not work.
- **Admins manage status and priority but do not edit ticket content.**
- **Migrations run from a single `schema.sql`** with `IF NOT EXISTS`, which is enough for this scope.

## Future improvements

- Email and in-app notifications as additional event listeners
- File attachments
- Refresh tokens and password reset
- Ticket assignment to specific admins
- Migration tooling and CI pipeline