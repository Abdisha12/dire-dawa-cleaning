-- ──────────────────────────────────────────────────────────────────
-- Dire Dawa Cleaning Department — PostgreSQL + PostGIS Schema
-- Version: 1.0.0
-- PostgreSQL: 16
-- PostGIS: 3.4+
-- ──────────────────────────────────────────────────────────────────
-- This schema replaces the MariaDB schema from Phase 0.
-- It preserves all existing business tables, relationships, and seed data.
-- PostGIS extension is enabled for future spatial queries.
-- ──────────────────────────────────────────────────────────────────

-- ── Extensions ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Custom ENUM types ───────────────────────────────────────────
-- PostgreSQL ENUMs are type-safe and indexed. We use them for fixed
-- value columns that the application enforces.

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin','collector','leader','viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE business_type AS ENUM ('shop','cafe','hotel','restaurant','pharmacy','market','workshop','office','school','clinic','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash','mobile','bank','other','telebirr','cbebirr');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('paid','pending','overdue','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE inspection_status AS ENUM ('active','warning','danger');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tool_category AS ENUM ('vehicle','equipment','uniform','chemical','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tool_condition AS ENUM ('good','fair','poor','broken');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('draft','submitted','reviewed','approved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_category AS ENUM ('contract','photo','training','incident','report','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Updated-at trigger function ─────────────────────────────────
-- PostgreSQL has no ON UPDATE CURRENT_TIMESTAMP. We use a trigger.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  fayda_id      VARCHAR(50)  UNIQUE,
  phone         VARCHAR(30),
  role          user_role NOT NULL DEFAULT 'viewer',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(64) PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kebeles (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(80) NOT NULL UNIQUE,
  code         VARCHAR(10) NOT NULL UNIQUE,
  collector_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  -- PostGIS: future kebele boundaries (MULTIPOLYGON)
  boundary     GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE TRIGGER trg_kebeles_updated_at BEFORE UPDATE ON kebeles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS safer_zones (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  kebele_id   INT NOT NULL REFERENCES kebeles(id) ON DELETE CASCADE,
  leader_id   INT REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (name, kebele_id),
  -- PostGIS: future zone boundaries (MULTIPOLYGON)
  boundary    GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE TRIGGER trg_safer_zones_updated_at BEFORE UPDATE ON safer_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS businesses (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  owner_name     VARCHAR(120) NOT NULL,
  owner_fayda_id VARCHAR(50),
  owner_phone    VARCHAR(30),
  type           business_type NOT NULL DEFAULT 'shop',
  monthly_target NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  safer_zone_id  INT NOT NULL REFERENCES safer_zones(id) ON DELETE CASCADE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  -- PostGIS: future business location (POINT)
  location       GEOMETRY(POINT, 4326)
);
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  business_id    INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount         NUMERIC(12,2) NOT NULL,
  method         payment_method NOT NULL DEFAULT 'cash',
  status         payment_status NOT NULL DEFAULT 'pending',
  month          SMALLINT NOT NULL,
  year           SMALLINT NOT NULL,
  paid_at        TIMESTAMP,
  receipt_number VARCHAR(30) UNIQUE,
  notes          TEXT,
  collected_by   INT NOT NULL REFERENCES users(id),
  gateway_name   VARCHAR(30) DEFAULT NULL,
  gateway_ref    VARCHAR(100) UNIQUE DEFAULT NULL,
  payment_url    TEXT DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, month, year)
);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS inspections (
  id            SERIAL PRIMARY KEY,
  kebele_id     INT NOT NULL REFERENCES kebeles(id) ON DELETE CASCADE,
  safer_zone_id INT REFERENCES safer_zones(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  status        inspection_status NOT NULL DEFAULT 'active',
  notes         TEXT,
  inspected_by  INT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (safer_zone_id, date),
  -- PostGIS: future inspection location (POINT)
  location      GEOMETRY(POINT, 4326)
);
CREATE TRIGGER trg_inspections_updated_at BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS inspection_photos (
  id            SERIAL PRIMARY KEY,
  inspection_id INT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  file_path     VARCHAR(255) NOT NULL,
  uploaded_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  contact       VARCHAR(30),
  fayda_id      VARCHAR(50) UNIQUE,
  daily_wage    NUMERIC(10,2) NOT NULL DEFAULT 250.00,
  safer_zone_id INT REFERENCES safer_zones(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  custom_attributes JSONB DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  -- PostGIS: future worker location (POINT)
  location      GEOMETRY(POINT, 4326)
);
CREATE TRIGGER trg_workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  worker_id   INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  present     BOOLEAN NOT NULL DEFAULT TRUE,
  bonus       NUMERIC(10,2),
  notes       TEXT,
  recorded_by INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, date)
);
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS salary_payments (
  id          SERIAL PRIMARY KEY,
  worker_id   INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  paid_at     TIMESTAMP NOT NULL,
  period_from DATE NOT NULL,
  period_to   DATE NOT NULL,
  notes       TEXT,
  paid_by     INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_salary_payments_updated_at BEFORE UPDATE ON salary_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS tools (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(120) NOT NULL,
  category         tool_category NOT NULL DEFAULT 'equipment',
  quantity         INT NOT NULL DEFAULT 1,
  condition_status tool_condition NOT NULL DEFAULT 'good',
  safer_zone_id    INT NOT NULL REFERENCES safer_zones(id) ON DELETE CASCADE,
  notes            TEXT,
  acquired_date    DATE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_tools_updated_at BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS zone_reports (
  id               SERIAL PRIMARY KEY,
  safer_zone_id    INT NOT NULL REFERENCES safer_zones(id) ON DELETE CASCADE,
  report_date      DATE NOT NULL,
  report_month     SMALLINT NOT NULL,
  report_year      SMALLINT NOT NULL,
  submitted_by     INT NOT NULL REFERENCES users(id),
  status           report_status NOT NULL DEFAULT 'draft',
  workers_present  INT NOT NULL DEFAULT 0,
  workers_absent   INT NOT NULL DEFAULT 0,
  collection_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  issues_reported  TEXT,
  actions_taken    TEXT,
  tools_status     TEXT,
  reviewed_by      INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMP,
  reviewer_notes   TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (safer_zone_id, report_month, report_year)
);
CREATE TRIGGER trg_zone_reports_updated_at BEFORE UPDATE ON zone_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   INT,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(255),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  link        VARCHAR(200),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  category      document_category NOT NULL DEFAULT 'other',
  file_path     VARCHAR(500) NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_size     INT NOT NULL DEFAULT 0,
  mime_type     VARCHAR(100),
  safer_zone_id INT REFERENCES safer_zones(id) ON DELETE SET NULL,
  kebele_id     INT REFERENCES kebeles(id) ON DELETE SET NULL,
  uploaded_by   INT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Performance indexes ─────────────────────────────────────────

CREATE INDEX idx_sz_leader ON safer_zones(leader_id);
CREATE INDEX idx_payment_status_period ON payments(status, year, month);
CREATE INDEX idx_insp_photo_inspid ON inspection_photos(inspection_id);
CREATE INDEX idx_insp_date ON inspections(date);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_worker_zone ON workers(safer_zone_id);
CREATE INDEX idx_zr_zone_period_status ON zone_reports(safer_zone_id, report_year, report_month, status);
CREATE INDEX idx_biz_zone ON businesses(safer_zone_id);
CREATE INDEX idx_users_role_active ON users(role, is_active);
CREATE INDEX idx_kebele_collector ON kebeles(collector_id);
CREATE INDEX idx_session_expiry ON sessions(expires_at);

-- PostGIS spatial indexes (for future use)
CREATE INDEX idx_kebele_boundary ON kebeles USING GIST (boundary);
CREATE INDEX idx_zone_boundary ON safer_zones USING GIST (boundary);
CREATE INDEX idx_business_location ON businesses USING GIST (location);
CREATE INDEX idx_inspection_location ON inspections USING GIST (location);
CREATE INDEX idx_worker_location ON workers USING GIST (location);

-- ── Seed data ───────────────────────────────────────────────────
-- Kebeles: Dire Dawa's 9 kebeles
INSERT INTO kebeles (name, code) VALUES
  ('Kebele 01','K01'),('Kebele 02','K02'),('Kebele 03','K03'),
  ('Kebele 04','K04'),('Kebele 05','K05'),('Kebele 06','K06'),
  ('Kebele 07','K07'),('Kebele 08','K08'),('Kebele 09','K09')
ON CONFLICT (name) DO NOTHING;

-- Safer Zones: 12 zones per kebele (108 total)
INSERT INTO safer_zones (name, kebele_id) VALUES
  ('Zone A - Kezira Main',1),('Zone B - Kezira North',1),('Zone C - Kezira South',1),
  ('Zone D - Kezira East',1),('Zone E - Kezira West',1),('Zone F - Kezira Market',1),
  ('Zone G - Kezira Center',1),('Zone H - Kezira Road',1),('Zone I - Kezira Hill',1),
  ('Zone J - Kezira Valley',1),('Zone K - Kezira Old',1),('Zone L - Kezira New',1),
  ('Zone A - Sabian Main',2),('Zone B - Sabian North',2),('Zone C - Sabian South',2),
  ('Zone D - Sabian East',2),('Zone E - Sabian West',2),('Zone F - Sabian Market',2),
  ('Zone G - Sabian Center',2),('Zone H - Sabian Road',2),('Zone I - Sabian Hill',2),
  ('Zone J - Sabian Valley',2),('Zone K - Sabian Old',2),('Zone L - Sabian New',2),
  ('Zone A - Legehare Main',3),('Zone B - Legehare North',3),('Zone C - Legehare South',3),
  ('Zone D - Legehare East',3),('Zone E - Legehare West',3),('Zone F - Legehare Market',3),
  ('Zone G - Legehare Center',3),('Zone H - Legehare Road',3),('Zone I - Legehare Hill',3),
  ('Zone J - Legehare Valley',3),('Zone K - Legehare Old',3),('Zone L - Legehare New',3),
  ('Zone A - Addis Ketema Main',4),('Zone B - Addis Ketema North',4),('Zone C - Addis Ketema South',4),
  ('Zone D - Addis Ketema East',4),('Zone E - Addis Ketema West',4),('Zone F - Addis Ketema Market',4),
  ('Zone G - Addis Ketema Center',4),('Zone H - Addis Ketema Road',4),('Zone I - Addis Ketema Hill',4),
  ('Zone J - Addis Ketema Valley',4),('Zone K - Addis Ketema Old',4),('Zone L - Addis Ketema New',4),
  ('Zone A - Goro Main',5),('Zone B - Goro North',5),('Zone C - Goro South',5),
  ('Zone D - Goro East',5),('Zone E - Goro West',5),('Zone F - Goro Market',5),
  ('Zone G - Goro Center',5),('Zone H - Goro Road',5),('Zone I - Goro Hill',5),
  ('Zone J - Goro Valley',5),('Zone K - Goro Old',5),('Zone L - Goro New',5),
  ('Zone A - Melka Jebdu Main',6),('Zone B - Melka Jebdu North',6),('Zone C - Melka Jebdu South',6),
  ('Zone D - Melka Jebdu East',6),('Zone E - Melka Jebdu West',6),('Zone F - Melka Jebdu Market',6),
  ('Zone G - Melka Jebdu Center',6),('Zone H - Melka Jebdu Road',6),('Zone I - Melka Jebdu Hill',6),
  ('Zone J - Melka Jebdu Valley',6),('Zone K - Melka Jebdu Old',6),('Zone L - Melka Jebdu New',6),
  ('Zone A - Dire Main',7),('Zone B - Dire North',7),('Zone C - Dire South',7),
  ('Zone D - Dire East',7),('Zone E - Dire West',7),('Zone F - Dire Market',7),
  ('Zone G - Dire Center',7),('Zone H - Dire Road',7),('Zone I - Dire Hill',7),
  ('Zone J - Dire Valley',7),('Zone K - Dire Old',7),('Zone L - Dire New',7),
  ('Zone A - Ashawa Main',8),('Zone B - Ashawa North',8),('Zone C - Ashawa South',8),
  ('Zone D - Ashawa East',8),('Zone E - Ashawa West',8),('Zone F - Ashawa Market',8),
  ('Zone G - Ashawa Center',8),('Zone H - Ashawa Road',8),('Zone I - Ashawa Hill',8),
  ('Zone J - Ashawa Valley',8),('Zone K - Ashawa Old',8),('Zone L - Ashawa New',8),
  ('Zone A - Hayahle Main',9),('Zone B - Hayahle North',9),('Zone C - Hayahle South',9),
  ('Zone D - Hayahle East',9),('Zone E - Hayahle West',9),('Zone F - Hayahle Market',9),
  ('Zone G - Hayahle Center',9),('Zone H - Hayahle Road',9),('Zone I - Hayahle Hill',9),
  ('Zone J - Hayahle Valley',9),('Zone K - Hayahle Old',9),('Zone L - Hayahle New',9)
ON CONFLICT (name, kebele_id) DO NOTHING;

-- Seed businesses
INSERT INTO businesses (name, owner_name, type, monthly_target, safer_zone_id) VALUES
  ('Selam Store','Mulugeta T.','shop',500,1),
  ('Blue Nile Cafe','Hiwot G.','cafe',800,1),
  ('Sunrise Hotel','Dawit B.','hotel',2000,2),
  ('Green Pharmacy','Yonas A.','pharmacy',600,3),
  ('Central Market','Ayana M.','market',900,13)
ON CONFLICT DO NOTHING;

-- Seed workers
INSERT INTO workers (full_name, contact, daily_wage, safer_zone_id) VALUES
  ('Ali Hassan','0911200001',250,1),
  ('Fatuma Omar','0911200002',250,1),
  ('Tesfaye Bekele','0911200003',280,2),
  ('Amina Yusuf','0911200004',250,2),
  ('Girma Tadesse','0911200005',300,13)
ON CONFLICT DO NOTHING;

-- Seed tools
INSERT INTO tools (name, category, quantity, condition_status, safer_zone_id) VALUES
  ('Cleaning Broom Set','equipment',10,'good',1),
  ('Garbage Truck','vehicle',1,'good',1),
  ('Safety Uniforms','uniform',8,'good',1),
  ('Bleach Chemical 20L','chemical',5,'good',2),
  ('Wheelbarrow','equipment',3,'fair',2)
ON CONFLICT DO NOTHING;

-- ── Application user ────────────────────────────────────────────
-- Create the application user with limited privileges.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ddcms') THEN
    CREATE ROLE ddcms LOGIN PASSWORD 'changeme';
  END IF;
END $$;

GRANT CONNECT ON DATABASE dire_dawa_cleaning TO ddcms;
GRANT USAGE ON SCHEMA public TO ddcms;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ddcms;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ddcms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ddcms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ddcms;
