let _payData=[],_payPage=1;

async function renderPayments(){
  const content=document.getElementById("page-content");
  content.innerHTML=spinnerHTML;
  const role=API.getUser()?.role;
  try{
    const [kebeles,payments]=await Promise.all([
      API.getKebeles(),
      API.getPayments({year:new Date().getFullYear(),month:new Date().getMonth()+1}),
    ]);
    _payData=payments;
    const isAdmin=API.hasRole("admin","collector"),canEdit=API.hasRole("admin","collector","leader");
    const now=new Date();
    content.innerHTML=`
      ${role==="leader"?leaderBanner():""}
      <div class="toolbar">
        ${role!=="leader"?`<select class="form-control" id="pay-filter-kebele" style="width:150px">
          <option value="">All Kebeles</option>
          ${kebeles.map(k=>`<option value="${k.id}">${escapeHtml(k.name)}</option>`).join("")}
        </select>`:""}
        <select class="form-control" id="pay-filter-month" style="width:105px">
          ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?"selected":""}>${monthName(i+1)}</option>`).join("")}
        </select>
        <input class="form-control" id="pay-filter-year" type="number" value="${now.getFullYear()}" style="width:85px">
        <select class="form-control" id="pay-filter-status" style="width:115px">
          <option value="">All Status</option>
          <option value="paid">Paid</option><option value="pending">Pending</option><option value="overdue">Overdue</option>
        </select>
        <input class="search-input" id="pay-search" placeholder="🔍 Search…">
        <div class="toolbar-right">
          <button class="btn btn-outline" id="btn-export-csv">⬇ CSV</button>
          ${canEdit?`<button class="btn btn-primary" id="btn-add-pay">＋ Record Payment</button>`:""}
        </div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1rem" id="pay-summary"></div>
      <div class="card">
        <div class="table-wrap">
          <table id="pay-table">
            <thead><tr>
              <th>Receipt</th><th>Business</th><th>Zone</th><th>Kebele</th>
              <th>Amount</th><th>Method</th><th>Status</th><th>Period</th><th>Paid At</th><th>Collector</th>
              ${isAdmin?"<th>Actions</th>":""}
            </tr></thead>
            <tbody id="pay-tbody"></tbody>
          </table>
        </div>
        <div id="pay-pagination" class="pagination"></div>
      </div>`;
    renderPayRows();updatePaySummary();
    document.getElementById("pay-search")?.addEventListener("input",e=>filterTable("pay-table",e.target.value));
    async function reload(){
      const params={};
      const k=document.getElementById("pay-filter-kebele")?.value;
      const m=document.getElementById("pay-filter-month").value;
      const y=document.getElementById("pay-filter-year").value;
      const s=document.getElementById("pay-filter-status").value;
      if(k) params.kebeleId=k;if(m) params.month=m;if(y) params.year=y;if(s) params.status=s;
      _payData=await API.getPayments(params);_payPage=1;renderPayRows();updatePaySummary();
    }
    ["pay-filter-kebele","pay-filter-month","pay-filter-year","pay-filter-status"]
      .forEach(id=>document.getElementById(id)?.addEventListener("change",reload));
    document.getElementById("btn-export-csv")?.addEventListener("click",()=>{
      downloadCSV(API.csvUrl("/reports/payments/monthly",{
        month:document.getElementById("pay-filter-month").value,
        year:document.getElementById("pay-filter-year").value,
      }));
    });
    if(canEdit){
      document.getElementById("btn-add-pay")?.addEventListener("click",async()=>{
        const businesses=await API.getBusinesses();openPaymentModal(null,businesses);
      });
    }
  }catch(err){
    content.innerHTML=`<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function updatePaySummary(){
  const el=document.getElementById("pay-summary");if(!el)return;
  const collected=_payData.filter(p=>p.status==="paid").reduce((s,p)=>s+parseFloat(p.amount),0);
  const pending=_payData.filter(p=>p.status==="pending").reduce((s,p)=>s+parseFloat(p.amount),0);
  const overdue=_payData.filter(p=>p.status==="overdue").reduce((s,p)=>s+parseFloat(p.amount),0);
  el.innerHTML=`
    <div class="stat-card stat-green"><div class="stat-label">Collected</div><div class="stat-value" style="font-size:1.3rem">${fmtETB(collected)}</div></div>
    <div class="stat-card stat-orange"><div class="stat-label">Pending</div><div class="stat-value" style="font-size:1.3rem">${fmtETB(pending)}</div></div>
    <div class="stat-card stat-red"><div class="stat-label">Overdue</div><div class="stat-value" style="font-size:1.3rem">${fmtETB(overdue)}</div></div>`;
}

function renderPayRows(){
  const isAdmin=API.hasRole("admin","collector");
  const {slice,pages}=paginate(_payData,_payPage);
  const tbody=document.getElementById("pay-tbody");if(!tbody)return;
  if(!slice.length){tbody.innerHTML=`<tr><td colspan="11"><div class="empty"><div class="icon">💳</div><p>No payments found</p></div></td></tr>`;return;}
  tbody.innerHTML=slice.map(p=>`
    <tr>
      <td><code style="font-size:.72rem;background:var(--gray-100);padding:.2rem .4rem;border-radius:4px">${escapeHtml(p.receipt_number||"—")}</code></td>
      <td>${escapeHtml(p.business_name)}</td><td>${escapeHtml(p.safer_zone_name||"—")}</td><td>${escapeHtml(p.kebele_name)}</td>
      <td><strong>${fmtETB(p.amount)}</strong></td>
      <td><span class="badge badge-gray">${escapeHtml(p.method)}</span></td>
      <td>${statusBadge(p.status)}</td>
      <td>${monthName(p.month)} ${p.year}</td>
      <td>${p.paid_at?fmtDate(p.paid_at):"—"}</td>
      <td>${escapeHtml(p.collector_name||"—")}</td>
      ${isAdmin?`<td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="viewReceipt(${escapeJsStr(JSON.stringify(p))})">🧾</button>
        <button class="btn btn-sm btn-danger" style="margin-left:.3rem" onclick="deletePay(${p.id})">🗑</button>
      </td>`:""}
    </tr>`).join("");
  renderPagination("pay-pagination",_payPage,pages,pg=>{_payPage=pg;renderPayRows();});
}

async function openPaymentModal(id,businesses){
  const now=new Date();
  buildModal("pay-modal","Record Payment",`
    <form id="pay-form" class="form-grid">
      <div class="form-group" style="grid-column:1/-1"><label>Business *</label>
        <select class="form-control" id="pay-business" required>
          <option value="">Select business…</option>
          ${businesses.map(b=>`<option value="${b.id}" data-target="${b.monthly_target}">${escapeHtml(b.name)} — ${escapeHtml(b.safer_zone_name||"")} (${escapeHtml(b.kebele_name)})</option>`).join("")}
        </select><span class="form-error"></span></div>
      <div class="form-group"><label>Amount (ETB) *</label>
        <input class="form-control" id="pay-amount" type="number" min="0" step="0.01" required>
        <span class="form-error"></span></div>
      <div class="form-group"><label>Method</label>
        <select class="form-control" id="pay-method">
          <option value="cash">Cash</option>
          <option value="mobile">Mobile Money</option>
          <option value="bank">Bank Transfer</option>
          <option value="telebirr">Telebirr (Fabric API)</option>
          <option value="cbebirr">CBE Birr (Merchant Checkout)</option>
          <option value="other">Other</option>
        </select></div>
      <div class="form-group"><label>Month *</label>
        <select class="form-control" id="pay-month" required>
          ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?"selected":""}>${monthName(i+1)}</option>`).join("")}
        </select></div>
      <div class="form-group"><label>Year *</label>
        <input class="form-control" id="pay-year" type="number" value="${now.getFullYear()}" required></div>
      <div class="form-group" style="grid-column:1/-1"><label>Notes</label>
        <textarea class="form-control" id="pay-notes" rows="2"></textarea></div>
    </form>`,
    `<button class="btn btn-outline" onclick="closeModal('pay-modal')">Cancel</button>
     <button class="btn btn-success" id="pay-save">✅ Record Payment</button>`
  );
  openModal("pay-modal");
  document.getElementById("pay-business")?.addEventListener("change",e=>{
    const opt=e.target.options[e.target.selectedIndex];
    document.getElementById("pay-amount").value=opt.dataset.target||"";
  });
  document.getElementById("pay-save").addEventListener("click",async()=>{
    if(!validateForm(document.getElementById("pay-form"))) return;
    const businessSelect = document.getElementById("pay-business");
    const businessName = businessSelect.options[businessSelect.selectedIndex].text.split('—')[0].trim();
    const amount = document.getElementById("pay-amount").value;
    try{
      const res=await API.createPayment({
        businessId:businessSelect.value,
        amount:amount,
        method:document.getElementById("pay-method").value,
        month:document.getElementById("pay-month").value,
        year:document.getElementById("pay-year").value,
        notes:document.getElementById("pay-notes").value,
      });
      closeModal("pay-modal");
      if (res.status === "pending" && res.paymentUrl) {
        openGatewayCheckoutModal(res, businessName, amount);
      } else {
        toast(`Payment recorded! Receipt: ${res.receiptNumber}`,"success");
        _payData=await API.getPayments({year:new Date().getFullYear(),month:new Date().getMonth()+1});
        renderPayRows();updatePaySummary();
      }
    }catch(err){toast(err.message,"error");}
  });
}

let _pollInterval = null;

function openGatewayCheckoutModal(res, businessName, amount) {
  if (_pollInterval) clearInterval(_pollInterval);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(res.paymentUrl)}`;
  const title = res.gatewayName === "telebirr" ? "Telebirr Gateway" : "CBE Birr Gateway";
  const brandColor = res.gatewayName === "telebirr" ? "#d9383a" : "#1a5fb4";

  buildModal("gateway-modal", title, `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;color:var(--gray-900)">${escapeHtml(businessName)}</div>
      <div style="font-size:1.5rem;color:var(--green);font-weight:700;margin-bottom:1rem">${fmtETB(amount)}</div>
      
      <div style="background:#f9fafb;border:1px solid var(--gray-200);border-radius:12px;padding:1rem;display:inline-block;margin-bottom:1rem">
        <img src="${escapeAttr(qrUrl)}" alt="Scan to Pay" style="width:180px;height:180px;display:block;margin:0 auto">
        <div style="font-size:0.75rem;color:var(--gray-500);margin-top:0.5rem">Scan QR code with your mobile wallet app</div>
      </div>
      
      <div style="margin-bottom:1rem">
        <a href="${escapeAttr(res.paymentUrl)}" target="_blank" rel="noopener noreferrer" class="btn" style="background:${brandColor};color:white;display:inline-flex;text-decoration:none;justify-content:center;width:210px;margin:0 auto">
          🔗 Open Sandbox Portal
        </a>
      </div>

      <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;margin-top:0.5rem">
        <div class="spinner" id="gateway-spinner" style="width:16px;height:16px;border-width:2px;border-top-color:${brandColor}"></div>
        <span id="gateway-status-msg" style="font-size:0.85rem;color:var(--gray-500)">Waiting for gateway confirmation...</span>
      </div>
    </div>
  `, `
    <button class="btn btn-outline" id="btn-cancel-gateway">Cancel</button>
    <button class="btn btn-primary" id="btn-check-gateway">🔄 Check Status</button>
  `);

  openModal("gateway-modal");

  const cleanup = () => {
    if (_pollInterval) {
      clearInterval(_pollInterval);
      _pollInterval = null;
    }
    closeModal("gateway-modal");
  };

  document.getElementById("btn-cancel-gateway").onclick = cleanup;

  const checkStatus = async () => {
    try {
      const statusRes = await API.verifyPayment(res.id);
      if (statusRes.status === "paid") {
        cleanup();
        toast("Payment successfully completed and verified!", "success");
        _payData = await API.getPayments({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
        renderPayRows();
        updatePaySummary();
      } else if (statusRes.status === "failed") {
        cleanup();
        toast("Payment transaction failed or was declined.", "error");
        _payData = await API.getPayments({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
        renderPayRows();
        updatePaySummary();
      }
    } catch (err) {
      console.error("Payment status check error:", err);
    }
  };

  document.getElementById("btn-check-gateway").onclick = checkStatus;

  // Poll every 3 seconds
  _pollInterval = setInterval(checkStatus, 3000);
}

async function deletePay(id){
  if(!await confirmDialog("Delete this payment record permanently?")) return;
  try{
    await API.deletePayment(id);toast("Payment deleted","success");
    _payData=_payData.filter(p=>p.id!==id);renderPayRows();updatePaySummary();
  }catch(err){toast(err.message,"error");}
}

function viewReceipt(pJson){
  let p;
  try { p = typeof pJson === "string" ? JSON.parse(pJson) : pJson; } catch(e) { return; }
  buildModal("receipt-modal","🧾 Payment Receipt",`
    <div style="font-family:monospace;background:var(--gray-50);padding:1.5rem;border-radius:8px;border:1px solid var(--gray-200)">
      <div style="text-align:center;margin-bottom:1rem">
        <div style="font-size:1.4rem">🧹</div>
        <div style="font-weight:700;font-size:1rem">Dire Dawa Cleaning Management</div>
        <div style="font-size:.8rem;color:var(--gray-500)">Official Payment Receipt</div>
      </div>
      <hr style="border-color:var(--gray-300);margin:.75rem 0">
      <table style="width:100%;font-size:.85rem">
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Receipt #</td><td style="text-align:right;font-weight:700">${escapeHtml(p.receipt_number||"—")}</td></tr>
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Business</td><td style="text-align:right">${escapeHtml(p.business_name)}</td></tr>
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Zone</td><td style="text-align:right">${escapeHtml(p.safer_zone_name||"—")}</td></tr>
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Kebele</td><td style="text-align:right">${escapeHtml(p.kebele_name)}</td></tr>
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Period</td><td style="text-align:right">${monthName(p.month)} ${p.year}</td></tr>
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Method</td><td style="text-align:right">${escapeHtml(p.method)}</td></tr>
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Paid</td><td style="text-align:right">${fmtDate(p.paid_at)}</td></tr>
        <tr><td style="color:var(--gray-500);padding:.2rem 0">Collector</td><td style="text-align:right">${escapeHtml(p.collector_name||"—")}</td></tr>
      </table>
      <hr style="border-color:var(--gray-300);margin:.75rem 0">
      <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700">
        <span>TOTAL PAID</span><span style="color:var(--green)">${fmtETB(p.amount)}</span>
      </div>
      ${p.notes?`<div style="margin-top:.75rem;font-size:.8rem;color:var(--gray-500)">Note: ${escapeHtml(p.notes)}</div>`:""}
      <div style="text-align:center;margin-top:1rem;font-size:.75rem;color:var(--gray-400)">Generated ${new Date().toLocaleString()}</div>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('receipt-modal')">Close</button>
     <button class="btn btn-primary" onclick="window.print()">🖨 Print</button>`
  );
  openModal("receipt-modal");
}
