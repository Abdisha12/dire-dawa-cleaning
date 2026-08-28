let _zrData = [], _zrPage = 1;

async function renderZoneReports() {
  const content = document.getElementById("page-content");
  content.innerHTML = spinnerHTML;
  const role = API.getUser()?.role;
  const zone = API.getZone();
  const canReview = API.hasRole("admin", "collector");
  const isLeader = API.hasRole("leader");
  const now = new Date();
  try {
    const [zones, reports] = await Promise.all([
      API.getSaferZones(),
      API.getZoneReports({ year: now.getFullYear(), month: now.getMonth() + 1 }),
    ]);
    _zrData = reports;
    content.innerHTML = `
      ${isLeader ? leaderBanner() : ""}
      <div style="background:var(--blue-l);border:1px solid #bfdbfe;border-radius:8px;padding:.75rem 1rem;margin-bottom:1rem;font-size:.82rem;color:var(--blue)">
        <strong>How Zone Reports Work:</strong>
        Zone Leaders create and submit reports → Collectors review → Admin approves.
      </div>
      <div class="toolbar">
        <select class="form-control" id="zr-filter-month" style="width:110px">
          ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? "selected" : ""}>${monthName(i + 1)}</option>`).join("")}
        </select>
        <input class="form-control" id="zr-filter-year" type="number" value="${now.getFullYear()}" style="width:90px">
        <select class="form-control" id="zr-filter-status" style="width:130px">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="approved">Approved</option>
        </select>
        ${!isLeader ? `<select class="form-control" id="zr-filter-zone" style="width:200px">
          <option value="">All Zones</option>
          ${zones.map(z => `<option value="${z.id}">${z.name}</option>`).join("")}
        </select>`: ""}
        <div class="toolbar-right">
          ${isLeader ? `<button class="btn btn-primary" id="btn-new-report">＋ New Report</button>` : ""}
          ${canReview ? `<button class="btn btn-purple" id="btn-pending-review">📋 Pending Review (${reports.filter(r => r.status === "submitted").length})</button>` : ""}
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table id="zr-table">
            <thead><tr>
              <th>Zone</th><th>Kebele</th><th>Period</th><th>Leader</th>
              <th>Status</th><th>Workers</th><th>Collection</th>
              <th>Reviewed By</th><th>Actions</th>
            </tr></thead>
            <tbody id="zr-tbody"></tbody>
          </table>
        </div>
        <div id="zr-pagination" class="pagination"></div>
      </div>`;

    renderZRRows(zones);
    async function reload() {
      const params = {
        month: document.getElementById("zr-filter-month").value,
        year: document.getElementById("zr-filter-year").value,
      };
      const s = document.getElementById("zr-filter-status")?.value;
      const z = document.getElementById("zr-filter-zone")?.value;
      if (s) params.status = s; if (z) params.zoneId = z;
      _zrData = await API.getZoneReports(params); _zrPage = 1; renderZRRows(zones);
    }
    ["zr-filter-month", "zr-filter-year", "zr-filter-status", "zr-filter-zone"]
      .forEach(id => document.getElementById(id)?.addEventListener("change", reload));

    if (isLeader) document.getElementById("btn-new-report")?.addEventListener("click", () => openZRModal(null, zones, zone));
    if (canReview) {
      document.getElementById("btn-pending-review")?.addEventListener("click", () => {
        document.getElementById("zr-filter-status").value = "submitted"; reload();
      });
    }
  } catch (err) {
    content.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function renderZRRows(zones) {
  const canReview = API.hasRole("admin", "collector");
  const isLeader = API.hasRole("leader");
  const { slice, pages } = paginate(_zrData, _zrPage);
  const tbody = document.getElementById("zr-tbody"); if (!tbody) return;
  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty"><div class="icon">📝</div><p>No reports found</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = slice.map(r => `
    <tr>
      <td><strong>${r.zone_name}</strong></td>
      <td>${r.kebele_name}</td>
      <td>${monthName(r.report_month)} ${r.report_year}</td>
      <td>${r.leader_name || "—"}</td>
      <td>${statusBadge(r.status)}</td>
      <td>✅${r.workers_present} ❌${r.workers_absent}</td>
      <td>${fmtETB(r.collection_total)}</td>
      <td>${r.reviewer_name || "—"}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="viewZRDetail(${r.id})">👁 View</button>
        ${isLeader && r.status === "draft" ? `<button class="btn btn-sm btn-purple" style="margin-left:.3rem" onclick="submitZR(${r.id})">📤 Submit</button>` : ""}
        ${canReview && r.status === "submitted" ? `<button class="btn btn-sm btn-success" style="margin-left:.3rem" onclick="openReviewModal(${r.id})">✅ Review</button>` : ""}
        ${canReview && r.status === "reviewed" ? `<button class="btn btn-sm btn-primary" style="margin-left:.3rem" onclick="approveZR(${r.id})">👍 Approve</button>` : ""}
        ${isLeader && r.status === "draft" ? `<button class="btn btn-sm btn-outline" style="margin-left:.3rem" onclick="openZRModal(${r.id},null,null)">✏️</button>` : ""}
      </td>
    </tr>`).join("");
  renderPagination("zr-pagination", _zrPage, pages, p => { _zrPage = p; renderZRRows(zones); });
}

function openZRModal(id, zonesArg, zoneArg) {
  const now = new Date();
  const r = id ? _zrData.find(x => x.id === id) : null;
  const zone = zoneArg || API.getZone();
  buildModal("zr-modal", id ? "Edit Report" : "New Zone Report", `
    <form id="zr-form" class="form-grid">
      ${!zone ? `<div class="form-group" style="grid-column:1/-1">
        <label>Zone *</label>
        <select class="form-control" id="zrf-zone" required>
          <option value="">Select Zone</option>
          ${(zonesArg || []).map(z => `<option value="${z.id}">${z.name} — ${z.kebele_name}</option>`).join("")}
        </select><span class="form-error"></span>
      </div>`: `<input type="hidden" id="zrf-zone" value="${zone.id}">`}
      <div class="form-group">
        <label>Report Date *</label>
        <input class="form-control" id="zrf-date" type="date" value="${r?.report_date ? r.report_date.slice(0, 10) : todayISO()}" required>
        <span class="form-error"></span>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-control" id="zrf-status">
          <option value="draft" ${(!r || r.status === "draft") ? "selected" : ""}>Draft</option>
          <option value="submitted" ${r?.status === "submitted" ? "selected" : ""}>Submit Now</option>
        </select>
      </div>
      <div class="form-group">
        <label>Workers Present</label>
        <input class="form-control" id="zrf-present" type="number" min="0" value="${r?.workers_present || 0}">
      </div>
      <div class="form-group">
        <label>Workers Absent</label>
        <input class="form-control" id="zrf-absent" type="number" min="0" value="${r?.workers_absent || 0}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Collection Total (ETB)</label>
        <input class="form-control" id="zrf-collection" type="number" min="0" step="0.01" value="${r?.collection_total || 0}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Issues Reported</label>
        <textarea class="form-control" id="zrf-issues" rows="2">${r?.issues_reported || ""}</textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Actions Taken</label>
        <textarea class="form-control" id="zrf-actions" rows="2">${r?.actions_taken || ""}</textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Tools Status</label>
        <textarea class="form-control" id="zrf-tools" rows="2" placeholder="Describe condition of tools in your zone…">${r?.tools_status || ""}</textarea>
      </div>
    </form>`,
    `<button class="btn btn-outline" onclick="closeModal('zr-modal')">Cancel</button>
     <button class="btn btn-primary" id="zr-save">💾 Save Report</button>`, true
  );
  openModal("zr-modal");
  document.getElementById("zr-save").addEventListener("click", async () => {
    if (!validateForm(document.getElementById("zr-form"))) return;
    const payload = {
      saferZoneId: document.getElementById("zrf-zone").value,
      reportDate: document.getElementById("zrf-date").value,
      status: document.getElementById("zrf-status").value,
      workersPresent: document.getElementById("zrf-present").value,
      workersAbsent: document.getElementById("zrf-absent").value,
      collectionTotal: document.getElementById("zrf-collection").value,
      issuesReported: document.getElementById("zrf-issues").value,
      actionsTaken: document.getElementById("zrf-actions").value,
      toolsStatus: document.getElementById("zrf-tools").value,
    };
    try {
      if (id) await API.updateZoneReport(id, payload);
      else await API.createZoneReport(payload);
      closeModal("zr-modal");
      toast(id ? "Report updated" : payload.status === "submitted" ? "Report submitted!" : "Report saved as draft", "success");
      _zrData = await API.getZoneReports({}); renderZRRows(null);
    } catch (err) { toast(err.message, "error"); }
  });
}

async function submitZR(id) {
  try {
    await API.updateZoneReport(id, { status: "submitted" });
    toast("Report submitted to collector!", "success");
    _zrData = await API.getZoneReports({}); renderZRRows(null);
  } catch (err) { toast(err.message, "error"); }
}

async function approveZR(id) {
  try {
    await API.reviewZoneReport(id, { status: "approved", reviewerNotes: "Approved" });
    toast("Report approved!", "success");
    _zrData = await API.getZoneReports({}); renderZRRows(null);
  } catch (err) { toast(err.message, "error"); }
}

function openReviewModal(id) {
  const r = _zrData.find(x => x.id === id);
  buildModal("review-modal", `Review Report — ${r?.zone_name}`, `
    <div style="margin-bottom:1rem;background:var(--gray-50);padding:1rem;border-radius:8px;font-size:.85rem">
      <div><strong>Zone:</strong> ${r?.zone_name} | <strong>Kebele:</strong> ${r?.kebele_name}</div>
      <div><strong>Period:</strong> ${monthName(r?.report_month)} ${r?.report_year}</div>
      <div><strong>Collection:</strong> ${fmtETB(r?.collection_total)}</div>
      <div><strong>Workers Present:</strong> ${r?.workers_present} | <strong>Absent:</strong> ${r?.workers_absent}</div>
      ${r?.issues_reported ? `<div style="margin-top:.5rem"><strong>Issues:</strong> ${r.issues_reported}</div>` : ""}
      ${r?.actions_taken ? `<div><strong>Actions:</strong> ${r.actions_taken}</div>` : ""}
      ${r?.tools_status ? `<div><strong>Tools:</strong> ${r.tools_status}</div>` : ""}
    </div>
    <div class="form-group">
      <label>Review Notes</label>
      <textarea class="form-control" id="rv-notes" rows="3" placeholder="Add your feedback…"></textarea>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('review-modal')">Cancel</button>
     <button class="btn btn-orange btn-outline" id="rv-review" style="border-color:var(--orange);color:var(--orange)">Mark Reviewed</button>
     <button class="btn btn-success" id="rv-approve">✅ Approve</button>`
  );
  openModal("review-modal");
  document.getElementById("rv-review").addEventListener("click", async () => {
    const notes = document.getElementById("rv-notes").value;
    try {
      await API.reviewZoneReport(id, { status: "reviewed", reviewerNotes: notes });
      closeModal("review-modal"); toast("Marked as reviewed", "success");
      _zrData = await API.getZoneReports({}); renderZRRows(null);
    } catch (err) { toast(err.message, "error"); }
  });
  document.getElementById("rv-approve").addEventListener("click", async () => {
    const notes = document.getElementById("rv-notes").value;
    try {
      await API.reviewZoneReport(id, { status: "approved", reviewerNotes: notes || "Approved" });
      closeModal("review-modal"); toast("Report approved!", "success");
      _zrData = await API.getZoneReports({}); renderZRRows(null);
    } catch (err) { toast(err.message, "error"); }
  });
}

async function viewZRDetail(id) {
  const r = await API.getZoneReport(id).catch(() => _zrData.find(x => x.id === id));
  buildModal("zr-detail-modal", `Zone Report — ${r?.zone_name}`, `
    <div style="font-size:.875rem">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem">
        <div><span style="color:var(--gray-500)">Zone:</span> <strong>${r?.zone_name}</strong></div>
        <div><span style="color:var(--gray-500)">Kebele:</span> <strong>${r?.kebele_name}</strong></div>
        <div><span style="color:var(--gray-500)">Period:</span> ${monthName(r?.report_month)} ${r?.report_year}</div>
        <div><span style="color:var(--gray-500)">Status:</span> ${statusBadge(r?.status)}</div>
        <div><span style="color:var(--gray-500)">Leader:</span> ${r?.leader_name}</div>
        <div><span style="color:var(--gray-500)">Collection:</span> <strong style="color:var(--green)">${fmtETB(r?.collection_total)}</strong></div>
        <div><span style="color:var(--gray-500)">Present:</span> ✅ ${r?.workers_present}</div>
        <div><span style="color:var(--gray-500)">Absent:</span> ❌ ${r?.workers_absent}</div>
      </div>
      ${r?.issues_reported ? `<div style="margin-bottom:.75rem"><strong>Issues Reported:</strong><p style="color:var(--red)">${r.issues_reported}</p></div>` : ""}
      ${r?.actions_taken ? `<div style="margin-bottom:.75rem"><strong>Actions Taken:</strong><p>${r.actions_taken}</p></div>` : ""}
      ${r?.tools_status ? `<div style="margin-bottom:.75rem"><strong>Tools Status:</strong><p>${r.tools_status}</p></div>` : ""}
      ${r?.reviewer_name ? `<div style="background:var(--green-l);padding:.75rem;border-radius:6px">
        <strong>Reviewed by ${r.reviewer_name}</strong> on ${fmtDate(r.reviewed_at)}<br>
        ${r.reviewer_notes || ""}
      </div>`: ""}
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('zr-detail-modal')">Close</button>`, true
  );
  openModal("zr-detail-modal");
}
