// frontend/js/main.js — SPA router + shell

const PAGES = {
  landing: renderLanding, login: renderLogin, dashboard: renderDashboard,
  businesses: renderBusinesses, inspections: renderInspections,
  workers: renderWorkers, payments: renderPayments,
  tools: renderTools, zonereports: renderZoneReports,
  reports: renderReports, documents: renderDocuments,
  notifications: renderNotifications, auditlog: renderAuditLog,
  users: renderUsers, settings: renderSettings,
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊", roles: ["admin", "collector", "leader", "viewer"] },
  { id: "notifications", label: "Notifications", icon: "🔔", roles: ["admin", "collector", "leader", "viewer"] },
  { id: "businesses", label: "Businesses", icon: "🏪", roles: ["admin", "collector", "leader", "viewer"] },
  { id: "inspections", label: "Inspections", icon: "🔍", roles: ["admin", "collector", "leader"] },
  { id: "workers", label: "Workers", icon: "👷", roles: ["admin", "collector", "leader"] },
  { id: "tools", label: "Tools", icon: "🔧", roles: ["admin", "collector", "leader"] },
  { id: "payments", label: "Payments", icon: "💳", roles: ["admin", "collector", "leader"] },
  { id: "zonereports", label: "Zone Reports", icon: "📝", roles: ["admin", "collector", "leader"] },
  { id: "documents", label: "Documents", icon: "📁", roles: ["admin", "collector", "leader", "viewer"] },
  { id: "reports", label: "Reports", icon: "📋", roles: ["admin", "collector", "viewer"] },
  { id: "auditlog", label: "Audit Log", icon: "📜", roles: ["admin"] },
  { id: "users", label: "User Mgmt", icon: "👥", roles: ["admin"] },
  { id: "settings", label: "Settings", icon: "⚙️", roles: ["admin", "collector", "leader", "viewer"] },
];

function renderShell() {
  document.getElementById("app").style.display = "";
  const user = API.getUser();
  const role = user?.role || "viewer";
  const zone = user?.zone;
  const navItems = NAV.filter(n => n.roles.includes(role));
  const avatarCls = `avatar avatar-${role}`;

  document.getElementById("app").innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <span>🧹</span>
        <div>
          <div style="font-size:.65rem;opacity:.55;font-weight:400">Dire Dawa</div>
          <div>Cleaning CMS</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Navigation</div>
        ${navItems.map(n => `<a class="nav-link" data-page="${n.id}" href="#${n.id}">
          <span class="icon">${n.icon}</span>${n.label}
        </a>`).join("")}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="${avatarCls}">${(user?.fullName || "U")[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:600;font-size:.8rem">${escapeHtml(user?.fullName || "")}</div>
            <div style="font-size:.68rem;opacity:.6;text-transform:capitalize">${role}</div>
            ${zone ? `<div class="zone-badge">📍 ${escapeHtml(zone.name)}</div>` : ""}
          </div>
        </div>
        <button class="btn-logout" id="btn-logout">⏻ Logout</button>
      </div>
    </aside>

    <div class="main-wrap">
      <header class="top-bar">
        <button class="hamburger" id="hamburger">☰</button>
        <h2 id="page-title">Dashboard</h2>

        <!-- Notification Bell Icon in Top Bar -->
        <a href="#notifications" class="notif-bell-link" title="Notifications" style="position:relative;margin-left:auto;margin-right:1rem;font-size:1.2rem;text-decoration:none">
          🔔 <span id="notif-badge" class="badge badge-red hidden" style="position:absolute;top:-6px;right:-10px;font-size:.62rem;padding:.15rem .35rem">0</span>
        </a>

        <!-- Role badge -->
        <div style="font-size:.75rem;color:var(--gray-500);display:flex;align-items:center;gap:.4rem">
          ${role === "admin" ? "🔴 Admin"
      : role === "collector" ? "🔵 Collector"
        : role === "leader" && zone ? `🟣 Leader · ${escapeHtml(zone.name)}`
          : "👁 Viewer"}
        </div>
      </header>

      <main class="content" id="page-content">
        <div class="loading-overlay"><div class="spinner"></div></div>
      </main>

      <!-- Mobile Bottom Navigation Bar (< 768px) -->
      <nav class="mobile-bottom-nav">
        <a href="#dashboard" class="mobile-nav-item" data-page="dashboard">
          <span class="m-icon">📊</span>
          <span>Dash</span>
        </a>
        <a href="#inspections" class="mobile-nav-item" data-page="inspections">
          <span class="m-icon">🔍</span>
          <span>Inspect</span>
        </a>
        <a href="#workers" class="mobile-nav-item" data-page="workers">
          <span class="m-icon">👷</span>
          <span>Workers</span>
        </a>
        <a href="#payments" class="mobile-nav-item" data-page="payments">
          <span class="m-icon">💳</span>
          <span>Payments</span>
        </a>
        <a href="#notifications" class="mobile-nav-item" data-page="notifications">
          <span class="m-icon">🔔</span>
          <span>Alerts</span>
        </a>
      </nav>
    </div>`;

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await API.logout().catch(() => { }); API.clearAuth(); navigate("login");
  });
  document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
  document.querySelectorAll(".nav-link, .mobile-nav-item").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      document.getElementById("sidebar").classList.remove("open");
      navigate(a.dataset.page);
    });
  });

  updateHeaderNotifBadge();
  // Poll notifications count every 60s
  if (!window._notifTimer) {
    window._notifTimer = setInterval(updateHeaderNotifBadge, 60000);
  }
}

async function updateHeaderNotifBadge() {
  if (!API.isLoggedIn()) return;
  try {
    const res = await API.getUnreadNotifCount();
    const badge = document.getElementById("notif-badge");
    if (badge) {
      if (res.unreadCount > 0) {
        badge.textContent = res.unreadCount > 99 ? "99+" : res.unreadCount;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }
  } catch (err) { }
}

const PUBLIC_PAGES = ["landing", "login"];
function navigate(page, params = {}) {
  if (!API.isLoggedIn() && !PUBLIC_PAGES.includes(page)) page = "landing";
  window.location.hash = page; window._routeParams = params; route(page);
}

function route(page) {
  if (!page || page === "") page = API.isLoggedIn() ? "dashboard" : "landing";

  if (page === "landing") {
    if (API.isLoggedIn()) return navigate("dashboard");
    renderLanding(); return;
  }

  if (page === "login") {
    if (API.isLoggedIn()) return navigate("dashboard");
    document.getElementById("app").innerHTML = ""; renderLogin(); return;
  }
  if (!API.isLoggedIn()) return navigate("landing");

  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  document.querySelectorAll(".mobile-nav-item").forEach(a => a.classList.toggle("active", a.dataset.page === page));

  const titles = {
    dashboard: "Dashboard", businesses: "Businesses & Shops",
    inspections: "Daily Inspections", workers: "Workers Management",
    payments: "Payments & Collections", tools: "Tools & Equipment",
    zonereports: "Zone Monthly Reports", documents: "Documents & Files",
    notifications: "Notification Center", auditlog: "Audit Log & Activity",
    reports: "Reports & Export", users: "User Management", settings: "Settings"
  };

  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = titles[page] || page;
  const fn = PAGES[page];
  if (fn) fn();
  else document.getElementById("page-content").innerHTML =
    `<div class="empty"><div class="icon">🚧</div><p>Page not found</p></div>`;
}

async function boot() {
  const hash = window.location.hash.replace("#", "") || "";
  if (!API.isLoggedIn()) {
    document.getElementById("app").innerHTML = "";
    if (hash === "login") renderLogin();
    else renderLanding();
    return;
  }
  // Refresh user (get zone for leaders)
  const me = await API.me().catch(() => null);
  if (me) {
    const stored = API.getUser();
    API.setAuth(API.getToken(), { ...stored, ...me, fullName: me.fullName || stored.fullName });
  }
  renderShell(); route(hash || "dashboard");
}

window.addEventListener("hashchange", () => {
  const page = window.location.hash.replace("#", "") || "";
  if (API.isLoggedIn() && !["landing", "login"].includes(page) && !document.querySelector(".sidebar")) {
    renderShell();
  }
  route(page);
});
window.addEventListener("DOMContentLoaded", boot);
