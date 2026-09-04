# Production Infrastructure & Provisioning Specification

## 1. Executive Summary
- **Target Application:** Dire Dawa Cleaning Management System v2
- **Target Release Commit:** `b136f915ecce9aa4f664e474aa7dcb357dd92cb0`
- **Target Domain:** `diredawa-cleaning.gov.et`
- **Infrastructure Status:** `BLOCKED` (Requires external municipal IT cloud/VPS node allocation, DNS delegation, and TLS certificate issuance)

---

## 2. Target Production Architecture

```text
       Public Internet
             │
      [ Port 80 / 443 ]
             ▼
   ┌───────────────────┐
   │    Nginx Proxy    │ (TLS termination, HTTP→HTTPS redirect, Security Headers)
   └─────────┬─────────┘
             │ (Local network / Port 3000 & 5000)
             ├──────────────────────────┐
             ▼                          ▼
   ┌───────────────────┐      ┌───────────────────┐
   │ Next.js Frontend  │      │   Node.js API     │
   │   (Port 3000)     │      │   (Port 5000)     │
   └───────────────────┘      └─────────┬─────────┘
                                        │ (Port 5432)
                                        ▼
                              ┌───────────────────┐
                              │ PostgreSQL 16 +   │
                              │   PostGIS 3.4     │
                              └───────────────────┘
```

---

## 3. Host System Requirements & Specifications

### Hardware Minimums
- **CPU:** 4 vCPU Cores
- **RAM:** 8 GB RAM
- **Storage:** 80 GB SSD (NVMe preferred, separate backup volume recommended)
- **OS:** Ubuntu 22.04 LTS / Debian 12 / RHEL 9 (Linux x86_64)

### Software Stack
- **Node.js:** v22.x LTS (Match lockfile dependencies)
- **npm:** v10.x
- **Container Engine:** Docker Engine v26+ & Docker Compose v2.25+
- **Database:** PostgreSQL 16.8 with PostGIS 3.4.3 extension
- **Reverse Proxy:** Nginx 1.24+

---

## 4. Network Policy & Firewall Configuration

Strict inbound port restrictions must be enforced using `ufw` or cloud firewall rules:

```bash
# Allow SSH (Restricted to admin IPs where applicable)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Deny public database port
ufw deny 5432/tcp

# Enable firewall
ufw enable
```

*Note: PostgreSQL (Port 5432) MUST NOT be exposed to the public internet.*

---

## 5. Reverse Proxy (Nginx) & Security Headers Configuration

### Sample Production Nginx Configuration (`/etc/nginx/sites-available/diredawa-cleaning.conf`)

```nginx
server {
    listen 80;
    server_name diredawa-cleaning.gov.et;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name diredawa-cleaning.gov.et;

    ssl_certificate /etc/letsencrypt/live/diredawa-cleaning.gov.et/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/diredawa-cleaning.gov.et/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Required External Action Items for Infrastructure Enablement

To unblock the live production deployment, the Dire Dawa Municipal IT department must complete the following actions:

1. **VPS / Cloud Host Allocation:** Provision an Ubuntu 22.04 LTS server with a static public IPv4 address.
2. **DNS Record Creation:** Add an `A` record mapping `diredawa-cleaning.gov.et` to the assigned static public IP address.
3. **TLS Certificate Issuance:** Run Certbot to issue a Let's Encrypt TLS certificate:
   ```bash
   sudo certbot --nginx -d diredawa-cleaning.gov.et
   ```
4. **Environment Secrets Provisioning:** Supply production database passwords, `SESSION_SECRET`, and `PAYMENT_WEBHOOK_SECRET` via secure server `.env` files.

---

## 7. Infrastructure Acceptance Matrix

| Component | Status | Evidence | Notes |
| :--- | :--- | :--- | :--- |
| Application Release | PASS | `b136f915ecce9aa4f664e474aa7dcb357dd92cb0` | Working tree clean |
| Local Database & PostGIS | PASS | `PostgreSQL 16.8` + `PostGIS 3.4.3` | Container `ddcms_db` healthy |
| 9 Kebeles & 108 Safer Zones | PASS | Verified in schema & seed data | Baseline verified |
| Automated Backup Script | PASS | `./scripts/backup-db.sh` | SHA256 backup tested |
| Next.js Build | PASS | `frontend-next` build succeeded | Verified compilation |
| Production Server Host | BLOCKED | Host node unavailable | External action required |
| Public DNS (`diredawa-cleaning.gov.et`) | BLOCKED | Domain record unassigned | External action required |
| Public HTTPS/TLS Cert | BLOCKED | ACME challenge unfulfilled | External action required |
