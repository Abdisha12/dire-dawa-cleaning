let _inspData=[],_inspPage=1;

async function renderInspections(){
  const content=document.getElementById("page-content");
  content.innerHTML=spinnerHTML;
  const role=API.getUser()?.role;
  const zone=API.getZone();
  try{
    const [kebeles,zones,inspections]=await Promise.all([
      API.getKebeles(),API.getSaferZones(),API.getInspections()
    ]);
    _inspData=inspections;
    const canEdit=API.hasRole("admin","collector","leader");
    const isAdmin=API.hasRole("admin","collector");
    content.innerHTML=`
      ${role==="leader"?leaderBanner():""}
      <div class="toolbar">
        ${role!=="leader"?`<select class="form-control" id="insp-filter-kebele" style="width:155px">
          <option value="">All Kebeles</option>
          ${kebeles.map(k=>`<option value="${k.id}">${k.name}</option>`).join("")}
        </select>`:""}
        <select class="form-control" id="insp-filter-status" style="width:120px">
          <option value="">All Status</option>
          <option value="active">Active</option><option value="warning">Warning</option><option value="danger">Danger</option>
        </select>
        <input type="date" class="form-control" id="insp-from" style="width:145px">
        <input type="date" class="form-control" id="insp-to" style="width:145px">
        <input class="search-input" id="insp-search" placeholder="🔍 Search…">
        <div class="toolbar-right">
          ${canEdit?`<button class="btn btn-primary" id="btn-add-insp">＋ Add Inspection</button>`:""}
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table id="insp-table">
            <thead><tr>
              <th>Date</th><th>Kebele</th><th>Zone</th><th>Status</th><th>Inspector</th>
              <th>Photos</th><th>Notes</th>${canEdit?"<th>Actions</th>":""}
            </tr></thead>
            <tbody id="insp-tbody"></tbody>
          </table>
        </div>
        <div id="insp-pagination" class="pagination"></div>
      </div>`;
    renderInspRows(kebeles,zones);
    document.getElementById("insp-search")?.addEventListener("input",e=>filterTable("insp-table",e.target.value));
    async function applyFilters(){
      const params={};
      const k=document.getElementById("insp-filter-kebele")?.value;
      const s=document.getElementById("insp-filter-status").value;
      const f=document.getElementById("insp-from").value;
      const t=document.getElementById("insp-to").value;
      if(k) params.kebeleId=k;if(s) params.status=s;if(f) params.from=f;if(t) params.to=t;
      _inspData=await API.getInspections(params);_inspPage=1;renderInspRows(kebeles,zones);
    }
    ["insp-filter-kebele","insp-filter-status","insp-from","insp-to"]
      .forEach(id=>document.getElementById(id)?.addEventListener("change",applyFilters));
    if(canEdit) document.getElementById("btn-add-insp")?.addEventListener("click",()=>openInspModal(null,kebeles,zones));
  }catch(err){
    content.innerHTML=`<div class="empty"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function renderInspRows(kebeles,zones){
  const canEdit=API.hasRole("admin","collector","leader");
  const isAdmin=API.hasRole("admin","collector");
  const {slice,pages}=paginate(_inspData,_inspPage);
  const tbody=document.getElementById("insp-tbody");if(!tbody)return;
  if(!slice.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="icon">🔍</div><p>No inspections</p></div></td></tr>`;return;}
  tbody.innerHTML=slice.map(r=>`
    <tr>
      <td><strong>${fmtDate(r.date)}</strong></td>
      <td>${r.kebele_name} <small style="color:var(--gray-500)">(${r.kebele_code})</small></td>
      <td>${r.zone_name||"—"}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.inspector_name||"—"}</td>
      <td>${r.photos?.length?`<button class="btn btn-sm btn-outline" onclick="viewPhotos(${r.id})">🖼 ${r.photos.length}</button>`:"<span style=\"color:var(--gray-300)\">None</span>"}</td>
      <td style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes||"—"}</td>
      ${canEdit?`<td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="openInspModal(${r.id},null,null)">✏️</button>
        ${isAdmin?`<button class="btn btn-sm btn-danger" style="margin-left:.3rem" onclick="deleteInsp(${r.id})">🗑</button>`:""}
      </td>`:""}
    </tr>`).join("");
  renderPagination("insp-pagination",_inspPage,pages,p=>{_inspPage=p;renderInspRows(kebeles,zones);});
}

async function openInspModal(id,kebelesArg,zonesArg){
  const kebeles=kebelesArg||await API.getKebeles();
  const zones=zonesArg||await API.getSaferZones();
  const myZone=API.getZone();
  let insp=null;
  if(id) insp=await API.getInspection(id).catch(()=>null);
  buildModal("insp-modal",id?"Edit Inspection":"New Inspection",`
    <form id="insp-form">
      <div class="form-grid">
        ${myZone?`
          <input type="hidden" id="if-kebele" value="${myZone.kebele_id}">
          <input type="hidden" id="if-zone" value="${myZone.id}">
          <div class="form-group" style="grid-column:1/-1">
            <label>Zone</label>
            <input class="form-control" value="${myZone.name} — ${myZone.kebele_name}" disabled>
          </div>`:`
          <div class="form-group">
            <label>Kebele *</label>
            <select class="form-control" id="if-kebele" required>
              <option value="">Select Kebele</option>
              ${kebeles.map(k=>`<option value="${k.id}" ${insp?.kebele_id==k.id?"selected":""}>${k.name}</option>`).join("")}
            </select><span class="form-error"></span>
          </div>
          <div class="form-group">
            <label>Zone (optional)</label>
            <select class="form-control" id="if-zone">
              <option value="">Kebele-level (no specific zone)</option>
              ${zones.map(z=>`<option value="${z.id}" ${insp?.safer_zone_id==z.id?"selected":""}>${z.name} — ${z.kebele_name}</option>`).join("")}
            </select>
          </div>`}
        <div class="form-group">
          <label>Date *</label>
          <input class="form-control" id="if-date" type="date" value="${insp?.date?insp.date.slice(0,10):todayISO()}" required>
          <span class="form-error"></span>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Status</label>
          <div style="display:flex;gap:1rem;margin-top:.25rem">
            ${["active","warning","danger"].map(s=>`
              <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
                <input type="radio" name="if-status" value="${s}" ${(insp?.status||"active")===s?"checked":""}>${statusBadge(s)}
              </label>`).join("")}
          </div>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Notes / Issues</label>
          <textarea class="form-control" id="if-notes" rows="3">${insp?.notes||""}</textarea>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Photos (max 10)</label>
          <input type="file" class="form-control" id="if-photos" multiple accept="image/*">
          <div class="photo-grid" id="existing-photos">
            ${(insp?.photos||[]).map(p=>`<div class="photo-thumb" id="photo-${p.id}">
              <img src="${API.getFileUrl(p.file_path)}" alt="photo">
              <button class="del-photo" onclick="deleteInspPhoto(${p.id})">✕</button>
            </div>`).join("")}
          </div>
        </div>
      </div>
    </form>`,
    `<button class="btn btn-outline" onclick="closeModal('insp-modal')">Cancel</button>
     <button class="btn btn-primary" id="insp-save">💾 Save</button>`,true
  );
  openModal("insp-modal");
  document.getElementById("insp-save").addEventListener("click",async()=>{
    if(!validateForm(document.getElementById("insp-form"))) return;
    const fd=new FormData();
    fd.append("kebeleId",document.getElementById("if-kebele").value);
    fd.append("saferZoneId",document.getElementById("if-zone")?.value||"");
    fd.append("date",document.getElementById("if-date").value);
    fd.append("status",document.querySelector("[name=\"if-status\"]:checked")?.value||"active");
    fd.append("notes",document.getElementById("if-notes").value);
    for(const f of document.getElementById("if-photos").files) fd.append("photos",f);
    try{
      if(id) await API.updateInspection(id,fd);
      else   await API.createInspection(fd);
      closeModal("insp-modal");
      toast(id?"Inspection updated":"Inspection saved","success");
      _inspData=await API.getInspections();renderInspRows(null,null);
    }catch(err){toast(err.message,"error");}
  });
}

async function deleteInsp(id){
  if(!await confirmDialog("Delete this inspection and all photos?")) return;
  try{
    await API.deleteInspection(id);toast("Inspection deleted","success");
    _inspData=_inspData.filter(r=>r.id!==id);renderInspRows(null,null);
  }catch(err){toast(err.message,"error");}
}

async function deleteInspPhoto(photoId){
  try{await API.deletePhoto(photoId);document.getElementById(`photo-${photoId}`)?.remove();toast("Photo removed","success");}
  catch(err){toast(err.message,"error");}
}

async function viewPhotos(id){
  const insp=await API.getInspection(id).catch(()=>null);
  if(!insp?.photos?.length){toast("No photos","info");return;}
  buildModal("photos-modal",`Photos — ${insp.kebele_name} (${fmtDate(insp.date)})`,`
    <div style="display:flex;flex-wrap:wrap;gap:.75rem">
      ${insp.photos.map(p=>`<a href="${API.getFileUrl(p.file_path)}" target="_blank">
        <img src="${API.getFileUrl(p.file_path)}" style="width:160px;height:120px;object-fit:cover;border-radius:6px;border:1px solid var(--gray-200)">
      </a>`).join("")}
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('photos-modal')">Close</button>`,true
  );
  openModal("photos-modal");
}
