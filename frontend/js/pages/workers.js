let _workersData=[];

async function renderWorkers(){
  const content=document.getElementById("page-content");
  content.innerHTML=spinnerHTML;
  const role=API.getUser()?.role;
  const zone=API.getZone();
  try{
    const [zones,workers]=await Promise.all([API.getSaferZones(),API.getWorkers()]);
    _workersData=workers;
    const canEdit=API.hasRole("admin","collector","leader");
    const isAdmin=API.hasRole("admin","collector");
    const isCollector=role==="collector";
    content.innerHTML=`
      ${role==="leader"?leaderBanner():""}
      <div class="toolbar">
        ${role!=="leader"?`<select class="form-control" id="w-filter-zone" style="width:200px">
          <option value="">All Zones</option>
          ${zones.map(z=>`<option value="${z.id}">${escapeHtml(z.name)} (${escapeHtml(z.kebele_name)})</option>`).join("")}
        </select>`:""}
        <input class="search-input" id="w-search" placeholder="🔍 Search workers…">
        <div class="toolbar-right">
          ${canEdit?`<button class="btn btn-outline" id="btn-bulk-attend">📋 Bulk Attendance</button>`:""}
          ${canEdit?`<button class="btn btn-primary" id="btn-add-worker">＋ Add Worker</button>`:""}
        </div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1rem">
        <div class="stat-card stat-blue"><div class="stat-label">Total Workers</div><div class="stat-value">${_workersData.length}</div></div>
        <div class="stat-card stat-green"><div class="stat-label">Active</div><div class="stat-value">${_workersData.filter(w=>w.is_active).length}</div></div>
        <div class="stat-card stat-orange"><div class="stat-label">Daily Wage Total</div>
          <div class="stat-value" style="font-size:1.2rem">${fmtETB(_workersData.filter(w=>w.is_active).reduce((s,w)=>s+parseFloat(w.daily_wage),0))}</div></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table id="w-table">
            <thead><tr>
              <th>Name</th><th>Contact</th><th>Fayda/ID</th><th>Zone</th><th>Daily Wage</th><th>Status</th>
              ${canEdit?"<th>Actions</th>":""}
            </tr></thead>
            <tbody id="w-tbody"></tbody>
          </table>
        </div>
      </div>`;
    renderWorkerRows(zones);
    document.getElementById("w-search")?.addEventListener("input",e=>filterTable("w-table",e.target.value));
    document.getElementById("w-filter-zone")?.addEventListener("change",async e=>{
      _workersData=await API.getWorkers(e.target.value?{zoneId:e.target.value}:{});
      renderWorkerRows(zones);
    });
    if(canEdit){
      document.getElementById("btn-add-worker")?.addEventListener("click",()=>openWorkerModal(null,zones));
      document.getElementById("btn-bulk-attend")?.addEventListener("click",()=>openBulkAttendance());
    }
  }catch(err){
    content.innerHTML=`<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderWorkerRows(zones){
  const canEdit=API.hasRole("admin","collector","leader");
  const isAdmin=API.hasRole("admin","collector");
  const tbody=document.getElementById("w-tbody");if(!tbody)return;
  if(!_workersData.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="icon">👷</div><p>No workers</p></div></td></tr>`;return;}
  tbody.innerHTML=_workersData.map(w=>`
    <tr>
      <td><strong>${escapeHtml(w.full_name)}</strong></td>
      <td>${escapeHtml(w.contact||"—")}</td><td>${escapeHtml(w.fayda_id||"—")}</td>
      <td>${w.zone_name?`<span class="badge badge-purple">${escapeHtml(w.zone_name)}</span>`:"—"}</td>
      <td>${fmtETB(w.daily_wage)}/day</td>
      <td>${w.is_active?statusBadge("active"):"<span class=\"badge badge-gray\">Inactive</span>"}</td>
      ${canEdit?`<td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="openWorkerModal(${w.id},null)" title="Edit">✏️</button>
        <button class="btn btn-sm btn-outline" style="margin-left:.3rem" onclick="openWorkerIdCard(${w.id})" title="ID Card">🪪</button>
        <button class="btn btn-sm btn-outline" style="margin-left:.3rem" onclick="openWorkerAttendance(${w.id},${escapeJsStr(w.full_name)})" title="Attendance">📅</button>
        <button class="btn btn-sm btn-success" style="margin-left:.3rem" onclick="openSalaryModal(${w.id},${escapeJsStr(w.full_name)},${w.daily_wage})" title="Salary">💰</button>
        ${isAdmin?`<button class="btn btn-sm btn-danger" style="margin-left:.3rem" onclick="deleteWorker(${w.id})" title="Delete">🗑</button>`:""}
      </td>`:""}
    </tr>`).join("");
}

function openWorkerModal(id,zonesArg){
  const w=id?_workersData.find(x=>x.id===id):null;
  const myZone=API.getZone();
  const role=API.getUser()?.role;
  const isCollector=role==="collector";
  
  // For collector (kebele admin), filter zones to only those in their kebele
  let filteredZones=zonesArg||[];
  if(isCollector && !myZone){
    // Collector without zone info — get zones from their kebele via API
    // The backend will filter, but we should show zones from the same kebele
    // We'll use the zones already fetched (they include kebele_name)
    // For now, show all zones — backend will reject mismatched ones
  }
  
  let existingAttrs = {};
  if (w && w.custom_attributes) {
    try {
      existingAttrs = typeof w.custom_attributes === "string" ? JSON.parse(w.custom_attributes) : w.custom_attributes;
    } catch(e) { console.error("Failed to parse custom attributes", e); }
  }

  buildModal("worker-modal",id?"Edit Worker":"Add Worker",`
    <form id="worker-form" class="form-grid">
      <div class="form-group"><label>Full Name *</label>
        <input class="form-control" id="wf-name" value="${escapeAttr(w?.full_name||"")}" required>
        <span class="form-error"></span></div>
      <div class="form-group"><label>Contact (Phone)</label>
        <input class="form-control" id="wf-contact" value="${escapeAttr(w?.contact||"")}"></div>
      <div class="form-group"><label>Fayda/ID Number</label>
        <input class="form-control" id="wf-fayda" value="${escapeAttr(w?.fayda_id||"")}">
        <span class="form-error"></span></div>
      <div class="form-group"><label>Daily Wage (ETB) *</label>
        <input class="form-control" id="wf-wage" type="number" min="0" step="0.01" value="${w?.daily_wage||250}" required>
        <span class="form-error"></span></div>
      ${myZone?`<input type="hidden" id="wf-zone" value="${myZone.id}">
        <div class="form-group"><label>Zone</label><input class="form-control" value="${escapeAttr(myZone.name)}" disabled></div>`
      :isCollector?`<div class="form-group"><label>Zone</label>
          <select class="form-control" id="wf-zone">
            <option value="">Select Zone (optional)</option>
            ${filteredZones.map(z=>`<option value="${z.id}" ${w?.safer_zone_id===z.id?"selected":""}>${escapeHtml(z.name)} — ${escapeHtml(z.kebele_name)}</option>`).join("")}
          </select></div>`
      :`<div class="form-group"><label>Zone *</label>
          <select class="form-control" id="wf-zone" required>
            <option value="">Select Zone</option>
            ${filteredZones.map(z=>`<option value="${z.id}" ${w?.safer_zone_id===z.id?"selected":""}>${escapeHtml(z.name)} — ${escapeHtml(z.kebele_name)}</option>`).join("")}
          </select><span class="form-error"></span></div>`}
      ${id?`<div class="form-group"><label>Status</label>
        <select class="form-control" id="wf-active">
          <option value="1" ${w?.is_active!=0?"selected":""}>Active</option>
          <option value="0" ${w?.is_active==0?"selected":""}>Inactive</option>
        </select></div>`:""}
      <div style="grid-column:1/-1; margin-top:0.5rem; background:#f9fafb; padding:1rem; border-radius:8px; border:1px solid #e5e7eb;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <label style="font-size:0.85rem; font-weight:600; color:var(--gray-700); margin:0;">Custom Attributes (Optional)</label>
          <button type="button" class="btn btn-sm btn-outline" id="btn-add-attr" style="background:white;">➕ Add Attribute</button>
        </div>
        <div id="custom-attrs-container" style="display:flex; flex-direction:column; gap:0.5rem;"></div>
      </div>
    </form>`,
    `<button class="btn btn-outline" onclick="closeModal('worker-modal')">Cancel</button>
     <button class="btn btn-primary" id="worker-save">💾 Save</button>`
  );
  openModal("worker-modal");

  const container = document.getElementById("custom-attrs-container");
  window._removeAttrRow = function(btn) { btn.parentElement.remove(); };
  function addAttrRow(k="", v="") {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.gap = "0.5rem";
    div.className = "attr-row";
    div.innerHTML = `
      <input class="form-control attr-key" placeholder="Key (e.g. Blood Type)" value="${escapeAttr(k)}" style="flex:1">
      <input class="form-control attr-val" placeholder="Value (e.g. O+)" value="${escapeAttr(String(v))}" style="flex:1">
      <button type="button" class="btn btn-outline btn-icon" style="background:white;color:var(--red);border-color:#fca5a5" onclick="_removeAttrRow(this)">✖</button>
    `;
    container.appendChild(div);
  }

  for (const [k, v] of Object.entries(existingAttrs)) addAttrRow(k, v);

  document.getElementById("btn-add-attr").addEventListener("click", () => addAttrRow());

  document.getElementById("worker-save").addEventListener("click",async()=>{
    const faydaVal = document.getElementById("wf-fayda").value.trim();
    if (faydaVal) {
      if (!validateFaydaId(faydaVal)) {
        const faydaInp = document.getElementById("wf-fayda");
        faydaInp.classList.add("error");
        const err = faydaInp.parentElement.querySelector(".form-error");
        if (err) err.textContent = "Must be exactly 12 digits";
        toast("Fayda ID must be exactly 12 digits", "error");
        return;
      } else {
        const faydaInp = document.getElementById("wf-fayda");
        faydaInp.classList.remove("error");
        const err = faydaInp.parentElement.querySelector(".form-error");
        if (err) err.textContent = "";
      }
    }

    if(!validateForm(document.getElementById("worker-form"))) return;
    
    const attrRows = document.querySelectorAll("#custom-attrs-container .attr-row");
    const customAttributes = {};
    attrRows.forEach(row => {
      const k = row.querySelector(".attr-key").value.trim();
      const v = row.querySelector(".attr-val").value.trim();
      if (k) customAttributes[k] = v;
    });

    const payload={
      fullName:document.getElementById("wf-name").value.trim(),
      contact:document.getElementById("wf-contact").value.trim(),
      faydaId:faydaVal ? faydaVal.replace(/[\s-]/g, "") : null,
      dailyWage:document.getElementById("wf-wage").value,
      saferZoneId:document.getElementById("wf-zone").value,
      isActive:id?document.getElementById("wf-active").value==="1":true,
      customAttributes: Object.keys(customAttributes).length > 0 ? customAttributes : null,
    };
    try{
      if(id) await API.updateWorker(id,payload);
      else   await API.createWorker(payload);
      closeModal("worker-modal");
      toast(id?"Worker updated":"Worker added","success");
      _workersData=await API.getWorkers();renderWorkerRows(null);
    }catch(err){toast(err.message,"error");}
  });
}

async function deleteWorker(id){
  if(!await confirmDialog("Delete this worker and all records?")) return;
  try{
    await API.deleteWorker(id);toast("Worker deleted","success");
    _workersData=_workersData.filter(w=>w.id!==id);renderWorkerRows(null);
  }catch(err){toast(err.message,"error");}
}

async function openBulkAttendance(){
  const workers=_workersData.filter(w=>w.is_active);
  buildModal("attend-modal","📋 Record Daily Attendance",`
    <div class="form-group" style="margin-bottom:1rem"><label>Date *</label>
      <input class="form-control" id="att-date" type="date" value="${todayISO()}" style="max-width:200px"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Worker</th><th>Zone</th><th>Daily Wage</th><th>Present</th><th>Bonus (ETB)</th></tr></thead>
        <tbody>
          ${workers.map(w=>`<tr>
            <td>${escapeHtml(w.full_name)}</td><td>${escapeHtml(w.zone_name||"—")}</td><td>${fmtETB(w.daily_wage)}</td>
            <td><label style="cursor:pointer"><input type="checkbox" data-worker="${w.id}" class="att-check" checked> Present</label></td>
            <td><input type="number" class="form-control att-bonus" data-worker="${w.id}" min="0" step="0.01" placeholder="0" style="width:100px"></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('attend-modal')">Cancel</button>
     <button class="btn btn-success" id="att-save">✅ Save Attendance</button>`,true
  );
  openModal("attend-modal");
  document.getElementById("att-save").addEventListener("click",async()=>{
    const date=document.getElementById("att-date").value;
    if(!date){toast("Select a date","error");return;}
    const records=workers.map(w=>({
      workerId:w.id,
      present:document.querySelector(`.att-check[data-worker="${w.id}"]`)?.checked??true,
      bonus:parseFloat(document.querySelector(`.att-bonus[data-worker="${w.id}"]`)?.value)||null,
    }));
    try{await API.bulkAttendance({date,records});closeModal("attend-modal");toast("Attendance saved!","success");}
    catch(err){toast(err.message,"error");}
  });
}

async function openWorkerAttendance(workerId,workerName){
  const now=new Date();
  const firstDay=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
  const data=await API.getAttendance(workerId,{from:firstDay,to:todayISO()}).catch(()=>[]);
  const present=data.filter(r=>r.present).length,absent=data.filter(r=>!r.present).length;
  const bonus=data.reduce((s,r)=>s+(parseFloat(r.bonus)||0),0);
  const wage=parseFloat(_workersData.find(w=>w.id===workerId)?.daily_wage||250);
  const gross=present*wage+bonus;
  buildModal("worker-attend-modal",`📅 Attendance — ${escapeHtml(workerName)}`,`
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1rem">
      <div class="stat-card stat-green"><div class="stat-label">Present</div><div class="stat-value">${present}</div></div>
      <div class="stat-card stat-red"><div class="stat-label">Absent</div><div class="stat-value">${absent}</div></div>
      <div class="stat-card stat-blue"><div class="stat-label">Gross (Month)</div><div class="stat-value" style="font-size:1.1rem">${fmtETB(gross)}</div></div>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Date</th><th>Status</th><th>Bonus</th><th>Recorded By</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td>${fmtDate(r.date)}</td>
          <td>${r.present?statusBadge("active"):"<span class=\"badge badge-red\">Absent</span>"}</td>
          <td>${r.bonus?fmtETB(r.bonus):"—"}</td><td>${escapeHtml(r.recorder_name||"—")}</td>
        </tr>`).join("")||"<tr><td colspan=\"4\"><div class=\"empty\">No records this month</div></td></tr>"}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('worker-attend-modal')">Close</button>`,true
  );
  openModal("worker-attend-modal");
}

async function openSalaryModal(workerId,workerName,dailyWage){
  const history=await API.getWorkerSalary(workerId).catch(()=>[]);
  const now=new Date();
  const firstDay=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
  buildModal("salary-modal",`💰 Salary — ${escapeHtml(workerName)}`,`
    <div style="margin-bottom:1.25rem">
      <div class="card-title">Record New Payment</div>
      <div class="form-grid">
        <div class="form-group"><label>Amount (ETB) *</label>
          <input class="form-control" id="sal-amount" type="number" min="0" step="0.01" required>
          <span class="form-error"></span></div>
        <div class="form-group"><label>Payment Date *</label>
          <input class="form-control" id="sal-date" type="date" value="${todayISO()}" required>
          <span class="form-error"></span></div>
        <div class="form-group"><label>Period From</label>
          <input class="form-control" id="sal-from" type="date" value="${firstDay}"></div>
        <div class="form-group"><label>Period To</label>
          <input class="form-control" id="sal-to" type="date" value="${todayISO()}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label>
          <textarea class="form-control" id="sal-notes" rows="2"></textarea></div>
      </div>
      <div style="margin-top:.75rem;text-align:right">
        <button class="btn btn-success" id="sal-save">✅ Record Payment</button>
      </div>
    </div>
    <div class="card-title">Payment History</div>
    <div class="table-wrap">
      <table><thead><tr><th>Date</th><th>Amount</th><th>Period</th><th>Paid By</th></tr></thead>
        <tbody>${history.map(h=>`<tr>
          <td>${fmtDate(h.paid_at)}</td><td><strong>${fmtETB(h.amount)}</strong></td>
          <td>${fmtDate(h.period_from)} – ${fmtDate(h.period_to)}</td><td>${escapeHtml(h.paid_by_name||"—")}</td>
        </tr>`).join("")||"<tr><td colspan=\"4\"><div class=\"empty\">No payments yet</div></td></tr>"}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('salary-modal')">Close</button>`,true
  );
  openModal("salary-modal");
  document.getElementById("sal-save").addEventListener("click",async()=>{
    const amount=document.getElementById("sal-amount").value;
    const date=document.getElementById("sal-date").value;
    if(!amount||!date){toast("Amount and date required","error");return;}
    try{
      await API.paySalary(workerId,{
        amount,paidAt:date,
        periodFrom:document.getElementById("sal-from").value,
        periodTo:document.getElementById("sal-to").value,
        notes:document.getElementById("sal-notes").value,
      });
      closeModal("salary-modal");toast("Salary payment recorded!","success");
    }catch(err){toast(err.message,"error");}
  });
}

function openWorkerIdCard(id) {
  const w = _workersData.find(x => x.id === id);
  if (!w) return;
  
  const parts = (w.full_name || "").trim().split(/\s+/);
  const initials = parts.map(p => p[0]).slice(0, 2).join("").toUpperCase() || "W";
  
  let customAttrsHtml = "";
  if (w.custom_attributes) {
    let attrs = {};
    try {
      attrs = typeof w.custom_attributes === "string" ? JSON.parse(w.custom_attributes) : w.custom_attributes;
    } catch(e) {}
    if (attrs && Object.keys(attrs).length > 0) {
      customAttrsHtml = `
        <div style="width:100%; display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; background:#fffbf7; border:1px solid #fed7aa; border-radius:8px; padding:8px 10px; margin-bottom:15px; text-align:left;">
          <div style="grid-column: 1 / -1; font-size: 0.55rem; color:#c2410c; font-weight:700; text-transform:uppercase; border-bottom:1px solid #ffedd5; padding-bottom:3px; margin-bottom:3px;">Custom Info</div>
          ${Object.entries(attrs).map(([k, v]) => `
            <div>
              <span style="font-size:0.52rem; color:#7c2d12; text-transform:uppercase; display:block; font-weight:600;">${escapeHtml(k)}</span>
              <span style="font-size:0.72rem; font-weight:700; color:#431407;">${escapeHtml(v)}</span>
            </div>
          `).join("")}
        </div>
      `;
    }
  }

  const cleanFayda = w.fayda_id ? w.fayda_id.replace(/[\s-]/g, "") : "";

  const bodyHTML = `
    <div class="id-card-wrapper" style="display:flex; justify-content:center; padding:1rem 0;">
      <div class="id-card" style="width:340px; background:#ffffff; border-radius:18px; box-shadow:0 15px 35px rgba(0,0,0,0.15); border:1px solid #e2e8f0; overflow:hidden; position:relative; font-family:'Inter', sans-serif;">
        <!-- Ethiopian Tricolor Header Strip -->
        <div style="display:flex; height:6px; width:100%;">
          <div style="flex:1; background:#009c3a;"></div>
          <div style="flex:1; background:#f7d117;"></div>
          <div style="flex:1; background:#da121a;"></div>
        </div>
        
        <!-- Top Header Banner -->
        <div style="background:#1e3a8a; color:white; padding:12px; text-align:center; position:relative;">
          <div style="font-size:0.7rem; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:2px; color:#f7d117;">Dire Dawa City Administration</div>
          <div style="font-size:0.85rem; font-weight:800; letter-spacing:0.5px; text-transform:uppercase;">Cleaning Management System</div>
          <div style="font-size:0.55rem; font-weight:600; opacity:0.8; letter-spacing:1px; margin-top:2px;">OFFICIAL WORKER IDENTIFICATION</div>
        </div>
        
        <!-- Card Body -->
        <div style="padding:20px; display:flex; flex-direction:column; align-items:center; background:radial-gradient(circle at 100% 100%, rgba(30,58,138,0.03) 0%, rgba(255,255,255,1) 70%);">
          
          <!-- Avatar Section -->
          <div style="position:relative; margin-bottom:12px;">
            <!-- Glowing ring -->
            <div style="position:absolute; inset:-4px; border-radius:50%; background:linear-gradient(135deg, #1e3a8a, #0d9488); padding:4px; opacity:0.8;"></div>
            <!-- Initials Avatar -->
            <div style="position:relative; width:90px; height:90px; border-radius:50%; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-size:2.2rem; font-weight:800; color:#1e3a8a; border:3px solid #ffffff; box-shadow:inset 0 2px 4px rgba(0,0,0,0.06);">
              ${initials}
            </div>
          </div>
          
          <!-- Status Badge -->
          <div style="background:#dcfce7; color:#15803d; font-size:0.65rem; font-weight:800; padding:4px 10px; border-radius:9999px; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px; border:1px solid #bbf7d0; display:flex; align-items:center; gap:4px;">
            <span style="display:inline-block; width:6px; height:6px; background:#16a34a; border-radius:50%;"></span>
            ${w.is_active ? 'ACTIVE' : 'INACTIVE'}
          </div>
          
          <!-- Worker Details -->
          <div style="width:100%; text-align:center; margin-bottom:15px;">
            <h4 style="font-size:1.2rem; font-weight:800; color:#1f2937; margin:0 0 4px 0; letter-spacing:-0.3px;">${escapeHtml(w.full_name)}</h4>
            <p style="font-size:0.75rem; font-weight:600; color:#0d9488; text-transform:uppercase; margin:0 0 12px 0; letter-spacing:1px;">Cleaning Professional</p>
            
            <div style="border-top:1px dashed #e2e8f0; border-bottom:1px dashed #e2e8f0; padding:10px 0; margin-bottom:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:left;">
              <div>
                <span style="font-size:0.55rem; color:#9ca3af; text-transform:uppercase; display:block; font-weight:600;">Zone</span>
                <span style="font-size:0.8rem; font-weight:700; color:#374151;">${escapeHtml(w.zone_name || 'N/A')}</span>
              </div>
              <div>
                <span style="font-size:0.55rem; color:#9ca3af; text-transform:uppercase; display:block; font-weight:600;">Daily Wage</span>
                <span style="font-size:0.8rem; font-weight:700; color:#374151;">${fmtETB(w.daily_wage)}</span>
              </div>
              <div style="grid-column: 1 / -1;">
                <span style="font-size:0.55rem; color:#9ca3af; text-transform:uppercase; display:block; font-weight:600;">Contact</span>
                <span style="font-size:0.8rem; font-weight:700; color:#374151;">${escapeHtml(w.contact || '—')}</span>
              </div>
            </div>
          </div>
          
          <!-- Fayda ID Section -->
          <div style="width:100%; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; text-align:center; margin-bottom:15px; position:relative;">
            <span style="font-size:0.55rem; color:#475569; text-transform:uppercase; display:block; font-weight:700; letter-spacing:1px; margin-bottom:4px;">Fayda National Digital ID</span>
            <span style="font-size:1.1rem; font-weight:800; color:#1e293b; font-family:'Courier New', Courier, monospace; letter-spacing:1.5px;">
              ${w.fayda_id ? escapeHtml(formatFaydaId(w.fayda_id)) : 'PENDING'}
            </span>
          </div>

          <!-- Custom Attributes Section -->
          ${customAttrsHtml}

          <!-- Barcode Section -->
          <div style="width:100%; display:flex; flex-direction:column; align-items:center; margin-top:5px; padding-top:10px; border-top:1px solid #f1f5f9;">
            <!-- Simulated Barcode -->
            <div style="display:flex; justify-content:center; gap:2px; height:24px; width:180px; background:white; padding:2px; margin-bottom:4px; opacity:0.85;">
              ${Array.from({length: 24}, (_, i) => {
                const widths = [1, 2, 3, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 2];
                const wVal = widths[i % widths.length];
                return `<div style="width:${wVal}px; background:#000000; height:100%;"></div>`;
              }).join("")}
            </div>
            <div style="font-size:0.5rem; font-weight:600; color:#94a3b8; font-family:monospace; letter-spacing:2px;">
              ${cleanFayda || '000000000000'}
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  buildModal("worker-card-modal", "🪪 Worker ID Card", bodyHTML, `
    <button class="btn btn-outline" onclick="closeModal('worker-card-modal')">Close</button>
    <button class="btn btn-primary" onclick="window.print()">🖨️ Print Card</button>
  `);
  openModal("worker-card-modal");
}
