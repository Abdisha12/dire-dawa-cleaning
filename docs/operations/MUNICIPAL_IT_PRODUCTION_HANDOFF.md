# Municipal IT Production Handoff Document

## 1. Executive Summary & Release Identification
- **Project Name:** Dire Dawa Cleaning Management System (v2)
- **Approved Release:** `Dire Dawa Cleaning Management System v2`
- **Application Code Commit:** `b136f915ecce9aa4f664e474aa7dcb357dd92cb0`
- **Documented Target Domain:** `diredawa-cleaning.gov.et`
- **Current Status:** `HANDOFF READY` (Pending Municipal IT Server, DNS, and TLS Provisioning)

---

## 2. Server & Hardware Specifications

### Operating System
- **Distribution:** Ubuntu 22.04 LTS (x86_64)

### Compute & Storage Minimums
- **CPU:** 4 vCPU cores
- **RAM:** 8 GB RAM
- **Storage:** 80 GB SSD (NVMe storage recommended)
- **Architecture:** 64-bit

---

## 3. Network Architecture & Firewall Policy

```text
                  Public Internet
                         │
                   Port 80 / 443
                         │
                         ▼
             ┌──────────────────────┐
             │ Nginx Reverse Proxy  │ (TLS Termination)
             └──────────┬───────────┘
                        │ Local Network
                        ├─────────────────────────┐
                        ▼                         ▼
             ┌────────────────────┐     ┌────────────────────┐
             │ Next.js Frontend   │     │  Node.js Express   │
             │    (Port 3000)     │     │    (Port 5000)     │
             └────────────────────┘     └─────────┬──────────┘
                                                  │ Port 5432
                                                  ▼
                                        ┌────────────────────┐
                                        │ PostgreSQL 16 +    │
                                        │    PostGIS 3.4     │
                                        └────────────────────┘
```

### Port Access Rules
- `80/tcp` (HTTP) — **PUBLIC** (Forwards 301 to HTTPS)
- `443/tcp` (HTTPS) — **PUBLIC** (TLS Encrypted Application Traffic)
- `22/tcp` (SSH) — **ADMINISTRATIVE** (Restricted to Municipal IT Admin IP range)
- `5432/tcp` (PostgreSQL) — **PRIVATE ONLY** (Must not be bound or routed to the public network interface)

---

## 4. DNS Specification

- **Fully Qualified Domain Name (FQDN):** `diredawa-cleaning.gov.et`
- **Record Type:** `A` Record
- **Target Value:** `<PRODUCTION_PUBLIC_IP>` (Assigned static public IP of the production server)
- **TTL:** 300 seconds (recommended for initial setup)

---

## 5. TLS / HTTPS Certificate Specification

- **Certificate Hostname:** `diredawa-cleaning.gov.et`
- **Certificate Provider:** Let's Encrypt / ACME or Municipal CA
- **Automated Renewal Process:** Certbot with Nginx plugin
- **Command:**
  ```bash
  sudo certbot --nginx -d diredawa-cleaning.gov.et
  ```

---

## 6. PostgreSQL 16 + PostGIS 3.4 Requirements

- **PostgreSQL Version:** 16.x
- **PostGIS Version:** 3.4.x (`postgis` and `uuid-ossp` extensions enabled)
- **Database Name:** `dire_dawa_cleaning`
- **Application User:** `ddcms` (Restricted privileges, non-superuser)
- **Municipal Hierarchy:** 9 Kebeles & 108 Safer Zones pre-seeded in production schema.

---

## 7. Environment Secret Categories & Provisioning Rules

The application requires the following environment variables provided via server-side `.env` files:

- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL=postgresql://ddcms:<PRODUCTION_DB_PASSWORD>@localhost:5432/dire_dawa_cleaning`
- `SESSION_SECRET=<PRODUCTION_SESSION_SECRET>`
- `PAYMENT_WEBHOOK_SECRET=<PRODUCTION_WEBHOOK_SECRET>`

> **Security Rule:** Never commit secrets to Git repositories or share passwords via unencrypted channels.

---

## 8. Sequential Operator Deployment Procedure

1. **Provision Server Host:** Deploy Ubuntu 22.04 LTS server with public IP.
2. **Apply Security Hardening:** Create non-root deployment user and configure SSH key access.
3. **Configure Firewall:** Allow ports 80 and 443; restrict port 22; block port 5432.
4. **Configure DNS:** Map `A` record for `diredawa-cleaning.gov.et` to public IP.
5. **Install Runtime & DB:** Install Docker Engine / Docker Compose and PostgreSQL 16 + PostGIS 3.4.
6. **Configure Reverse Proxy:** Install Nginx and deploy site configuration.
7. **Obtain TLS Certificate:** Run `certbot --nginx -d diredawa-cleaning.gov.et` after DNS propagation.
8. **Deploy Release Code:** Checkout commit `b136f915ecce9aa4f664e474aa7dcb357dd92cb0`.
9. **Apply Database Migrations:** Run `./database/migrate.js up` or `npm run migrate`.
10. **Start Application Services:** Execute `docker compose up -d` or systemd service startup.
11. **Verify Live Operation:** Run `./scripts/db-health-check.sh` and test `/api/health`.

---

## 9. Information IT Administrators Must Return

Upon completing provisioning, Municipal IT should provide the following non-sensitive confirmation details:

```text
[ ] Production Hostname: diredawa-cleaning.gov.et
[ ] Assigned Public IP: <IP_ADDRESS>
[ ] Server OS: Ubuntu 22.04 LTS Verified
[ ] CPU / RAM: 4 vCPU / 8 GB RAM Verified
[ ] SSH Access Status: Configured (Non-root user)
[ ] DNS Resolution Status: Verified (A record active)
[ ] TLS Certificate Status: Issued & Active
[ ] Database Connection Status: Healthy (PostgreSQL 16 + PostGIS 3.4)
[ ] Deployment Access: Ready for Release Commit b136f915ecce9aa4f664e474aa7dcb357dd92cb0
```

---

## 10. Blocker & Owner Matrix

| Component | Status | Owner | Required Action |
| :--- | :--- | :--- | :--- |
| **Release Code & Architecture** | **READY** | Software Team | Approved (`b136f915ecce9aa4f664e474aa7dcb357dd92cb0`) |
| **Deployment Runbooks & Docs** | **READY** | Software Team | Handover documentation complete |
| **Production Server Host** | **BLOCKED** | Municipal IT | Allocate Ubuntu 22.04 LTS server node |
| **Public IP & DNS Routing** | **BLOCKED** | Municipal IT | Assign IP & map `diredawa-cleaning.gov.et` |
| **TLS Certificate Issuance** | **BLOCKED** | Municipal IT | Run Certbot against domain |
| **Production Secrets** | **PENDING** | Municipal IT | Populate server `.env` file |
