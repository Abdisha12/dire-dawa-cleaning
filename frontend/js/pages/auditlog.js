// frontend/js/pages/auditlog.js — Activity Log / Audit Trail Page (Admin)

async function renderAuditLog() {
  const content = document.getElementById("page-content");
  content.innerHTML = spinnerHTML;

  if (!API.hasRole("admin")) {
    content.innerHTML = `<div class="empty"><div class="icon">🔒</div><p>Access restricted to administrators.</p></div>`;
    return;
  }

  let currentPage = 1;
  const limit = 25;

  async function loadData(page = 1) {
    currentPage = page;
    const entityType = document.getElementById("al-entity")?.value || "";
    const action = document.getElementById("al-action")?.value || "";
    const from = document.getElementById("al-from")?.value || "";
    const to = document.getElementById("al-to")?.value || "";

    const container = document.getElementById("audit-tbody");
    if (container) container.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem">${spinnerHTML}</td></tr>`;

    try {
      const data = await API.getAuditLog({ entityType, action, from, to, page, limit });
      renderRows(data.rows || []);
      renderPagination("audit-pagination", data.page, data.pages, loadData);
    } catch (err) {
      if (container) container.innerHTML = `<tr><td colspan="6" style="color:var(--red);text-align:center;padding:1.5rem">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById("audit-tbody");
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">No activity logs match your filter criteria</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const actionClass = {
        CREATE: "badge-green",
        UPDATE: "badge-blue",
        DELETE: "badge-red",
        APPROVE: "badge-purple",
        LOGIN: "badge-gray",
        PASSWORD_CHANGE: "badge-orange"
      }[r.action] || "badge-gray";

      let details = "—";
      if (r.new_values || r.old_values) {
        details = `<button class="btn btn-sm btn-outline" onclick="toggleAuditDiff(${r.id})">🔍 View Diff</button>`;
      }

      return `
        <tr>
          <td style="white-space:nowrap;font-size:.8rem;color:var(--gray-500)">${fmtDate(r.created_at)} ${new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
          <td><strong>${escapeHtml(r.user_name || "System/Unknown")}</strong> ${r.user_role ? `<span class="badge badge-gray">${escapeHtml(r.user_role)}</span>` : ""}</td>
          <td><span class="badge ${actionClass}">${r.action}</span></td>
          <td><code style="font-size:.78rem;background:var(--gray-100);padding:.15rem .4rem;border-radius:4px">${escapeHtml(r.entity_type)}${r.entity_id ? ` #${r.entity_id}` : ""}</code></td>
          <td style="font-size:.75rem;color:var(--gray-500)">${r.ip_address || "—"}</td>
          <td>${details}</td>
        </tr>
        <tr id="audit-diff-${r.id}" class="hidden" style="background:var(--gray-50)">
          <td colspan="6" style="padding:1rem">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:.78rem">
              <div>
                <strong style="color:var(--red)">Previous Values:</strong>
                <pre style="background:var(--white);padding:.6rem;border:1px solid var(--gray-200);border-radius:6px;overflow-x:auto;margin-top:.3rem">${r.old_values ? safeJsonDisplay(r.old_values) : "None"}</pre>
              </div>
              <div>
                <strong style="color:var(--green)">New Values:</strong>
                <pre style="background:var(--white);padding:.6rem;border:1px solid var(--gray-200);border-radius:6px;overflow-x:auto;margin-top:.3rem">${r.new_values ? safeJsonDisplay(r.new_values) : "None"}</pre>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  content.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">📜 Audit Trail & System Activity Log</div>
      <div class="toolbar">
        <div class="form-group" style="min-width:140px">
          <label>Entity Type</label>
          <select class="form-control" id="al-entity">
            <option value="">All Entities</option>
            <option value="payment">Payment</option>
            <option value="worker">Worker</option>
            <option value="inspection">Inspection</option>
            <option value="zone_report">Zone Report</option>
            <option value="user">User</option>
            <option value="session">Session / Login</option>
            <option value="attendance">Attendance</option>
            <option value="salary">Salary</option>
          </select>
        </div>
        <div class="form-group" style="min-width:130px">
          <label>Action</label>
          <select class="form-control" id="al-action">
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="APPROVE">APPROVE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
          </select>
        </div>
        <div class="form-group" style="min-width:140px">
          <label>From Date</label>
          <input type="date" class="form-control" id="al-from">
        </div>
        <div class="form-group" style="min-width:140px">
          <label>To Date</label>
          <input type="date" class="form-control" id="al-to">
        </div>
        <div style="margin-top:auto">
          <button class="btn btn-primary" id="btn-filter-audit">🔍 Filter Logs</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>IP Address</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody id="audit-tbody"></tbody>
        </table>
      </div>
      <div id="audit-pagination" class="pagination"></div>
    </div>
  `;

  document.getElementById("btn-filter-audit").addEventListener("click", () => loadData(1));
  loadData(1);
}

function toggleAuditDiff(id) {
  const row = document.getElementById(`audit-diff-${id}`);
  if (row) row.classList.toggle("hidden");
}
