<div align="center">

# Night Owl Pharmacy

### Pharmacy Inventory, Sales & Reservation System

A full-stack web application for a neighbourhood pharmacy: a public storefront where
customers check availability and reserve medicines, plus a staff back office for
inventory, sale recording, expiry/reorder alerts and the reservation queue.

[![NestJS](https://img.shields.io/badge/NestJS-12-E0234F?style=flat-square&logo=nestjs)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Jest](https://img.shields.io/badge/Jest-30-C21325?style=flat-square&logo=jest)](https://jestjs.io)
[![License: UNLICENSED](https://img.shields.io/badge/License-UNLICENSED-lightgrey?style=flat-square)](#license)

</div>

---

## Table of Contents

- [Team](#team)
- [Demo Login](#demo-login)
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database & Migrations](#database--migrations)
- [Demo Data & Credentials](#demo-data--credentials)
- [API Reference](#api-reference)
- [Business Rules](#business-rules)
- [Frontend](#frontend)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## Team

| Developer | Role | GitHub |
| --------- | ---- | ------ |
| **Ishimwe Jean Claude** | Backend — inventory, sales, alerts, dashboard | [@ishl250](https://github.com/ishl250) |
| **Duclo** | Backend — auth, reservations API · Frontend — storefront & staff UI | [@N-duclo](https://github.com/N-DUCLOS) |

Repository: **[N-DUCLOS/Night_owl-GRP-project](https://github.com/N-DUCLOS/Night_owl-GRP-project)**

---

## Demo Login

The seeded development account. Sign in at **`http://localhost:5173/login`**, or
`POST /api/auth/login`.

```text
Email:     staff@nightowlpharmacy.example
Password:  NightOwl!2026
Role:      pharmacist
```

> **Development credentials only.** Created by `002_dev_seed.sql`, which must never
> be applied to a shared or production database. Change the password (and rotate
> `JWT_SECRET`) before this goes anywhere real.

Mock customer used throughout the demo data:

```text
Name:      Ish
Phone:     0787377750
```

Full details in [Demo Data & Credentials](#demo-data--credentials).

---

## Overview

Night Owl Pharmacy began as six independent feature tasks developed in parallel by two
contributors, then merged into a single NestJS + React application. It solves three
problems that a small pharmacy actually has:

1. **Customers cannot tell what is in stock.** The public catalogue answers that
   without exposing cost, batch numbers or supplier data.
2. **Stock drifts out of sync with reality.** Every movement — a sale, a delivery, a
   correction, a write-off, an accepted reservation — goes through a single audited
   path. `quantity_in_stock` is never edited directly.
3. **Expiry and reorder problems surface too late.** A scheduled scan raises one alert
   per threshold crossed (30 / 14 / 7 / 1 day) plus a low-stock alert, and closes
   alerts automatically once the underlying problem is fixed.

The API is a NestJS REST service on PostgreSQL. The frontend is a React SPA served by
Vite, which talks to `/api` through a dev proxy so the browser stays same-origin.

---

## Features

### Public storefront (no sign-in)

- **Catalogue** — paginated medicine list with debounced search, availability filter
  and price/name sorting.
- **Medicine detail** — live availability, price, batch number and expiration date of
  the stock that will still be usable at collection time.
- **Reservations** — request a quantity with name, phone and optional email/note;
  receive a reference such as `RES-MD9K2P` and look it up later.
- **Contact** — pharmacy name, address, phone, email and opening hours, all read from
  environment variables so they can be changed without a deploy.

### Staff back office (JWT required)

- **Authentication** — email + password sign-in, scrypt-hashed passwords, JWT access
  tokens, and a dummy-hash comparison on unknown accounts so sign-in cannot be used to
  enumerate staff.
- **Inventory** — full staff CRUD over batches: search, stock-status and expiry-window
  filters, whitelisted sorting, pagination, signed stock adjustments with a reason,
  and soft-retire instead of delete so historical receipts keep resolving.
- **Sales** — record a multi-line sale in one transaction. Duplicate lines are
  merged, medicine rows are locked `FOR UPDATE`, stock is decremented atomically, and
  totals are computed in integer cents. Receipts are searchable by reference or by
  medicine name, filterable by date range.
- **Alerts** — expiration and low-stock alerts with critical/warning/info severity,
  acknowledge and resolve actions, filter by status and kind, a summary for badges,
  and a manual re-scan that is idempotent.
- **Dashboard** — today / 7-day / month-to-date revenue, order counts, all-time
  totals, stock value, expiring-soon and low-stock tables, and a zero-filled daily
  revenue trend.
- **Reservation queue** — badge counts per status, grouped open/closed views, and a
  status workflow where accepting or collecting **holds** stock under a pessimistic
  lock, and reversing that decision releases it.

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
| ---------- | ------- | ------- |
| [NestJS](https://nestjs.com) | 12 | Application framework, DI, module system |
| [TypeScript](https://www.typescriptlang.org) | 6 | Type safety, native ESM (`nodenext`) |
| [TypeORM](https://typeorm.io) | – | Repository/QueryBuilder access, migrations via `psql` |
| [PostgreSQL](https://www.postgresql.org) | 14+ | Primary datastore |
| [class-validator](https://github.com/typestack/class-validator) | 0.15 | DTO validation |
| [class-transformer](https://github.com/typestack/class-transformer) | 0.5 | Query/body coercion |
| [Passenger/JWT](https://github.com/nestjs/jwt) | 12 | Access tokens for staff routes |
| [NestJS Observe](https://observe.nestjs.com) | 0.1 | Tracing, metrics, error telemetry |
| [Jest](https://jestjs.io) + [ts-jest](https://kulshekhar.github.io/ts-jest/) | 30 | Unit and e2e tests |
| [oxlint](https://oxc.rs/docs/guide/usage/linter.html) | 1.58 | Linting |
| [Prettier](https://prettier.io) | 3 | Formatting |

### Frontend

| Technology | Version | Purpose |
| ---------- | ------- | ------- |
| [React](https://react.dev) | 18.3 | UI, function components + hooks |
| [Vite](https://vite.dev) | 6 | Dev server, build tooling, `/api` proxy |
| [Tailwind CSS](https://tailwindcss.com) | 3.4 | Utility-first styling, brand palette |
| [React Router](https://reactrouter.com) | 6.28 | Client-side routing |
| [framer-motion](https://www.framer.com/motion/) | 11 | Entry/transition animations |
| [lucide-react](https://lucide.dev) | 0.469 | Icon set |

---

## Architecture

```
┌────────────────────────┐        ┌─────────────────────────────────────────┐
│  Browser (React SPA)   │  HTTP  │  NestJS API  (global prefix: /api)       │
│                        │───────▶│                                         │
│  Storefront ─ public   │        │  ┌────────┐  ┌────────┐  ┌──────────┐  │
│  Staff UI  ─ guarded   │◀───────│  │Catalog │  │Reserv. │  │  Auth    │  │
└────────────────────────┘  JWT   │  └────────┘  └────────┘  └──────────┘  │
                                      │  ┌────────┐  ┌────────┐  ┌────────┐ │
                                      │  │Inventory│ │ Sales  │  │ Alerts  │ │
                                      │  └────────┘  └────────┘  └────────┘ │
                                      │  ┌──────────────────────────────┐   │
                                      │  │ Dashboard (read-only reports)│   │
                                      │  └──────────────────────────────┘   │
                                      └──────────────────┬──────────────────┘
                                                         │ TypeORM (synchronize: false)
                                                 ┌───────▼────────┐
                                                 │   PostgreSQL   │
                                                 │ schema owned by│
                                                 │ src/migrations │
                                                 └────────────────┘
```

**Design decisions worth knowing**

- **Schema is owned by SQL, not TypeORM.** `synchronize` is permanently `false`;
  every change is an idempotent `.sql` file in `src/migrations/` applied in filename
  order. This keeps schema history reviewable and repeatable.
- **One JWT registration.** `AuthModule` is `@Global` and registers the `JwtModule`
  secret once, so `JwtAuthGuard` works in any module without repeating the wiring.
- **Aggregation lives in SQL.** Dashboard and list endpoints use QueryBuilder
  projections instead of pulling rows into memory, so cost stays flat as sales grow.
- **A global exception filter** normalises every error into one JSON envelope and
  never leaks stack traces or database messages to the client.

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
| ----------- | ------- | ----- |
| Node.js | 20 LTS or newer | The project is native ESM |
| npm | 10+ | Ships with Node |
| PostgreSQL | 14+ | Local install, Docker, or a hosted database such as Neon |
| `psql` client | any | Must be on `PATH` for migrations |
| PowerShell | 5.1+ | The migration runner is a `.ps1` script |

### 1. Clone and install

```bash
git clone https://github.com/N-DUCLOS/Night_owl-GRP-project.git
cd Night_owl-GRP-project

# backend
npm install

# frontend
cd frontend
npm install
cd ..
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Fill in at minimum `DB_*`, `JWT_SECRET`, and the `PHARMACY_*` values you want shown to
customers. See [Environment Variables](#environment-variables) for the full reference.

### 3. Create the database and apply migrations

```bash
createdb pharmacy     # or use an existing database
npm run migrate
```

The runner applies `src/migrations/*.sql` in filename order through `psql`, aborting on
the first error. Every file is idempotent, so re-running it is the expected way to pull
schema changes onto an existing database.

### 4. Load demo data (optional)

Migration `002_dev_seed.sql` ships with it: it creates a staff account, 12 active
medicine batches covering every catalogue state, 2 retired batches, two weeks of
trading history and mock reservation requests. To apply it on a database that is
already migrated, re-run:

```bash
npm run migrate
```

### 5. Run the API

```bash
npm run start:dev        # watch mode on http://localhost:3000/api
npm run build && npm run start:prod   # compiled build
```

### 6. Run the frontend

```bash
cd frontend
npm run dev              # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:3000`, so the browser only
ever talks to one origin and CORS never interferes in development.

---

## Environment Variables

### Backend (`.env` in the repository root)

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `DB_HOST` | yes | `localhost` | PostgreSQL host |
| `DB_PORT` | no | `5432` | PostgreSQL port |
| `DB_NAME` | yes | `pharmacy` | Database name |
| `DB_USER` | yes | `pharmacy` | Database user |
| `DB_PASSWORD` | yes | empty | Database password |
| `DB_SSL` | no | `false` | Set `true` for managed providers (Neon, Supabase, RDS) |
| `DB_LOGGING` | no | `false` | Logs every SQL statement — handy while debugging |
| `JWT_SECRET` | yes | – | HMAC secret used to sign staff tokens |
| `JWT_EXPIRES_IN` | no | `1d` | Access-token lifetime (`ms`, `s`, `m`, `h`, `d`) |
| `PORT` | no | `3000` | HTTP port for the API |
| `CORS_ORIGIN` | no | all origins | Comma-separated list of allowed origins |
| `ALERT_SCAN_INTERVAL_MINUTES` | no | `60` | How often the background alert scan runs |
| `PHARMACY_NAME` | no | `Night Owl Pharmacy` | Shown in the header and contact page |
| `PHARMACY_ADDRESS` | no | – | Store address |
| `PHARMACY_PHONE` | no | – | Store phone number |
| `PHARMACY_EMAIL` | no | – | Store email address |
| `PHARMACY_HOURS` | no | – | Opening hours, free text |
| `DATABASE_URL` | for `npm run migrate` | – | Full connection string used by `scripts/migrate.ps1` |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `VITE_API_URL` | no | `/api` | API base URL. Leave blank to use the dev proxy |
| `VITE_BACKEND_URL` | no | `http://localhost:3000` | Proxy target for `npm run dev` only |

---

## Database & Migrations

Migrations live in `src/migrations/` and are applied by `scripts/migrate.ps1`, which
loads `.env` into the process environment (existing variables win), requires
`DATABASE_URL` and `psql`, and runs each file with `-v ON_ERROR_STOP=1`.

| File | Contents |
| ---- | -------- |
| `001_core_schema.sql` | `medicines`, `staff_users`, `sales`, `sale_items`, `stock_alerts`, indexes, constraints, and upgrade paths for pre-existing databases |
| `002_dev_seed.sql` | Staff account, 14 medicine batches, two weeks of sales history (idempotent — wipes `DEV-*`/`LEGACY-%` receipts first so revenue never inflates on re-run) |
| `003_reservation_requests.sql` | `reservation_requests` with a `status` CHECK constraint, `decided_by`/`decided_at`, indexes |
| `004_dev_mock_data.sql` | Mock reservation requests across every workflow state, for `Ish` on `0787377750` (restores any held stock before re-inserting, so it is safe to re-run) |

Schema conventions:

- UUID primary keys, `created_at`/`updated_at` on every mutable table.
- Money is `NUMERIC(12,2)`, read through a transformer into JS numbers, and every
  total is computed in whole cents.
- Medicines are **one row per batch**, so expiry, supplier and reorder level are
  batch-level facts. The catalogue collapses them for display.
- Soft deletes: `medicines.is_active`, `staff_users.is_active`, and alert
  `status = 'resolved'` instead of row removal.

---

## Demo Data & Credentials

`002_dev_seed.sql` and `004_dev_mock_data.sql` are **development-only** fixtures. They
never belong on a shared or production database.

### Staff sign-in

Applied automatically by `002_dev_seed.sql`. Sign in at `http://localhost:5173/login`
or `POST /api/auth/login`.

| Field | Value |
| ----- | ----- |
| Email | `staff@nightowlpharmacy.example` |
| Password | `NightOwl!2026` |
| Role | `pharmacist` |
| Token lifetime | `JWT_EXPIRES_IN`, default `1d` |

Override any of it by editing the `staff_users` row directly, or by setting your own
`JWT_SECRET` — the account and the signing secret are independent.

### Mock customers

| Field | Value |
| ----- | ----- |
| Name | `Ish` |
| Phone | `0787377750` |
| Used for | Reservation requests in the staff queue, and `PHARMACY_PHONE` |

### What the demo data exercises

- Every catalogue state: healthy stock, exactly at the reorder level, out of stock,
  expiring in 9 / 21 / 3 days, retired batches, and an already-expired batch.
- Two weeks of receipts, so the dashboard trend chart, weekly revenue and order counts
  all render real numbers.
- Reservations in `pending`, `accepted`, `collected` and `rejected` states, so every
  button in the staff queue has something to act on.
- Alerts generated on first scan by `AlertScheduler` (5 seconds after boot) or by
  `POST /api/alerts/scan`.

---

## API Reference

Base URL: `http://localhost:3000/api` · Content type: `application/json` ·
All staff routes require `Authorization: Bearer <accessToken>`.

### Response envelope

Every endpoint answers with the same shape:

```jsonc
// success
{ "success": true, "message": "Inventory loaded.", "data": { /* ... */ } }

// failure (HTTP 4xx / 5xx)
{
  "success": false,
  "statusCode": 400,
  "message": "Only 4 unit(s) left in stock.",
  "path": "/api/sales"
}
```

Paginated `data` always contains `items` and a `pagination` block:

```jsonc
{
  "items": [ /* ... */ ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### Public routes

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/catalog/medicines` | Paginated catalogue. Query: `search`, `availability` (`all`/`in_stock`/`out_of_stock`), `sort` (`name_asc`, `name_desc`, `price_asc`, `price_desc`), `page`, `limit` (≤48) |
| `GET` | `/catalog/medicines/:id` | Single medicine with `availability`, `unitsAvailable`, batch and expiration |
| `GET` | `/catalog/pharmacy` | Store details from `PHARMACY_*` environment variables |
| `POST` | `/reservations` | Create a reservation request. Body: `medicineId`, `quantity` (1–99), `customerName`, `customerPhone`, `customerEmail?`, `note?` |
| `GET` | `/reservations/:reference` | Look up a reservation by reference (case-insensitive) |

### Authentication

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/auth/login` | Body: `email`, `password` (≥8 chars). Returns `accessToken`, `tokenType`, `expiresIn`, `user` |

### Dashboard

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/dashboard/summary` | Query: `trendDays` (7/14/30/60/90, default 14), `expiryDays` (1–365, default 30) |

### Inventory

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/inventory/medicines` | Query: `search`, `status` (`all`/`in_stock`/`out_of_stock`/`low_stock`), `expiringWithin` (`all`/`expired`/`30`/`14`/`7`/`1`), `sort` (`name_asc`, `name_desc`, `price_asc`, `price_desc`, `stock_asc`, `stock_desc`, `expiry_asc`), `page`, `limit` (≤100) |
| `GET` | `/inventory/medicines/picker` | Unpaginated `id`/`name`/`unitPrice`/`quantityInStock`/`stockStatus` for the sale screen |
| `GET` | `/inventory/medicines/:id` | Single batch |
| `POST` | `/inventory/medicines` | Add a batch. Body: `name`, `quantityInStock`, `unitPrice`, `expirationDate?`, `batchNumber?`, `supplierId?`, `supplierName?`, `minStockLevel`, `isActive?` |
| `PATCH` | `/inventory/medicines/:id` | Partial update of the same fields |
| `DELETE` | `/inventory/medicines/:id` | Soft-retire (returns `alreadyArchived` if it was already retired) |
| `POST` | `/inventory/medicines/:id/stock` | Signed adjustment. Body: `quantityChange` (e.g. `50` or `-3`), `reason?`. Refuses to go negative |

### Sales

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/sales` | Record a sale. Body: `items: [{ medicineId, quantity }]` (1–100 lines, qty 1–10 000), `customerName?`, `customerPhone?`, `customerEmail?` |
| `GET` | `/sales` | Query: `from`, `to`, `search` (matches reference **or** medicine name), `page`, `limit` |
| `GET` | `/sales/:id` | One receipt with its line items |

### Alerts

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/alerts` | Query: `status` (`all`/`open`/`acknowledged`/`resolved`), `kind` (`all`/`expiring`/`low_stock`), `page`, `limit`. Sorted critical → warning → info |
| `GET` | `/alerts/summary` | `{ open, critical, expiring, lowStock, lastRunAt, nextRunInMinutes }` |
| `POST` | `/alerts/scan` | Re-check now. Idempotent, safe to call repeatedly |
| `PATCH` | `/alerts/:id/acknowledge` | Mark as seen |
| `PATCH` | `/alerts/:id/resolve` | Close once the underlying problem is fixed |

### Reservations (staff)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/reservations` | Query: `status` (`all`/`pending`/`accepted`/`rejected`/`collected`) or `view` (`all`/`open`/`closed`), `page`, `limit` |
| `GET` | `/reservations/counts` | `{ counts: { pending, accepted, rejected, collected }, total, needsAttention }` |
| `PATCH` | `/reservations/:id/status` | Body: `status`. Accepting or collecting holds stock; reversing releases it |

### Worked example

```bash
# 1. Sign in
curl -s http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"staff@nightowlpharmacy.example","password":"NightOwl!2026"}'

# 2. Record a sale with the returned token
curl -s http://localhost:3000/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"medicineId":"11111111-1111-4111-8111-111111111101","quantity":2}]}'

# 3. Public reservation (no token)
curl -s http://localhost:3000/api/reservations \
  -H 'Content-Type: application/json' \
  -d '{"medicineId":"11111111-1111-4111-8111-111111111103","quantity":3,
       "customerName":"Ish","customerPhone":"0787377750"}'
```

---

## Business Rules

The rules below are enforced server-side; the frontend only mirrors them.

1. **Stock is never edited directly.** It moves through `POST /sales` or
   `POST /inventory/medicines/:id/stock`. No endpoint accepts a raw new quantity.
2. **Stock cannot go negative.** `adjustStock` rejects it with a `400`; a sale that
   would oversell fails inside the transaction and rolls back.
3. **Sales are atomic and race-safe.** Duplicate lines for the same medicine are
   merged, medicine rows are selected `FOR UPDATE`, totals are computed in cents, line
   items are inserted, stock is decremented, and only then is the transaction
   committed. A unique-violation on the receipt reference is retried by the caller.
4. **One alert per threshold crossed.** A batch 3 days from expiry raises four alerts
   (30-, 14-, 7- and 1-day). Resolving the 7-day one does not hide the 1-day one.
5. **Alerts close themselves.** A scan resolves any alert whose trigger is gone — a
   restocked batch or a replenished reorder level — so the queue cannot fill with
   ghosts.
6. **Expiry severity is fixed:** ≤7 days critical, ≤14 days warning, otherwise info.
   Low stock is warning, or critical when the quantity is zero.
7. **Reservation stock is held on acceptance**, not on request. `pending` leaves stock
   untouched; `accepted` and `collected` hold it under a pessimistic write lock;
   `rejected` or moving back to `pending` releases it.
8. **Medicines are retired, never deleted,** so historical receipts and alerts keep
   resolving. Retired rows disappear from the catalogue and the dashboard immediately.
9. **Sign-in cannot enumerate accounts.** An unknown email still pays the cost of a
   scrypt comparison against a dummy digest, and both failures return one identical
   message.
10. **Public endpoints withhold operational data.** The catalogue never exposes cost,
    supplier or reorder level; the detail page exposes batch and expiry only as "the
    stock that will still be usable when you collect".

---

## Frontend

```
frontend/
├── index.html                 # Entry document, page title and meta description
├── vite.config.js             # React plugin + /api dev proxy to the backend
├── tailwind.config.js         # Brand palette (brand-50 … brand-700) and font stack
└── src/
    ├── main.jsx               # React root, StrictMode
    ├── App.jsx                # BrowserRouter
    ├── routes/index.jsx       # Route table
    ├── components/
    │   ├── common/            # Button, FormField/Input/Select/Textarea, Feedback,
    │   │                      # Modal, Pagination, PageHeader, SearchInput
    │   └── layout/AppShell.jsx# Header, mobile nav, footer, skip link
    ├── pages/
    │   ├── auth/LoginPage.jsx        # Staff sign-in
    │   ├── catalog/                 # CatalogPage, MedicineDetailPage, ContactPage
    │   ├── staff/                   # InventoryPage, SalesPage, AlertsPage,
    │   │                            # ReservationsPage
    │   └── dashboard/DashboardPage.jsx
    ├── services/             # api.js fetch wrapper + one module per API area
    ├── hooks/useAsync.js     # { data, error, isLoading, reload }
    └── utils/format.js       # Money, number and date formatting
```

### Routes

| Path | Page | Access |
| ---- | ---- | ------ |
| `/` | Catalogue | Public |
| `/medicines/:id` | Medicine detail + reservation request | Public |
| `/contact` | Store details | Public |
| `/dashboard` | Financial dashboard | Staff |
| `/inventory` | Medicine batches and stock | Staff |
| `/sales` | Record a sale, browse receipts | Staff |
| `/alerts` | Expiry and low-stock queue | Staff |
| `/reservations` | Reservation queue | Staff |
| `/login` | Staff sign-in | Public |
| `*` | 404 | Public |

### Conventions

- **The API wrapper is the only place that calls `fetch`.** `services/api.js` attaches
  the stored bearer token, unwraps the `data` envelope, converts failures into
  `ApiError`, and clears the token on `401` — so pages only ever handle `error.message`.
- **`useAsync(loader, deps)`** owns loading, error and retry state for every page.
- **Accessibility is part of the definition of done:** labelled form controls with
  `aria-invalid`/`aria-describedby` wiring, table headers with `scope`, status carried
  by an icon *and* text (never colour alone), a skip link, and a focusable dialog that
  closes on `Escape`.
- **Design tokens** come from the Tailwind `brand` ramp; no hard-coded colours outside
  the standard palette.

---

## Testing

```bash
npm test           # unit tests (src/**/*.spec.ts)
npm run test:watch # watch mode
npm run test:cov   # coverage report in ./coverage
npm run test:e2e   # end-to-end tests (requires a reachable database)
```

- **Unit tests** exercise the services with mocked repositories — stock cannot go
  negative, sale totals in cents, alert thresholds and auto-resolution, reservation
  hold/release, catalogue projections, sign-in failure paths, and the `daysUntil` date
  helper.
- **E2E tests** boot the real `AppModule` with supertest and therefore need the
  `DB_*` variables in `.env` pointing at a scratch database.
- The project is native ESM, so every script runs Jest through
  `node --experimental-vm-modules`. Do not replace it with a bare `jest` call.

---

## Code Quality

```bash
npm run lint       # oxlint over src/ and test/
npm run format     # prettier over src/**/*.ts and test/**/*.ts

cd frontend
npm run lint       # oxlint over src/
npm run build      # production bundle in frontend/dist
```

House rules:

- Money is handled in whole cents; never accumulate totals in floating point.
- Every list endpoint is paginated and returns the standard `pagination` block.
- Sort and filter columns are whitelisted server-side, never interpolated raw.
- DTOs are the only accepted input shape; `whitelist` and `forbidNonWhitelisted` are
  on globally, so unknown fields are rejected instead of ignored.
- No secrets in source. `.env` is gitignored; `.env.example` carries placeholders.

---

## Project Structure

```
.
├── src/
│   ├── main.ts                    # Bootstrap: /api prefix, validation, CORS, filter
│   ├── app.module.ts              # Root module, Observe + TypeORM wiring
│   ├── alerts/                    # Expiration + low-stock alerts, scheduler
│   ├── auth/                      # Sign-in, scrypt hashing, JWT
│   ├── catalog/                   # Public read-only catalogue + store details
│   ├── dashboard/                 # Staff reporting
│   ├── inventory/                 # Medicine batches and stock movements
│   ├── migrations/                # Idempotent SQL migrations + dev seed
│   ├── reservations/              # Public requests + staff queue
│   ├── sales/                     # Transactional sale recording
│   └── shared/                    # Guard, decorators, error filter, date helpers
├── frontend/                      # React + Vite + Tailwind SPA
├── scripts/migrate.ps1            # Migration runner
└── test/                          # End-to-end tests
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `ECONNREFUSED` on boot | Database unreachable | Check `DB_HOST`/`DB_PORT`, set `DB_SSL=true` for hosted providers |
| `relation "medicines" does not exist` | Migrations not applied | `npm run migrate` |
| `psql is not recognized` | Postgres client not installed | Install PostgreSQL or add `psql` to `PATH` |
| `DATABASE_URL is not set` when migrating | `.env` missing or incomplete | Copy `.env.example` to `.env` and add `DATABASE_URL` |
| `Incorrect email or password.` | Seed not loaded, or the account was deactivated | Re-run `npm run migrate`; confirm `staff_users.is_active` |
| Dashboard shows zero revenue | Seed not loaded | Re-run `npm run migrate` (`002_dev_seed.sql` rewrites `DEV-*` receipts) |
| Frontend shows "Cannot reach the server" | API not running | Start the backend, or set `VITE_BACKEND_URL` in `frontend/.env` |
| Staff pages redirect to `/login` | Missing or expired token | Sign in again; the token lives under `access_token` in `localStorage` |
| Alerts list is empty | The scan has not run yet | `POST /api/alerts/scan`, or wait ~5 seconds after boot |
| HMR or route changes 404 in dev | Vite fallback not applied | Use the Vite dev server rather than opening the build output |

---

## Roadmap

- [x] Inventory management with batch-level expiry and reorder levels
- [x] Transactional sale recording with receipt history
- [x] Expiration and low-stock alerting with an automatic scan
- [x] Public catalogue with availability and search
- [x] Reservations with a staff queue and stock holds
- [x] JWT staff authentication
- [x] Financial dashboard with trend reporting
- [ ] Refresh tokens and staff account management
- [ ] Role-based access (manager vs. assistant) beyond the `role` column
- [ ] Purchase orders and supplier management
- [ ] Expiry write-off workflow with audit trail
- [ ] Print-friendly receipts
- [ ] CI pipeline for build, lint and tests

---

## License

UNLICENSED — internal group project. All rights reserved.

Built with [NestJS](https://nestjs.com) and [React](https://react.dev).

</div>
