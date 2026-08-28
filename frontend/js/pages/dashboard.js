// frontend/js/pages/dashboard.js — Enhanced Analytics Dashboard

async function renderDashboard() {
  const content = document.getElementById("page-content");
  content.innerHTML = spinnerHTML;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const role = API.getUser()?.role;

  try {
    const [summary, attAnalytics, payAnalytics, inspAnalytics, leaderboard] = await Promise.all([
      API.getDashboardSummary({ year, month }).catch(() => ({})),
      API.getAttendanceAnalytics({ year, month }).catch(() => ({ summary: {}, byZone: [] })),
      API.getPaymentAnalytics({ year, month }).catch(() => ({ byMethod: [], byStatus: [] })),
      API.getInspectionAnalytics({}).catch(() => ({ statusDist: [], byZone: [] })),
      API.getZoneLeaderboard({ year, month }).catch(() => ([]))
    ]);

    const t = summary.totals || {};
    const byK = summary.byKebele || [];
    const monthly = summary.monthly || [];
    const monthlyMap = {}; monthly.forEach(r => { monthlyMap[r.month] = r.collected; });
    const chartData = Array.from({ length: 12 }, (_, i) => monthlyMap[i + 1] || 0);

    const totalTarget = byK.reduce((s, r) => s + (parseFloat(r.target) || 0), 0);
    const pct = totalTarget ? Math.round((parseFloat(t.total_collected || 0) / totalTarget) * 100) : 0;
    const pctColor = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--orange)" : "var(--red)";

    const attRate = attAnalytics.summary?.attendanceRate || 0;
    const attColor = attRate >= 85 ? "var(--green)" : attRate >= 70 ? "var(--orange)" : "var(--red)";

    content.innerHTML = `
      ${role === "leader" ? leaderBanner() : ""}
      
      <!-- Hierarchy chain -->
      <div class="hierarchy-chain">
        <span class="node">🔴 Admin</span><span class="arrow">→</span>
        <span class="node">🔵 Collector</span><span class="arrow">→</span>
        <span class="node">🟣 Zone Leader</span><span class="arrow">→</span>
        <span class="node">👷 Workers</span>
      </div>

      <!-- Top Summary Grid -->
      <div class="stats-grid">
        <div class="stat-card stat-green">
          <div class="stat-label">Collected — ${monthName(month)} ${year}</div>
          <div class="stat-value" style="color:var(--green)">${fmtETB(t.total_collected)}</div>
          <div class="stat-sub">${pct}% of target</div>
        </div>
        <div class="stat-card stat-orange">
          <div class="stat-label">Pending</div>
          <div class="stat-value" style="color:var(--orange)">${fmtETB(t.total_pending)}</div>
          <div class="stat-sub">Awaiting collection</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">Overdue</div>
          <div class="stat-value" style="color:var(--red)">${fmtETB(t.total_overdue)}</div>
          <div class="stat-sub">Requires follow-up</div>
        </div>
        <div class="stat-card stat-blue">
          <div class="stat-label">Worker Attendance</div>
          <div class="stat-value" style="color:${attColor}">${attRate}%</div>
          <div class="stat-sub">${attAnalytics.summary?.presentCount || 0} present days</div>
        </div>
      </div>

      <!-- Overall Collection Progress -->
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-title">📈 Monthly Revenue Target Progress — ${monthName(month)} ${year}</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.5rem">
          <div style="flex:1;background:var(--gray-100);border-radius:999px;height:18px;overflow:hidden">
            <div style="width:${Math.min(pct, 100)}%;height:100%;background:${pctColor};border-radius:999px;transition:width .6s ease"></div>
          </div>
          <span style="font-weight:700;min-width:45px;text-align:right">${pct}%</span>
        </div>
        <div style="font-size:.8rem;color:var(--gray-500)">${fmtETB(t.total_collected)} of ${fmtETB(totalTarget)} target across ${byK.length} Kebeles</div>
      </div>

      <!-- Analytics Row 1: Collection & Attendance Charts -->
      <div style="display:grid;gap:1.25rem;grid-template-columns:1.5fr 1fr;margin-bottom:1.25rem">
        <div class="card">
          <div class="card-title">📊 Monthly Revenue Collections — ${year}</div>
          <div class="chart-wrap"><canvas id="chart-monthly-rev"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">🍩 Payment Method Distribution</div>
          <div class="chart-wrap"><canvas id="chart-pay-methods"></canvas></div>
        </div>
      </div>

      <!-- Analytics Row 2: Cleanliness Status & Zone Leaderboard -->
      <div style="display:grid;gap:1.25rem;grid-template-columns:1fr 1.5fr;margin-bottom:1.25rem">
        <div class="card">
          <div class="card-title">🧹 Cleanliness & Inspection Status</div>
          <div class="chart-wrap"><canvas id="chart-insp-dist"></canvas></div>
        </div>

        <div class="card">
          <div class="card-title">
            <span>🏆 Zone Performance Leaderboard</span>
            <span style="font-size:.72rem;font-weight:400;color:var(--gray-500)">Composite Score (60% Revenue + 40% Attendance)</span>
          </div>
          <div class="table-wrap" style="max-height:280px;overflow-y:auto">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Zone</th>
                  <th>Kebele</th>
                  <th>Revenue %</th>
                  <th>Attendance %</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                ${leaderboard.slice(0, 10).map((z, idx) => {
                  const rankIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                  const scoreCls = z.compositeScore >= 80 ? "badge-green" : z.compositeScore >= 50 ? "badge-orange" : "badge-red";
                  return `
                    <tr>
                      <td style="font-weight:700">${rankIcon}</td>
                      <td><strong>${escapeHtml(z.zone_name)}</strong></td>
                      <td>${escapeHtml(z.kebele_name)}</td>
                      <td>${z.collection_rate || 0}%</td>
                      <td>${z.attendance_rate || 0}%</td>
                      <td><span class="badge ${scoreCls}">${z.compositeScore} / 100</span></td>
                    </tr>
                  `;
                }).join("") || `<tr><td colspan="6" class="empty">No zone metrics available yet</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Kebele Collection Breakdown Table -->
      <div class="card">
        <div class="card-title">🏘 Performance by Kebele</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Kebele</th><th>Code</th><th>Target</th><th>Collected</th><th>Achievement</th></tr></thead>
            <tbody>
              ${byK.map(r => {
                const p = r.target ? Math.round((r.collected / r.target) * 100) : 0;
                const cls = p >= 80 ? "badge-green" : p >= 50 ? "badge-orange" : "badge-red";
                return `<tr>
                  <td><strong>${escapeHtml(r.kebele)}</strong></td>
                  <td><code>${escapeHtml(r.code)}</code></td>
                  <td>${fmtETB(r.target)}</td>
                  <td style="color:var(--green);font-weight:600">${fmtETB(r.collected)}</td>
                  <td><span class="badge ${cls}">${p}%</span></td>
                </tr>`;
              }).join("") || "<tr><td colspan=\"5\" class=\"empty\">No data yet</td></tr>"}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Render Charts if Chart.js is loaded
    if (window.Chart) {
      // 1. Monthly Revenue Bar Chart
      const ctxRev = document.getElementById("chart-monthly-rev")?.getContext("2d");
      if (ctxRev) {
        new Chart(ctxRev, {
          type: "bar",
          data: {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            datasets: [{
              label: "Collected (ETB)",
              data: chartData,
              backgroundColor: chartData.map((_, i) => i + 1 === month ? "#1d4ed8" : "#93c5fd"),
              borderRadius: 6
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => "ETB " + (v / 1000).toFixed(0) + "k" } } }
          }
        });
      }

      // 2. Payment Method Distribution Doughnut Chart
      const ctxPay = document.getElementById("chart-pay-methods")?.getContext("2d");
      if (ctxPay) {
        const methods = payAnalytics.byMethod || [];
        const labels = methods.length ? methods.map(m => m.method.toUpperCase()) : ["Cash", "Mobile / Telebirr", "Bank"];
        const dataVals = methods.length ? methods.map(m => parseFloat(m.total || 0)) : [0, 0, 0];

        new Chart(ctxPay, {
          type: "doughnut",
          data: {
            labels,
            datasets: [{
              data: dataVals,
              backgroundColor: ["#16a34a", "#2563eb", "#7c3aed", "#ea580c", "#6b7280"]
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } }
          }
        });
      }

      // 3. Inspection Status Doughnut Chart
      const ctxInsp = document.getElementById("chart-insp-dist")?.getContext("2d");
      if (ctxInsp) {
        const dist = inspAnalytics.statusDist || [];
        const activeCount = dist.find(d => d.status === "active")?.count || 0;
        const warnCount = dist.find(d => d.status === "warning")?.count || 0;
        const dangCount = dist.find(d => d.status === "danger")?.count || 0;

        new Chart(ctxInsp, {
          type: "pie",
          data: {
            labels: ["Active / Clean", "Warning", "Danger / Poor"],
            datasets: [{
              data: [activeCount, warnCount, dangCount],
              backgroundColor: ["#16a34a", "#ea580c", "#dc2626"]
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } }
          }
        });
      }
    }
  } catch (err) {
    content.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}
