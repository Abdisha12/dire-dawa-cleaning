// frontend/js/pages/reports.js — Reports & Export Management Page

async function renderReports() {
  const content = document.getElementById("page-content");
  const now = new Date();

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <div style="font-size:1.1rem;font-weight:700">📋 Export & Monthly Reports</div>
      <button class="btn btn-outline" onclick="window.print()">🖨️ Print Page</button>
    </div>

    <!-- Monthly Consolidated Summary Banner -->
    <div class="card" style="margin-bottom:1.25rem;background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #bfdbfe">
      <div class="card-title" style="border-bottom:none;margin-bottom:.5rem">
        <span>📦 Consolidated Monthly Summary Package</span>
        <span class="badge badge-purple">All-in-One Report</span>
      </div>
      <p style="font-size:.85rem;color:var(--gray-700);margin-bottom:.85rem">
        Download a single multi-sheet report combining Revenue Payments, Worker Payroll, and Zone Inspections for any month.
      </p>
      <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
        <div class="form-group" style="margin:0"><label style="font-size:.75rem">Month</label>
          <select class="form-control" id="ms-month" style="padding:.35rem .6rem">
            ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? "selected" : ""}>${monthName(i + 1)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="margin:0"><label style="font-size:.75rem">Year</label>
          <input class="form-control" id="ms-year" type="number" value="${now.getFullYear()}" style="width:90px;padding:.35rem .6rem">
        </div>
        <button class="btn btn-primary" id="btn-export-summary-xlsx" style="margin-top:auto">📊 Download Complete Package (.xlsx)</button>
      </div>
    </div>

    <div style="display:grid;gap:1.25rem;grid-template-columns:1fr 1fr;margin-bottom:1.25rem">
      <!-- Payments Report -->
      <div class="card">
        <div class="card-title">💳 Business Payment Report</div>
        <div class="form-grid" style="margin-bottom:.75rem">
          <div class="form-group"><label>Month</label>
            <select class="form-control" id="rp-month">
              ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? "selected" : ""}>${monthName(i + 1)}</option>`).join("")}
            </select></div>
          <div class="form-group"><label>Year</label>
            <input class="form-control" id="rp-year" type="number" value="${now.getFullYear()}"></div>
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn btn-primary" id="btn-load-pay-report">📊 Load</button>
          <button class="btn btn-outline" id="btn-export-pay-csv">⬇ CSV</button>
          <button class="btn btn-outline" id="btn-export-pay-xlsx">📗 Excel</button>
          <button class="btn btn-outline" id="btn-export-pay-pdf">📄 PDF</button>
        </div>
        <div id="pay-report-result" style="margin-top:1rem"></div>
      </div>

      <!-- Yearly Summary -->
      <div class="card">
        <div class="card-title">📅 Yearly Revenue Trend</div>
        <div class="form-grid" style="margin-bottom:.75rem">
          <div class="form-group"><label>Year</label>
            <input class="form-control" id="ry-year" type="number" value="${now.getFullYear()}"></div>
        </div>
        <button class="btn btn-primary" id="btn-load-yearly">📊 Load Trend</button>
        <div id="yearly-result" style="margin-top:1rem"></div>
      </div>

      <!-- Worker Payroll Report -->
      <div class="card">
        <div class="card-title">👷 Worker Payroll Report</div>
        <div class="form-grid" style="margin-bottom:.75rem">
          <div class="form-group"><label>Month</label>
            <select class="form-control" id="rw-month">
              ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? "selected" : ""}>${monthName(i + 1)}</option>`).join("")}
            </select></div>
          <div class="form-group"><label>Year</label>
            <input class="form-control" id="rw-year" type="number" value="${now.getFullYear()}"></div>
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn btn-primary" id="btn-load-worker-report">📊 Load</button>
          <button class="btn btn-outline" id="btn-export-worker-csv">⬇ CSV</button>
          <button class="btn btn-outline" id="btn-export-worker-xlsx">📗 Excel</button>
          <button class="btn btn-outline" id="btn-export-worker-pdf">📄 PDF</button>
        </div>
        <div id="worker-report-result" style="margin-top:1rem"></div>
      </div>

      <!-- Inspection Report -->
      <div class="card">
        <div class="card-title">🔍 Inspection Report</div>
        <div class="form-grid" style="margin-bottom:.75rem">
          <div class="form-group"><label>From</label>
            <input class="form-control" id="ri-from" type="date" value="${new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)}"></div>
          <div class="form-group"><label>To</label>
            <input class="form-control" id="ri-to" type="date" value="${todayISO()}"></div>
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn btn-primary" id="btn-load-insp-report">📊 Load</button>
          <button class="btn btn-outline" id="btn-export-insp-csv">⬇ CSV</button>
          <button class="btn btn-outline" id="btn-export-insp-xlsx">📗 Excel</button>
          <button class="btn btn-outline" id="btn-export-insp-pdf">📄 PDF</button>
        </div>
        <div id="insp-report-result" style="margin-top:1rem"></div>
      </div>
    </div>

    <!-- Chart -->
    <div class="card">
      <div class="card-title">📈 Annual Revenue Collection Visualizer</div>
      <div class="chart-wrap"><canvas id="report-chart"></canvas></div>
    </div>
  `;

  // Consolidated Package Button
  document.getElementById("btn-export-summary-xlsx").addEventListener("click", () => {
    const m = document.getElementById("ms-month").value;
    const y = document.getElementById("ms-year").value;
    downloadCSV(API.xlsxUrl("/reports/monthly-summary", { month: m, year: y }));
  });

  // Payments Report Listeners
  document.getElementById("btn-load-pay-report").addEventListener("click", async () => {
    const m = document.getElementById("rp-month").value, y = document.getElementById("rp-year").value;
    const el = document.getElementById("pay-report-result"); el.innerHTML = spinnerHTML;
    try {
      const data = await API.getPaymentReport({ month: m, year: y });
      const total = data.filter(r => r.status === "paid").reduce((s, r) => s + parseFloat(r.amount), 0);
      el.innerHTML = `
        <div style="margin-bottom:.5rem;font-size:.85rem;color:var(--gray-500)">
          ${data.length} records — <strong style="color:var(--green)">${fmtETB(total)} collected</strong>
        </div>
        <div class="table-wrap" style="max-height:280px;overflow-y:auto">
          <table><thead><tr><th>Business</th><th>Zone</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>${data.map(r => `<tr>
              <td>${r.business}</td><td>${r.zone || "—"}</td>
              <td>${fmtETB(r.amount)}</td>
              <td><span class="badge badge-gray">${r.method}</span></td>
              <td>${statusBadge(r.status)}</td>
            </tr>`).join("") || "<tr><td colspan=\"5\" class=\"empty\">No data</td></tr>"}</tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = `<p style="color:var(--red)">${err.message}</p>`; }
  });

  document.getElementById("btn-export-pay-csv").addEventListener("click", () => {
    downloadCSV(API.csvUrl("/reports/payments/monthly", { month: document.getElementById("rp-month").value, year: document.getElementById("rp-year").value }));
  });
  document.getElementById("btn-export-pay-xlsx").addEventListener("click", () => {
    downloadCSV(API.xlsxUrl("/reports/payments/monthly", { month: document.getElementById("rp-month").value, year: document.getElementById("rp-year").value }));
  });
  document.getElementById("btn-export-pay-pdf").addEventListener("click", () => {
    downloadCSV(API.pdfUrl("/reports/payments/monthly", { month: document.getElementById("rp-month").value, year: document.getElementById("rp-year").value }));
  });

  // Yearly Summary
  async function loadYearly() {
    const y = document.getElementById("ry-year").value;
    const el = document.getElementById("yearly-result"); el.innerHTML = spinnerHTML;
    try {
      const data = await API.getYearlyReport({ year: y });
      const total = data.reduce((s, r) => s + parseFloat(r.collected || 0), 0);
      el.innerHTML = `
        <div style="margin-bottom:.5rem;font-size:.85rem"><strong style="color:var(--green)">${fmtETB(total)}</strong> total collected in ${y}</div>
        <div class="table-wrap">
          <table><thead><tr><th>Month</th><th>Collected</th><th>Pending</th><th>Overdue</th></tr></thead>
            <tbody>${data.map(r => `<tr>
              <td>${monthName(r.month)}</td>
              <td style="color:var(--green)">${fmtETB(r.collected)}</td>
              <td style="color:var(--orange)">${fmtETB(r.pending)}</td>
              <td style="color:var(--red)">${fmtETB(r.overdue)}</td>
            </tr>`).join("") || "<tr><td colspan=\"4\" class=\"empty\">No data</td></tr>"}</tbody>
          </table>
        </div>`;
      if (window.Chart) {
        const ctx = document.getElementById("report-chart")?.getContext("2d");
        if (ctx) {
          if (window._reportChart) window._reportChart.destroy();
          window._reportChart = new Chart(ctx, {
            type: "bar",
            data: {
              labels: data.map(r => monthName(r.month)),
              datasets: [
                { label: "Collected", data: data.map(r => parseFloat(r.collected || 0)), backgroundColor: "#16a34a", borderRadius: 4 },
                { label: "Pending", data: data.map(r => parseFloat(r.pending || 0)), backgroundColor: "#ea580c", borderRadius: 4 },
                { label: "Overdue", data: data.map(r => parseFloat(r.overdue || 0)), backgroundColor: "#dc2626", borderRadius: 4 },
              ]
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              scales: { y: { beginAtZero: true, ticks: { callback: v => "ETB " + (v / 1000).toFixed(0) + "k" } } },
              plugins: { legend: { position: "top" } }
            }
          });
        }
      }
    } catch (err) { el.innerHTML = `<p style="color:var(--red)">${err.message}</p>`; }
  }
  document.getElementById("btn-load-yearly").addEventListener("click", loadYearly);
  loadYearly();

  // Worker Payroll
  document.getElementById("btn-load-worker-report").addEventListener("click", async () => {
    const m = document.getElementById("rw-month").value, y = document.getElementById("rw-year").value;
    const el = document.getElementById("worker-report-result"); el.innerHTML = spinnerHTML;
    try {
      const data = await API.getWorkerReport({ month: m, year: y });
      const totalGross = data.reduce((s, r) => s + parseFloat(r.gross || 0), 0);
      el.innerHTML = `
        <div style="margin-bottom:.5rem;font-size:.85rem">Total payroll: <strong style="color:var(--blue)">${fmtETB(totalGross)}</strong></div>
        <div class="table-wrap" style="max-height:280px;overflow-y:auto">
          <table><thead><tr><th>Worker</th><th>Zone</th><th>Present</th><th>Absent</th><th>Bonus</th><th>Gross</th></tr></thead>
            <tbody>${data.map(r => `<tr>
              <td>${r.full_name}</td><td>${r.zone || "—"}</td>
              <td><span class="badge badge-green">${r.days_present}</span></td>
              <td><span class="badge badge-red">${r.days_absent}</span></td>
              <td>${fmtETB(r.total_bonus)}</td><td><strong>${fmtETB(r.gross)}</strong></td>
            </tr>`).join("") || "<tr><td colspan=\"6\" class=\"empty\">No data</td></tr>"}</tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = `<p style="color:var(--red)">${err.message}</p>`; }
  });

  document.getElementById("btn-export-worker-csv").addEventListener("click", () => {
    downloadCSV(API.csvUrl("/reports/workers/monthly", { month: document.getElementById("rw-month").value, year: document.getElementById("rw-year").value }));
  });
  document.getElementById("btn-export-worker-xlsx").addEventListener("click", () => {
    downloadCSV(API.xlsxUrl("/reports/workers/monthly", { month: document.getElementById("rw-month").value, year: document.getElementById("rw-year").value }));
  });
  document.getElementById("btn-export-worker-pdf").addEventListener("click", () => {
    downloadCSV(API.pdfUrl("/reports/workers/monthly", { month: document.getElementById("rw-month").value, year: document.getElementById("rw-year").value }));
  });

  // Inspection Report
  document.getElementById("btn-load-insp-report").addEventListener("click", async () => {
    const el = document.getElementById("insp-report-result"); el.innerHTML = spinnerHTML;
    try {
      const data = await API.getInspectionReport({
        from: document.getElementById("ri-from").value, to: document.getElementById("ri-to").value
      });
      const danger = data.filter(r => r.status === "danger").length;
      const warning = data.filter(r => r.status === "warning").length;
      el.innerHTML = `
        <div style="margin-bottom:.5rem;font-size:.85rem">
          ${data.length} inspections — <span style="color:var(--red)">${danger} danger</span>, <span style="color:var(--orange)">${warning} warning</span>
        </div>
        <div class="table-wrap" style="max-height:280px;overflow-y:auto">
          <table><thead><tr><th>Date</th><th>Kebele</th><th>Zone</th><th>Status</th><th>Inspector</th><th>Photos</th></tr></thead>
            <tbody>${data.map(r => `<tr>
              <td>${fmtDate(r.date)}</td><td>${r.kebele}</td><td>${r.zone || "—"}</td>
              <td>${statusBadge(r.status)}</td><td>${r.inspector}</td><td>${r.photo_count}</td>
            </tr>`).join("") || "<tr><td colspan=\"6\" class=\"empty\">No data</td></tr>"}</tbody>
          </table>
        </div>`;
    } catch (err) { el.innerHTML = `<p style="color:var(--red)">${err.message}</p>`; }
  });

  document.getElementById("btn-export-insp-csv").addEventListener("click", () => {
    downloadCSV(API.csvUrl("/reports/inspections", { from: document.getElementById("ri-from").value, to: document.getElementById("ri-to").value }));
  });
  document.getElementById("btn-export-insp-xlsx").addEventListener("click", () => {
    downloadCSV(API.xlsxUrl("/reports/inspections", { from: document.getElementById("ri-from").value, to: document.getElementById("ri-to").value }));
  });
  document.getElementById("btn-export-insp-pdf").addEventListener("click", () => {
    downloadCSV(API.pdfUrl("/reports/inspections", { from: document.getElementById("ri-from").value, to: document.getElementById("ri-to").value }));
  });
}
