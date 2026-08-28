# 🧹 Dire Dawa Cleaning Management System v2

A full-stack web application managing Dire Dawa's cleaning operations with a
**4-tier organizational hierarchy**:

```
🔴 Admin
   │  full system control — manages collectors, leaders, zones, kebeles
   ▼
🔵 Collector
   │  oversees an entire Kebele (12 zones) — reviews & approves zone reports
   ▼
🟣 Zone Leader
   │  manages ONE Safer Zone — workers, tools, attendance, payments, reports
   ▼
👷 Workers
      daily wage, attendance tracked by their Zone Leader
```

---

## 📁 Project Structure

```
dire-dawa-cleaning/
├── backend/                  Node.js + Express API
│   ├── config/               db.js, logger.js
│   ├── middleware/            auth.js (role + zone-access checks), errorHandler.js
│   ├── routes/
│   │   ├── auth.js            login/logout/me (returns leader's zone)
│   │   ├── users.js           user CRUD + /users/leaders
│   │   ├── locations.js       kebeles, safer-zones, businesses
│   │   ├── payments.js        payments + dashboard summary
│   │   ├── inspections.js     inspections + photo upload
│   │   ├── workers.js         workers, attendance, salary
│   │   ├── tools.js           tools/equipment per zone
│   │   ├── zoneReports.js     leader→collector report workflow
│   │   └── reports.js         CSV exports
│   ├── uploads/               inspection photos
│   ├── logs/                  winston daily-rotate logs
│   ├── server.js
│   └── .env  (copy from .env.example)
├── frontend/                  Pure HTML + CSS + Vanilla JS
│   ├── css/main.css
│   ├── js/
│   │   ├── api.js             fetch wrapper, all endpoints
│   │   ├── utils.js            toasts, modals, formatters, leaderBanner()
│   │   ├── main.js              router + role-aware sidebar
│   │   └── pages/
│   │       ├── login.js
│   │       ├── dashboard.js
│   │       ├── businesses.js
│   │       ├── inspections.js
│   │       ├── workers.js
│   │       ├── tools.js          NEW
│   │       ├── payments.js
│   │       ├── zonereports.js    NEW
│   │       ├── reports.js
│   │       ├── users.js
│   │       └── settings.js       zone↔leader, kebele↔collector assignment
│   └── index.html
└── database/
     ├── schema.sql            MariaDB legacy (retained for rollback)
     ├── postgresql/
     │   ├── schema.sql        PostgreSQL 16 + PostGIS 3.4 (canonical, 16 tables, 5 GEOMETRY, 35 indexes)
     │   ├── migrate-data.sh   MariaDB → PG helper
     │   └── validate-migration.js  row-count / FK validation
     └── MIGRATIONS.md         reproducible migration docs
```

---

> **Phase 1:** PostgreSQL 16 + PostGIS 3.4 (migrated from MariaDB). See
> `docs/modernization/phase-1-postgresql-postgis.md` for versions, schema, migration, GIS foundation, indexing, roles, backup/rollback, validation.

## ⚙️ Setup (CachyOS / Arch Linux — PostgreSQL)

```bash
# 1. Prerequisites
sudo pacman -Syu
sudo pacman -S nodejs npm postgresql postgis

# 2. Docker (recommended) — fresh DB with PostGIS
cp .env.example .env && nano .env   # set DB_PASSWORD (32+), SESSION_SECRET, PAYMENT_WEBHOOK_SECRET
cp backend/.env.example backend/.env # same DB_PASSWORD
docker compose up -d db             # auto-applies database/postgresql/schema.sql
docker exec ddcms_db psql -U ddcms -d dire_dawa_cleaning -c "SELECT PostGIS_Version();"
DB_HOST=localhost node database/migrate.js up
SEED_PASSWORD=<strong> node database/seed.js
docker compose up --build -d        # backend + frontend + db

# 3. Manual PostgreSQL (without Docker)
sudo -u postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
sudo -u postgres createuser -s $USER
sudo -u postgres createdb dire_dawa_cleaning
psql -U ddcms -d dire_dawa_cleaning -h localhost -f database/postgresql/schema.sql

# 4. Backend
cd backend
cp .env.example .env
nano .env    # set DB_PASSWORD and SESSION_SECRET
npm install
npm run dev

# 5. Frontend (new terminal)
cd ../frontend
npx http-server -p 3000
# open http://localhost:3000
```

---

## 🔐 Default Login Credentials

All passwords = `password`

| Username      | Role      | Notes                                  |
|----------------|-----------|-----------------------------------------|
| `admin`        | Admin     | Full control                            |
| `collector1`   | Collector | Assigned to Kebele 01,02,05,07,09       |
| `collector2`   | Collector | Assigned to Kebele 03,04,06,08          |
| `leader_k1z1`  | Leader    | Assigned to Zone A - Kezira Market      |
| `leader_k1z2`  | Leader    | Assigned to Zone B - Kezira Residential |
| `leader_k2z1`  | Leader    | Assigned to Zone A - Sabian Main        |
| `viewer1`      | Viewer    | Read-only                               |

**Change all default passwords after first login (Settings → Change Password).**

---

## 👥 Roles & Permissions

| Feature              | Admin | Collector | Leader (own zone only) | Viewer |
|----------------------|:-----:|:---------:|:-----------------------:|:------:|
| Dashboard            | ✅ all | ✅ all    | ✅ zone only             | ✅ all |
| Businesses           | ✅    | ✅        | ✅ add/edit in own zone  | 👁 view |
| Inspections          | ✅    | ✅        | ✅ own zone              | ❌ |
| Workers              | ✅    | ✅        | ✅ own zone only         | ❌ |
| Tools/Equipment      | ✅    | ✅        | ✅ own zone only         | ❌ |
| Attendance           | ✅    | ✅        | ✅ own zone workers      | ❌ |
| Payments — record    | ✅    | ✅        | ✅ own zone businesses   | ❌ |
| Payments — edit/delete | ✅  | ✅        | ❌                       | ❌ |
| Zone Reports — submit| ✅    | ✅        | ✅ (own zone)            | ❌ |
| Zone Reports — review/approve | ✅ | ✅  | ❌                       | ❌ |
| Reports & CSV export | ✅    | ✅        | ❌ (own data only via API)| ✅ |
| User Management      | ✅    | ❌        | ❌                       | ❌ |
| Zone/Leader/Collector assignment | ✅ | ❌ | ❌                  | ❌ |

---

## 🏘 Hierarchy Details

### Kebeles (9 fixed)
Each kebele has a `collector_id`. Admin assigns a Collector in **Settings**.

### Safer Zones (12 per kebele = 108 total)
Each zone has a `leader_id`. Admin assigns a Zone Leader in **Settings → Zone Assignment**.
A Leader can only be assigned to ONE zone at a time (assigning to a new zone
automatically unassigns the old one).

### Zone Leader Capabilities
When a user with role `leader` logs in:
- Their sidebar shows a purple **zone badge** with their assigned zone name
- Every page shows a **"Your Zone" banner** confirming scope
- The backend automatically filters ALL data (workers, tools, businesses,
  payments, inspections, reports) to their assigned `safer_zone_id` — enforced
  via the `zoneAccess` middleware and per-route `leader_id` checks, not just
  UI hiding
- They CANNOT see or modify other zones' data, even via direct API calls

### Zone Reports Workflow
1. **Leader** creates a report (draft) → fills in workers present/absent,
   collection total, issues, actions taken, tools status
2. **Leader** clicks "Submit" → status becomes `submitted`
3. **Collector** sees it under "Pending Review" → reviews → marks `reviewed`
   or directly `approved`
4. **Admin** can also approve at any stage

### Tools & Equipment
Each zone has its own inventory: vehicles, equipment, uniforms, chemicals.
Leaders manage their zone's tools; condition tracked as good/fair/poor/broken.

---

## 🌐 Key New API Endpoints (v2)

| Method | URL | Description |
|--------|-----|-------------|
| GET  | `/api/users/leaders` | List all leaders + their assigned zone |
| PUT  | `/api/kebeles/:id` | Assign collector to kebele (admin) |
| POST | `/api/safer-zones` | Create zone + assign leader (admin) |
| PUT  | `/api/safer-zones/:id` | Reassign leader (admin) |
| GET/POST | `/api/tools` | Zone tools/equipment CRUD |
| GET/POST | `/api/zone-reports` | Leader report submission |
| PUT  | `/api/zone-reports/:id/review` | Collector review/approve |

All data-listing endpoints (`/businesses`, `/workers`, `/payments`,
`/inspections`, `/tools`, `/zone-reports`) automatically scope results to
`req.user`'s zone when `role === "leader"`.

---

## 🚨 Troubleshooting

**Leader sees "Not your zone" error**
→ Admin hasn't assigned this user to a zone yet. Go to
**Settings → Zone — Leader Assignment**, select the zone, choose the leader,
click Save.

**PostgreSQL connection failed**
```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
# Docker: docker compose logs db
# Check: pg_isready -h localhost -p 5432 -U ddcms
```

**Port 5000 in use**
```bash
sudo ss -tlnp | grep 5000
sudo kill -9 $(lsof -t -i:5000)
```
