// frontend/js/pages/notifications.js — Full Notifications Page

async function renderNotifications() {
  const content = document.getElementById("page-content");
  content.innerHTML = spinnerHTML;

  let currentPage = 1;
  const limit = 20;

  async function loadNotifs(page = 1) {
    currentPage = page;
    const isRead = document.getElementById("notif-filter-status")?.value || "";
    const container = document.getElementById("notif-list-container");
    if (container) container.innerHTML = spinnerHTML;

    try {
      const data = await API.getNotifications({ isRead, page, limit });
      renderList(data.rows || []);
      renderPagination("notif-pagination", data.page, data.pages, loadNotifs);
    } catch (err) {
      if (container) container.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderList(items) {
    const container = document.getElementById("notif-list-container");
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<div class="empty"><div class="icon">🔔</div><p>No notifications found</p></div>`;
      return;
    }

    container.innerHTML = items.map(n => {
      const typeIcons = {
        overdue_payment: "💳",
        pending_report: "📝",
        absent_worker: "👷",
        report_approved: "✅"
      };
      const icon = typeIcons[n.type] || "🔔";
      const isUnread = !n.is_read;

      return `
        <div class="card ${isUnread ? "notif-unread" : ""}" style="margin-bottom:.75rem;padding:1rem;display:flex;align-items:flex-start;gap:.85rem">
          <div style="font-size:1.5rem;background:var(--gray-100);width:42px;height:42px;border-radius:50%;display:grid;place-items:center;flex-shrink:0">${icon}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.25rem">
              <h4 style="font-size:.9rem;font-weight:700;display:flex;align-items:center;gap:.5rem">
                ${escapeHtml(n.title)}
                ${isUnread ? `<span class="badge badge-blue">New</span>` : ""}
              </h4>
              <span style="font-size:.72rem;color:var(--gray-500)">${fmtDate(n.created_at)}</span>
            </div>
            <p style="font-size:.85rem;color:var(--gray-700);margin-bottom:.5rem">${escapeHtml(n.message)}</p>
            <div style="display:flex;gap:.5rem;align-items:center">
              ${n.link ? `<a href="${escapeAttr(n.link)}" ${n.link.startsWith("javascript:") ? 'style="display:none"' : ""} class="btn btn-sm btn-outline">View Details →</a>` : ""}
              ${isUnread ? `<button class="btn btn-sm btn-primary" onclick="markNotifReadSingle(${n.id})">Mark Read</button>` : ""}
              <button class="btn btn-sm btn-danger" style="margin-left:auto" onclick="deleteNotifSingle(${n.id})">🗑 Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  content.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">
        <span>🔔 Notification Center & Reminders</span>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-sm btn-outline" id="btn-mark-all-read">✓ Mark All Read</button>
          ${API.hasRole("admin", "collector") ? `<button class="btn btn-sm btn-primary" id="btn-generate-alerts">⚡ Trigger Alert Scan</button>` : ""}
        </div>
      </div>
      <div class="toolbar">
        <div class="form-group" style="min-width:160px">
          <label>Status Filter</label>
          <select class="form-control" id="notif-filter-status">
            <option value="">All Notifications</option>
            <option value="false">Unread Only</option>
            <option value="true">Read Only</option>
          </select>
        </div>
      </div>
    </div>

    <div id="notif-list-container"></div>
    <div id="notif-pagination" class="pagination"></div>
  `;

  document.getElementById("notif-filter-status").addEventListener("change", () => loadNotifs(1));
  document.getElementById("btn-mark-all-read").addEventListener("click", async () => {
    try {
      await API.markAllNotifsRead();
      toast("All notifications marked as read", "success");
      loadNotifs(currentPage);
      updateHeaderNotifBadge();
    } catch (err) { toast(escapeHtml(err.message), "error"); }
  });

  const btnGen = document.getElementById("btn-generate-alerts");
  if (btnGen) {
    btnGen.addEventListener("click", async () => {
      try {
        btnGen.disabled = true;
        btnGen.textContent = "Scanning...";
        const res = await API.generateAlerts();
        toast(`Scan complete! Generated ${res.overdueCount + res.reportCount + res.workerCount} alerts`, "success");
        loadNotifs(1);
        updateHeaderNotifBadge();
      } catch (err) { toast(escapeHtml(err.message), "error"); }
      finally {
        btnGen.disabled = false;
        btnGen.textContent = "⚡ Trigger Alert Scan";
      }
    });
  }

  loadNotifs(1);
}

async function markNotifReadSingle(id) {
  try {
    await API.markNotifRead(id);
    toast("Marked as read", "info");
    renderNotifications();
    updateHeaderNotifBadge();
  } catch (err) { toast(escapeHtml(err.message), "error"); }
}

async function deleteNotifSingle(id) {
  try {
    await API.deleteNotif(id);
    toast("Notification deleted", "info");
    renderNotifications();
    updateHeaderNotifBadge();
  } catch (err) { toast(escapeHtml(err.message), "error"); }
}
