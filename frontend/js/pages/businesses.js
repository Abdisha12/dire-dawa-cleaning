let _bizData=[],_bizPage=1;

async function renderBusinesses(){
  const content=document.getElementById("page-content");
  content.innerHTML=spinnerHTML;
  const role=API.getUser()?.role;
  const zone=API.getZone();
  try{
    const [kebeles,businesses]=await Promise.all([API.getKebeles(),API.getBusinesses()]);
    _bizData=businesses;
    const canEdit=API.hasRole("admin","collector","leader");
    const isAdmin=API.hasRole("admin","collector");
    content.innerHTML=`
      ${role==="leader"?leaderBanner():""}
      <div class="toolbar">
        ${role!=="leader"?`<select class="form-control" id="biz-filter-kebele" style="width:160px">
          <option value="">All Kebeles</option>
          ${kebeles.map(k=>`<option value="${k.id}">${k.name}</option>`).join("")}
        </select>`:""}
        <select class="form-control" id="biz-filter-type" style="width:140px">
          <option value="">All Types</option>
          ${["shop","cafe","hotel","restaurant","pharmacy","market","workshop","office","school","clinic","other"]
            .map(t=>`<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join("")}
        </select>
        <input class="search-input" id="biz-search" placeholder="🔍 Search businesses…">
        <div class="toolbar-right">
          ${canEdit?`<button class="btn btn-primary" id="btn-add-biz">＋ Add Business</button>`:""}
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table id="biz-table">
            <thead><tr>
              <th>Name</th><th>Owner</th><th>Type</th><th>Zone</th><th>Kebele</th>
              <th>Monthly Target</th><th>Status</th>
              ${canEdit?"<th>Actions</th>":""}
            </tr></thead>
            <tbody id="biz-tbody"></tbody>
          </table>
        </div>
        <div id="biz-pagination" class="pagination"></div>
      </div>`;
    renderBizRows(kebeles);
    document.getElementById("biz-search")?.addEventListener("input",e=>filterTable("biz-table",e.target.value));
    document.getElementById("biz-filter-kebele")?.addEventListener("change",async e=>{
      _bizData=await API.getBusinesses(e.target.value?{kebeleId:e.target.value}:{});
      _bizPage=1;renderBizRows(kebeles);
    });
    document.getElementById("biz-filter-type")?.addEventListener("change",e=>{
      const type=e.target.value;
      renderBizRows(kebeles,type?_bizData.filter(b=>b.type===type):_bizData);
    });
    if(canEdit) document.getElementById("btn-add-biz")?.addEventListener("click",()=>openBizModal(null,kebeles));
  }catch(err){
    content.innerHTML=`<div class="empty"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function renderBizRows(kebeles,data=_bizData){
  const canEdit=API.hasRole("admin","collector","leader");
  const isAdmin=API.hasRole("admin","collector");
  const {slice,pages}=paginate(data,_bizPage);
  const tbody=document.getElementById("biz-tbody");if(!tbody)return;
  if(!slice.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="icon">🏪</div><p>No businesses found</p></div></td></tr>`;return;}
  tbody.innerHTML=slice.map(b=>`
    <tr>
      <td><strong>${b.name}</strong></td>
      <td>${b.owner_name}<br><small style="color:var(--gray-500)">${b.owner_fayda_id||""}</small></td>
      <td><span class="badge badge-gray">${b.type}</span></td>
      <td>${b.safer_zone_name||"—"}</td><td>${b.kebele_name||"—"}</td>
      <td>${fmtETB(b.monthly_target)}</td>
      <td>${b.is_active?statusBadge("active"):"<span class=\"badge badge-gray\">Inactive</span>"}</td>
      ${canEdit?`<td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="openBizModal(${b.id},null)">✏️</button>
        ${isAdmin?`<button class="btn btn-sm btn-danger" style="margin-left:.3rem" onclick="deleteBiz(${b.id})">🗑</button>`:""}
        <button class="btn btn-sm btn-success" style="margin-left:.3rem" onclick="openPayModal(${b.id},'${b.name.replace(/'/g,"\'")}',${b.monthly_target})">💳 Pay</button>
      </td>`:""}
    </tr>`).join("");
  renderPagination("biz-pagination",_bizPage,pages,p=>{_bizPage=p;renderBizRows(kebeles);});
}

async function openBizModal(id,kebelesArg){
  const kebeles=kebelesArg||await API.getKebeles();
  const zone=API.getZone();
  let biz=null;
  if(id) biz=await API.getBusiness(id).catch(()=>null);
  const TYPES=["shop","cafe","hotel","restaurant","pharmacy","market","workshop","office","school","clinic","other"];
  buildModal("biz-modal",id?"Edit Business":"Add Business",`
    <form id="biz-form" class="form-grid">
      <div class="form-group"><label>Business Name *</label>
        <input class="form-control" id="bf-name" value="${biz?.name||""}" required>
        <span class="form-error"></span></div>
      <div class="form-group"><label>Owner Name *</label>
        <input class="form-control" id="bf-owner" value="${biz?.owner_name||""}" required>
        <span class="form-error"></span></div>
      <div class="form-group"><label>Owner Fayda/ID</label>
        <input class="form-control" id="bf-fayda" value="${biz?.owner_fayda_id||""}">
        <span class="form-error"></span></div>
      <div class="form-group"><label>Owner Phone</label>
        <input class="form-control" id="bf-phone" value="${biz?.owner_phone||""}"></div>
      <div class="form-group"><label>Business Type</label>
        <select class="form-control" id="bf-type">
          ${TYPES.map(t=>`<option value="${t}" ${biz?.type===t?"selected":""}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join("")}
        </select></div>
      ${zone?`<input type="hidden" id="bf-zone" value="${zone.id}">
        <div class="form-group"><label>Zone</label>
          <input class="form-control" value="${zone.name}" disabled></div>`:`
      <div class="form-group"><label>Kebele *</label>
        <select class="form-control" id="bf-kebele" required>
          <option value="">Select Kebele</option>
          ${kebeles.map(k=>`<option value="${k.id}" ${biz?.kebele_id==k.id?"selected":""}>${k.name}</option>`).join("")}
        </select><span class="form-error"></span></div>
      <div class="form-group"><label>Safer Zone *</label>
        <select class="form-control" id="bf-zone" required>
          <option value="">Select Zone</option>
        </select><span class="form-error"></span></div>`}
      <div class="form-group"><label>Monthly Target (ETB) *</label>
        <input class="form-control" id="bf-target" type="number" min="0" step="0.01" value="${biz?.monthly_target||""}" required>
        <span class="form-error"></span></div>
      ${id?`<div class="form-group"><label>Status</label>
        <select class="form-control" id="bf-active">
          <option value="1" ${biz?.is_active!=0?"selected":""}>Active</option>
          <option value="0" ${biz?.is_active==0?"selected":""}>Inactive</option>
        </select></div>`:""}
      <div class="form-group" style="grid-column:1/-1"><label>Notes</label>
        <textarea class="form-control" id="bf-notes" rows="2">${biz?.notes||""}</textarea></div>
    </form>`,
    `<button class="btn btn-outline" onclick="closeModal('biz-modal')">Cancel</button>
     <button class="btn btn-primary" id="biz-save">💾 Save</button>`
  );
  openModal("biz-modal");

  if(!zone){
    async function loadZones(kebeleId,selectedZone=null){
      const zoneEl=document.getElementById("bf-zone");
      if(!kebeleId){zoneEl.innerHTML="<option value=\"\">Select Zone</option>";return;}
      const zones=await API.getSaferZones({kebeleId});
      zoneEl.innerHTML="<option value=\"\">Select Zone</option>"+
        zones.map(z=>`<option value="${z.id}" ${(selectedZone||biz?.safer_zone_id)==z.id?"selected":""}>${z.name}</option>`).join("");
    }
    const kebeleEl=document.getElementById("bf-kebele");
    kebeleEl.addEventListener("change",()=>loadZones(kebeleEl.value));
    if(biz?.kebele_id) await loadZones(biz.kebele_id,biz.safer_zone_id);
  }

  document.getElementById("biz-save").addEventListener("click",async()=>{
    const faydaVal = document.getElementById("bf-fayda").value.trim();
    if (faydaVal) {
      if (!validateFaydaId(faydaVal)) {
        const faydaInp = document.getElementById("bf-fayda");
        faydaInp.classList.add("error");
        const err = faydaInp.parentElement.querySelector(".form-error");
        if (err) err.textContent = "Must be exactly 12 digits";
        toast("Fayda ID must be exactly 12 digits", "error");
        return;
      } else {
        const faydaInp = document.getElementById("bf-fayda");
        faydaInp.classList.remove("error");
        const err = faydaInp.parentElement.querySelector(".form-error");
        if (err) err.textContent = "";
      }
    }

    if(!validateForm(document.getElementById("biz-form"))) return;
    const payload={
      name:document.getElementById("bf-name").value.trim(),
      ownerName:document.getElementById("bf-owner").value.trim(),
      ownerFaydaId:faydaVal ? faydaVal.replace(/[\s-]/g, "") : null,
      ownerPhone:document.getElementById("bf-phone").value.trim(),
      type:document.getElementById("bf-type").value,
      saferZoneId:document.getElementById("bf-zone").value,
      monthlyTarget:document.getElementById("bf-target").value,
      isActive:id?document.getElementById("bf-active").value==="1":true,
      notes:document.getElementById("bf-notes").value,
    };
    try{
      if(id) await API.updateBusiness(id,payload);
      else   await API.createBusiness(payload);
      closeModal("biz-modal");
      toast(id?"Business updated":"Business added","success");
      _bizData=await API.getBusinesses();renderBizRows(null);
    }catch(err){toast(err.message,"error");}
  });
}

async function deleteBiz(id){
  if(!await confirmDialog("Delete this business and all its payment records?")) return;
  try{
    await API.deleteBusiness(id);toast("Business deleted","success");
    _bizData=_bizData.filter(b=>b.id!==id);renderBizRows(null);
  }catch(err){toast(err.message,"error");}
}

function openPayModal(businessId,bizName,target){
  const now=new Date();
  buildModal("pay-quick-modal",`Record Payment — ${bizName}`,`
    <form id="pay-quick-form" class="form-grid">
      <div class="form-group"><label>Amount (ETB) *</label>
        <input class="form-control" id="pq-amount" type="number" min="0" step="0.01" value="${target}" required>
        <span class="form-error"></span></div>
      <div class="form-group"><label>Payment Method</label>
        <select class="form-control" id="pq-method">
          <option value="cash">Cash</option><option value="mobile">Mobile Money</option>
          <option value="bank">Bank Transfer</option><option value="other">Other</option>
        </select></div>
      <div class="form-group"><label>Month *</label>
        <select class="form-control" id="pq-month" required>
          ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?"selected":""}>${monthName(i+1)}</option>`).join("")}
        </select></div>
      <div class="form-group"><label>Year *</label>
        <input class="form-control" id="pq-year" type="number" value="${now.getFullYear()}" required></div>
      <div class="form-group" style="grid-column:1/-1"><label>Notes</label>
        <textarea class="form-control" id="pq-notes" rows="2"></textarea></div>
    </form>`,
    `<button class="btn btn-outline" onclick="closeModal('pay-quick-modal')">Cancel</button>
     <button class="btn btn-success" id="pq-save">✅ Record Payment</button>`
  );
  openModal("pay-quick-modal");
  document.getElementById("pq-save").addEventListener("click",async()=>{
    if(!validateForm(document.getElementById("pay-quick-form"))) return;
    try{
      const res=await API.createPayment({
        businessId,amount:document.getElementById("pq-amount").value,
        method:document.getElementById("pq-method").value,
        month:document.getElementById("pq-month").value,
        year:document.getElementById("pq-year").value,
        notes:document.getElementById("pq-notes").value,
      });
      closeModal("pay-quick-modal");
      toast(`Payment recorded! Receipt: ${res.receiptNumber}`,"success");
    }catch(err){toast(err.message,"error");}
  });
}
