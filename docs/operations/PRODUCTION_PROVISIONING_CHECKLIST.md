# Production Infrastructure Provisioning Checklist

This checklist is for Municipal IT Administrators provisioning production infrastructure for the Dire Dawa Cleaning Management System.

---

## 1. Production Host Provisioning
- [ ] OS: Ubuntu 22.04 LTS installed and updated (`sudo apt update && sudo apt upgrade -y`)
- [ ] Hardware: Minimum 4 vCPU, 8 GB RAM, 80 GB SSD storage
- [ ] User Access: Created non-root deployment user with SSH key authentication (`sudo usermod -aG sudo deploy`)
- [ ] Time Sync: Configured systemd-timesyncd or NTP (`timedatectl status`)

## 2. Network & Firewall
- [ ] Inbound Traffic: Opened port `80/tcp` (HTTP) and port `443/tcp` (HTTPS)
- [ ] SSH Access: Opened port `22/tcp` (restricted to admin IP range)
- [ ] Database Exposure: Port `5432/tcp` blocked from external networks (`sudo ufw status`)

## 3. Domain & DNS Routing
- [ ] FQDN: Domain `diredawa-cleaning.gov.et` assigned
- [ ] A Record: Pointed `diredawa-cleaning.gov.et` to assigned public static IP address
- [ ] Propagation: Verified public DNS resolution (`dig diredawa-cleaning.gov.et +short`)

## 4. Reverse Proxy & TLS Certificate
- [ ] Nginx Installed: Nginx web server running (`sudo systemctl status nginx`)
- [ ] Proxy Configured: Configured reverse proxy for `/api/` (Port 5000) and `/` (Port 3000)
- [ ] Certbot Installed: Issued TLS certificate via `sudo certbot --nginx -d diredawa-cleaning.gov.et`
- [ ] HTTPS Redirect: Verified HTTP automatically redirects to HTTPS (HTTP 301)

## 5. Database & Extensions
- [ ] PostgreSQL 16 Installed: Service running (`sudo systemctl status postgresql` or Docker)
- [ ] PostGIS Extension: Installed PostGIS 3.4 (`CREATE EXTENSION postgis;`)
- [ ] User & Privileges: Database user `ddcms` created with restricted application permissions

## 6. Secrets & Environment Setup
- [ ] Production Secrets: Created `.env` file containing strong `DB_PASSWORD`, `SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET`
- [ ] Permissions: Restricted `.env` permissions (`chmod 600 .env`)

## 7. Application Code & Deployment
- [ ] Release Commit: Checked out commit `b136f915ecce9aa4f664e474aa7dcb357dd92cb0`
- [ ] Dependencies: Installed dependencies using lockfile (`npm ci`)
- [ ] Build: Successfully compiled Next.js build (`npm run build` in `frontend-next`)
- [ ] Application Started: Services running via Docker Compose (`docker compose up -d`) or systemd

## 8. Final Health Verification
- [ ] API Health Endpoint: Returns 200 OK (`curl http://localhost:5000/api/health`)
- [ ] Database Health Script: Clean report (`./scripts/db-health-check.sh`)
- [ ] Automated Backup: Generated test backup (`./scripts/backup-db.sh`)
- [ ] 9 Kebeles & 108 Safer Zones: Structure verified in database tables
