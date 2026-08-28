let _toolsData=[],_toolsPage=1;

async function renderTools(){
  const content=document.getElementById("page-content");
  content.innerHTML=spinnerHTML;
  const canEdit=API.hasRole("admin","collector","leader");
  const isAdmin=API.hasRole("admin","collector");
  const zone=API.getZone();
  try{
    const [zones,tools]=await Promise.all([
      API.getSaferZones(),
      API.getTools(),
    ]);
    _toolsData=tools;
    content.innerHTML=`
      ${API.hasRole("leader")?leaderBanner():""}
      <div class="toolbar">
        ${!API.hasRole("leader")?`
        <select class="form-control" id="tool-filter-zone" style="width:200px">
          <option value="">All Zones</option>
          ${zones.map(z=>`<option value="${z.id}">${escapeHtml(z.name)} (${escapeHtml(z.kebele_name)})</option>`).join("")}
        </select>`:""}
        <select class="form-control" id="tool-filter-cat" style="width:140px">
          <option value="">All Categories</option>
          ${["vehicle","equipment","uniform","chemical","other"]
            .map(c=>`<option value="${c}">${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join("")}
        </select>
        <input class="search-input" id="tool-search" placeholder="🔍 Search tools…">
        <div class="toolbar-right">
          ${canEdit?`<button class="btn btn-primary" id="btn-add-tool">＋ Add Tool</button>`:""}
        </div>
      </div>
      <!-- Condition summary -->
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1rem">
        <div class="stat-card stat-green"><div class="stat-label">Good</div>
          <div class="stat-value">${tools.filter(t=>t.condition_status==="good").length}</div></div>
        <div class="stat-card stat-orange"><div class="stat-label">Fair</div>
          <div class="stat-value">${tools.filter(t=>t.condition_status==="fair").length}</div></div>
        <div class="stat-card stat-red"><div class="stat-label">Poor/Broken</div>
          <div class="stat-value">${tools.filter(t=>["poor","broken"].includes(t.condition_status)).length}</div></div>
        <div class="stat-card stat-blue"><div class="stat-label">Total Items</div>
          <div class="stat-value">${tools.reduce((s,t)=>s+t.quantity,0)}</div></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table id="tool-table">
            <thead><tr>
              <th>Name</th><th>Category</th><th>Qty</th><th>Condition</th>
              <th>Zone</th><th>Kebele</th><th>Notes</th>
              ${canEdit?"<th>Actions</th>":""}
            </tr></thead>
            <tbody id="tool-tbody"></tbody>
          </table>
        </div>
        <div id="tool-pagination" class="pagination"></div>
      </div>`;

    renderToolRows();
    document.getElementById("tool-search")?.addEventListener("input",e=>filterTable("tool-table",e.target.value));
    document.getElementById("tool-filter-cat")?.addEventListener("change",e=>{
      const cat=e.target.value;
      renderToolRows(cat?_toolsData.filter(t=>t.category===cat):_toolsData);
    });
    document.getElementById("tool-filter-zone")?.addEventListener("change",async e=>{
      _toolsData=await API.getTools(e.target.value?{zoneId:e.target.value}:{});
      _toolsPage=1;renderToolRows();
    });
    if(canEdit) document.getElementById("btn-add-tool")?.addEventListener("click",()=>openToolModal(null,zones));
  }catch(err){
    content.innerHTML=`<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderToolRows(data=_toolsData){
  const canEdit=API.hasRole("admin","collector","leader");
  const isAdmin=API.hasRole("admin","collector");
  const {slice,pages}=paginate(data,_toolsPage);
  const tbody=document.getElementById("tool-tbody");if(!tbody)return;
  if(!slice.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="icon">🔧</div><p>No tools found</p></div></td></tr>`;return;}
  tbody.innerHTML=slice.map(t=>`
    <tr>
      <td><strong>${escapeHtml(t.name)}</strong></td>
      <td><span class="badge badge-blue">${escapeHtml(t.category)}</span></td>
      <td style="font-weight:600">${t.quantity}</td>
      <td>${statusBadge(t.condition_status)}</td>
      <td>${escapeHtml(t.zone_name||"—")}</td><td>${escapeHtml(t.kebele_name||"—")}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.notes||"—")}</td>
      ${canEdit?`<td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="openToolModal(${t.id},null)">✏️</button>
        ${isAdmin?`<button class="btn btn-sm btn-danger" style="margin-left:.3rem" onclick="deleteTool(${t.id})">🗑</button>`:""}
      </td>`:""}
    </tr>`).join("");
  renderPagination("tool-pagination",_toolsPage,pages,p=>{_toolsPage=p;renderToolRows();});
}

async function openToolModal(id,zonesArg){
  const zones=zonesArg||await API.getSaferZones();
  const t=id?_toolsData.find(x=>x.id===id):null;
  const zone=API.getZone();
  const CATS=["vehicle","equipment","uniform","chemical","other"];
  const CONDS=["good","fair","poor","broken"];
  buildModal("tool-modal",id?"Edit Tool":"Add Tool",`
    <form id="tool-form" class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label>Tool/Equipment Name *</label>
        <input class="form-control" id="tf-name" value="${escapeAttr(t?.name||"")}" required>
        <span class="form-error"></span>
      </div>
      <div class="form-group">
        <label>Category *</label>
        <select class="form-control" id="tf-cat">
          ${CATS.map(c=>`<option value="${c}" ${t?.category===c?"selected":""}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Quantity *</label>
        <input class="form-control" id="tf-qty" type="number" min="1" value="${t?.quantity||1}" required>
      </div>
      <div class="form-group">
        <label>Condition *</label>
        <select class="form-control" id="tf-cond">
          ${CONDS.map(c=>`<option value="${c}" ${t?.condition_status===c?"selected":""}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Zone *</label>
        <select class="form-control" id="tf-zone" required ${zone?"disabled":""}>
          <option value="">Select Zone</option>
          ${zone?`<option value="${zone.id}" selected>${escapeHtml(zone.name)}</option>`:
            zones.map(z=>`<option value="${z.id}" ${t?.safer_zone_id===z.id?"selected":""}>${escapeHtml(z.name)} — ${escapeHtml(z.kebele_name)}</option>`).join("")}
        </select>
        <span class="form-error"></span>
      </div>
      <div class="form-group">
        <label>Acquired Date</label>
        <input class="form-control" id="tf-date" type="date" value="${t?.acquired_date?t.acquired_date.slice(0,10):""}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Notes</label>
        <textarea class="form-control" id="tf-notes" rows="2">${escapeHtml(t?.notes||"")}</textarea>
      </div>
    </form>`,
    `<button class="btn btn-outline" onclick="closeModal('tool-modal')">Cancel</button>
     <button class="btn btn-primary" id="tool-save">💾 Save</button>`
  );
  if(zone) document.getElementById("tf-zone").value=zone.id;
  openModal("tool-modal");
  document.getElementById("tool-save").addEventListener("click",async()=>{
    if(!validateForm(document.getElementById("tool-form"))) return;
    const payload={
      name:document.getElementById("tf-name").value.trim(),
      category:document.getElementById("tf-cat").value,
      quantity:document.getElementById("tf-qty").value,
      conditionStatus:document.getElementById("tf-cond").value,
      saferZoneId:document.getElementById("tf-zone").value,
      acquiredDate:document.getElementById("tf-date").value||null,
      notes:document.getElementById("tf-notes").value,
    };
    try{
      if(id) await API.updateTool(id,payload);
      else   await API.createTool(payload);
      closeModal("tool-modal");
      toast(id?"Tool updated":"Tool added","success");
      _toolsData=await API.getTools();renderToolRows();
    }catch(err){toast(escapeHtml(err.message),"error");}
  });
}

async function deleteTool(id){
  if(!await confirmDialog("Delete this tool record?")) return;
  try{
    await API.deleteTool(id);toast("Tool deleted","success");
    _toolsData=_toolsData.filter(t=>t.id!==id);renderToolRows();
  }catch(err){toast(escapeHtml(err.message),"error");}
}
