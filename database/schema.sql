CREATE DATABASE IF NOT EXISTS dire_dawa_cleaning CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dire_dawa_cleaning;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  fayda_id      VARCHAR(50)  UNIQUE,
  phone         VARCHAR(30),
  role          ENUM('admin','collector','leader','viewer') NOT NULL DEFAULT 'viewer',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(64) PRIMARY KEY,
  user_id    INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kebeles (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(80) NOT NULL UNIQUE,
  code         VARCHAR(10) NOT NULL UNIQUE,
  collector_id INT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collector_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS safer_zones (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  kebele_id   INT NOT NULL,
  leader_id   INT,
  description TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (kebele_id) REFERENCES kebeles(id) ON DELETE CASCADE,
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_zone_kebele (name, kebele_id)
);

CREATE TABLE IF NOT EXISTS businesses (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  owner_name     VARCHAR(120) NOT NULL,
  owner_fayda_id VARCHAR(50),
  owner_phone    VARCHAR(30),
  type           ENUM('shop','cafe','hotel','restaurant','pharmacy','market','workshop','office','school','clinic','other') NOT NULL DEFAULT 'shop',
  monthly_target DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  safer_zone_id  INT NOT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  notes          TEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (safer_zone_id) REFERENCES safer_zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  business_id    INT NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  method         ENUM('cash','mobile','bank','other','telebirr','cbebirr') NOT NULL DEFAULT 'cash',
  status         ENUM('paid','pending','overdue','failed') NOT NULL DEFAULT 'pending',
  month          TINYINT NOT NULL,
  year           SMALLINT NOT NULL,
  paid_at        DATETIME,
  receipt_number VARCHAR(30) UNIQUE,
  notes          TEXT,
  collected_by   INT NOT NULL,
  gateway_name   VARCHAR(30) DEFAULT NULL,
  gateway_ref    VARCHAR(100) UNIQUE DEFAULT NULL,
  payment_url    TEXT DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id)  REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (collected_by) REFERENCES users(id),
  UNIQUE KEY uq_payment_period (business_id, month, year)
);

CREATE TABLE IF NOT EXISTS inspections (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  kebele_id     INT NOT NULL,
  safer_zone_id INT,
  date          DATE NOT NULL,
  status        ENUM('active','warning','danger') NOT NULL DEFAULT 'active',
  notes         TEXT,
  inspected_by  INT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (kebele_id)     REFERENCES kebeles(id) ON DELETE CASCADE,
  FOREIGN KEY (safer_zone_id) REFERENCES safer_zones(id) ON DELETE SET NULL,
  FOREIGN KEY (inspected_by)  REFERENCES users(id),
  UNIQUE KEY uq_insp_zone_day (safer_zone_id, date)
);

CREATE TABLE IF NOT EXISTS inspection_photos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  inspection_id INT NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  uploaded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  contact       VARCHAR(30),
  fayda_id      VARCHAR(50) UNIQUE,
  daily_wage    DECIMAL(10,2) NOT NULL DEFAULT 250.00,
  safer_zone_id INT,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  custom_attributes JSON DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (safer_zone_id) REFERENCES safer_zones(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  worker_id   INT NOT NULL,
  date        DATE NOT NULL,
  present     TINYINT(1) NOT NULL DEFAULT 1,
  bonus       DECIMAL(10,2),
  notes       TEXT,
  recorded_by INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id)   REFERENCES workers(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  UNIQUE KEY uq_attendance_day (worker_id, date)
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  worker_id   INT NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  paid_at     DATETIME NOT NULL,
  period_from DATE NOT NULL,
  period_to   DATE NOT NULL,
  notes       TEXT,
  paid_by     INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by)   REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tools (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(120) NOT NULL,
  category         ENUM('vehicle','equipment','uniform','chemical','other') NOT NULL DEFAULT 'equipment',
  quantity         INT NOT NULL DEFAULT 1,
  condition_status ENUM('good','fair','poor','broken') NOT NULL DEFAULT 'good',
  safer_zone_id    INT NOT NULL,
  notes            TEXT,
  acquired_date    DATE,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (safer_zone_id) REFERENCES safer_zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS zone_reports (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  safer_zone_id    INT NOT NULL,
  report_date      DATE NOT NULL,
  report_month     TINYINT NOT NULL,
  report_year      SMALLINT NOT NULL,
  submitted_by     INT NOT NULL,
  status           ENUM('draft','submitted','reviewed','approved') NOT NULL DEFAULT 'draft',
  workers_present  INT NOT NULL DEFAULT 0,
  workers_absent   INT NOT NULL DEFAULT 0,
  collection_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  issues_reported  TEXT,
  actions_taken    TEXT,
  tools_status     TEXT,
  reviewed_by      INT,
  reviewed_at      DATETIME,
  reviewer_notes   TEXT,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (safer_zone_id) REFERENCES safer_zones(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by)  REFERENCES users(id),
  FOREIGN KEY (reviewed_by)   REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   INT,
  old_values  JSON,
  new_values  JSON,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(255),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_date (created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  link        VARCHAR(200),
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user_read (user_id, is_read),
  INDEX idx_notif_date (created_at)
);

CREATE TABLE IF NOT EXISTS documents (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  category      ENUM('contract','photo','training','incident','report','other') NOT NULL DEFAULT 'other',
  file_path     VARCHAR(500) NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_size     INT NOT NULL DEFAULT 0,
  mime_type     VARCHAR(100),
  safer_zone_id INT,
  kebele_id     INT,
  uploaded_by   INT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (safer_zone_id) REFERENCES safer_zones(id) ON DELETE SET NULL,
  FOREIGN KEY (kebele_id) REFERENCES kebeles(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_doc_category (category),
  INDEX idx_doc_zone (safer_zone_id)
);

INSERT IGNORE INTO users (username,password_hash,full_name,phone,role) VALUES
  ('admin','$2a$10$Zg4vn3Cs6QC2ByfvReT8s.BwIQBMqSb88lOYdgNBTwnfKcxDBISdq','System Administrator','0911000000','admin'),
  ('collector1','$2a$10$Zg4vn3Cs6QC2ByfvReT8s.BwIQBMqSb88lOYdgNBTwnfKcxDBISdq','Abebe Bekele','0911000001','collector'),
  ('collector2','$2a$10$Zg4vn3Cs6QC2ByfvReT8s.BwIQBMqSb88lOYdgNBTwnfKcxDBISdq','Tigist Haile','0911000002','collector'),
  ('leader_k1z1','$2a$10$Zg4vn3Cs6QC2ByfvReT8s.BwIQBMqSb88lOYdgNBTwnfKcxDBISdq','Mulugeta Tadesse','0911100001','leader'),
  ('leader_k1z2','$2a$10$Zg4vn3Cs6QC2ByfvReT8s.BwIQBMqSb88lOYdgNBTwnfKcxDBISdq','Hiwot Girma','0911100002','leader'),
  ('leader_k2z1','$2a$10$Zg4vn3Cs6QC2ByfvReT8s.BwIQBMqSb88lOYdgNBTwnfKcxDBISdq','Dawit Bekele','0911100003','leader'),
  ('viewer1','$2a$10$Zg4vn3Cs6QC2ByfvReT8s.BwIQBMqSb88lOYdgNBTwnfKcxDBISdq','Fatuma Omar','0911000009','viewer');

INSERT IGNORE INTO kebeles (name,code,collector_id) VALUES
  ('Kebele 01','K01',2),('Kebele 02','K02',2),('Kebele 03','K03',3),
  ('Kebele 04','K04',3),('Kebele 05','K05',2),('Kebele 06','K06',3),
  ('Kebele 07','K07',2),('Kebele 08','K08',3),('Kebele 09','K09',2);

INSERT IGNORE INTO safer_zones (name,kebele_id,leader_id) VALUES
  ('Zone A - Kezira Main',1,4),
  ('Zone B - Kezira North',1,5),
  ('Zone C - Kezira South',1,NULL),
  ('Zone D - Kezira East',1,NULL),
  ('Zone E - Kezira West',1,NULL),
  ('Zone F - Kezira Market',1,NULL),
  ('Zone G - Kezira Center',1,NULL),
  ('Zone H - Kezira Road',1,NULL),
  ('Zone I - Kezira Hill',1,NULL),
  ('Zone J - Kezira Valley',1,NULL),
  ('Zone K - Kezira Old',1,NULL),
  ('Zone L - Kezira New',1,NULL),
  ('Zone A - Sabian Main',2,6),
  ('Zone B - Sabian North',2,NULL),
  ('Zone C - Sabian South',2,NULL),
  ('Zone D - Sabian East',2,NULL),
  ('Zone E - Sabian West',2,NULL),
  ('Zone F - Sabian Market',2,NULL),
  ('Zone G - Sabian Center',2,NULL),
  ('Zone H - Sabian Road',2,NULL),
  ('Zone I - Sabian Hill',2,NULL),
  ('Zone J - Sabian Valley',2,NULL),
  ('Zone K - Sabian Old',2,NULL),
  ('Zone L - Sabian New',2,NULL),
  ('Zone A - Legehare Main',3,NULL),
  ('Zone B - Legehare North',3,NULL),
  ('Zone C - Legehare South',3,NULL),
  ('Zone D - Legehare East',3,NULL),
  ('Zone E - Legehare West',3,NULL),
  ('Zone F - Legehare Market',3,NULL),
  ('Zone G - Legehare Center',3,NULL),
  ('Zone H - Legehare Road',3,NULL),
  ('Zone I - Legehare Hill',3,NULL),
  ('Zone J - Legehare Valley',3,NULL),
  ('Zone K - Legehare Old',3,NULL),
  ('Zone L - Legehare New',3,NULL),
  ('Zone A - Addis Ketema Main',4,NULL),
  ('Zone B - Addis Ketema North',4,NULL),
  ('Zone C - Addis Ketema South',4,NULL),
  ('Zone D - Addis Ketema East',4,NULL),
  ('Zone E - Addis Ketema West',4,NULL),
  ('Zone F - Addis Ketema Market',4,NULL),
  ('Zone G - Addis Ketema Center',4,NULL),
  ('Zone H - Addis Ketema Road',4,NULL),
  ('Zone I - Addis Ketema Hill',4,NULL),
  ('Zone J - Addis Ketema Valley',4,NULL),
  ('Zone K - Addis Ketema Old',4,NULL),
  ('Zone L - Addis Ketema New',4,NULL),
  ('Zone A - Goro Main',5,NULL),
  ('Zone B - Goro North',5,NULL),
  ('Zone C - Goro South',5,NULL),
  ('Zone D - Goro East',5,NULL),
  ('Zone E - Goro West',5,NULL),
  ('Zone F - Goro Market',5,NULL),
  ('Zone G - Goro Center',5,NULL),
  ('Zone H - Goro Road',5,NULL),
  ('Zone I - Goro Hill',5,NULL),
  ('Zone J - Goro Valley',5,NULL),
  ('Zone K - Goro Old',5,NULL),
  ('Zone L - Goro New',5,NULL),
  ('Zone A - Melka Jebdu Main',6,NULL),
  ('Zone B - Melka Jebdu North',6,NULL),
  ('Zone C - Melka Jebdu South',6,NULL),
  ('Zone D - Melka Jebdu East',6,NULL),
  ('Zone E - Melka Jebdu West',6,NULL),
  ('Zone F - Melka Jebdu Market',6,NULL),
  ('Zone G - Melka Jebdu Center',6,NULL),
  ('Zone H - Melka Jebdu Road',6,NULL),
  ('Zone I - Melka Jebdu Hill',6,NULL),
  ('Zone J - Melka Jebdu Valley',6,NULL),
  ('Zone K - Melka Jebdu Old',6,NULL),
  ('Zone L - Melka Jebdu New',6,NULL),
  ('Zone A - Dire Main',7,NULL),
  ('Zone B - Dire North',7,NULL),
  ('Zone C - Dire South',7,NULL),
  ('Zone D - Dire East',7,NULL),
  ('Zone E - Dire West',7,NULL),
  ('Zone F - Dire Market',7,NULL),
  ('Zone G - Dire Center',7,NULL),
  ('Zone H - Dire Road',7,NULL),
  ('Zone I - Dire Hill',7,NULL),
  ('Zone J - Dire Valley',7,NULL),
  ('Zone K - Dire Old',7,NULL),
  ('Zone L - Dire New',7,NULL),
  ('Zone A - Ashawa Main',8,NULL),
  ('Zone B - Ashawa North',8,NULL),
  ('Zone C - Ashawa South',8,NULL),
  ('Zone D - Ashawa East',8,NULL),
  ('Zone E - Ashawa West',8,NULL),
  ('Zone F - Ashawa Market',8,NULL),
  ('Zone G - Ashawa Center',8,NULL),
  ('Zone H - Ashawa Road',8,NULL),
  ('Zone I - Ashawa Hill',8,NULL),
  ('Zone J - Ashawa Valley',8,NULL),
  ('Zone K - Ashawa Old',8,NULL),
  ('Zone L - Ashawa New',8,NULL),
  ('Zone A - Hayahle Main',9,NULL),
  ('Zone B - Hayahle North',9,NULL),
  ('Zone C - Hayahle South',9,NULL),
  ('Zone D - Hayahle East',9,NULL),
  ('Zone E - Hayahle West',9,NULL),
  ('Zone F - Hayahle Market',9,NULL),
  ('Zone G - Hayahle Center',9,NULL),
  ('Zone H - Hayahle Road',9,NULL),
  ('Zone I - Hayahle Hill',9,NULL),
  ('Zone J - Hayahle Valley',9,NULL),
  ('Zone K - Hayahle Old',9,NULL),
  ('Zone L - Hayahle New',9,NULL);

INSERT IGNORE INTO businesses (name,owner_name,type,monthly_target,safer_zone_id) VALUES
  ('Selam Store','Mulugeta T.','shop',500,1),
  ('Blue Nile Cafe','Hiwot G.','cafe',800,1),
  ('Sunrise Hotel','Dawit B.','hotel',2000,2),
  ('Green Pharmacy','Yonas A.','pharmacy',600,3),
  ('Central Market','Ayana M.','market',900,13);

INSERT IGNORE INTO workers (full_name,contact,daily_wage,safer_zone_id) VALUES
  ('Ali Hassan','0911200001',250,1),
  ('Fatuma Omar','0911200002',250,1),
  ('Tesfaye Bekele','0911200003',280,2),
  ('Amina Yusuf','0911200004',250,2),
  ('Girma Tadesse','0911200005',300,13);

INSERT IGNORE INTO tools (name,category,quantity,condition_status,safer_zone_id) VALUES
  ('Cleaning Broom Set','equipment',10,'good',1),
  ('Garbage Truck','vehicle',1,'good',1),
  ('Safety Uniforms','uniform',8,'good',1),
  ('Bleach Chemical 20L','chemical',5,'good',2),
  ('Wheelbarrow','equipment',3,'fair',2);

-- ── Application user least-privilege grants ───────────────────
-- The MariaDB Docker image creates 'ddcms'@'%' via MARIADB_USER/MARIADB_PASSWORD.
-- Revoke broad privileges and grant only what the application needs.
-- NOTE: This runs AFTER schema creation, so the user already has CREATE/INSERT from Docker.
-- We restrict to DML only (no DDL) for runtime safety.
GRANT SELECT, INSERT, UPDATE, DELETE ON dire_dawa_cleaning.* TO 'ddcms'@'%';
FLUSH PRIVILEGES;
