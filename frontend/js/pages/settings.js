async function renderSettings(){
  const content=document.getElementById("page-content");

  // Non-admin users: show only the Change Password panel
  if(!API.hasRole("admin")){
    const user=API.getUser();
    content.innerHTML=`
      <div style="max-width:480px;margin:0 auto">
        <div class="card">
          <div class="card-title">🔑 Change My Password</div>
          <div class="form-grid">
            <div class="form-group"><label>New Password *</label>
              <input class="form-control" id="my-pw-new" type="password" minlength="6" placeholder="Min 6 characters"></div>
            <div class="form-group"><label>Confirm Password *</label>
              <input class="form-control" id="my-pw-confirm" type="password" placeholder="Repeat new password"></div>
          </div>
          <div style="margin-top:1rem;text-align:right">
            <button class="btn btn-primary" id="btn-change-my-pw">🔑 Update Password</button>
          </div>
        </div>
        <p style="text-align:center;margin-top:1rem;font-size:.78rem;opacity:.5">
          Only administrators can manage zones, kebeles, and user assignments.
        </p>
      </div>`;
    document.getElementById("btn-change-my-pw").addEventListener("click",async()=>{
      const np=document.getElementById("my-pw-new").value;
      const cp=document.getElementById("my-pw-confirm").value;
      if(np.length<6){toast("Min 6 characters","error");return;}
      if(np!==cp){toast("Passwords do not match","error");return;}
      try{
        await API.changePassword(user.id,np);
        toast("Password updated!","success");
        document.getElementById("my-pw-new").value="";
        document.getElementById("my-pw-confirm").value="";
      }catch(err){toast(err.message,"error");}
    });
    return;
  }

  content.innerHTML=spinnerHTML;
  try{
    const [kebeles,zones,leaders,collectors]=await Promise.all([
      API.getKebeles(),API.getSaferZones(),
      API.getLeaders(),
      API.getUsers({role:"collector"}),
    ]);
    content.innerHTML=`
      <div style="display:grid;gap:1rem;grid-template-columns:1fr 1fr">
        <!-- Kebele → Collector Assignment -->
        <div class="card">
          <div class="card-title">🏘 Kebele — Collector Assignment</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Kebele</th><th>Zones</th><th>Collector</th><th>Action</th></tr></thead>
              <tbody>
                ${kebeles.map(k=>`<tr>
                  <td><strong>${k.name}</strong> <code style="font-size:.7rem">${k.code}</code></td>
                  <td><span class="badge badge-blue">${k.zone_count}</span></td>
                  <td>
                    <select class="form-control" id="kc-${k.id}" style="width:150px">
                      <option value="">Unassigned</option>
                      ${collectors.map(c=>`<option value="${c.id}" ${k.collector_id===c.id?"selected":""}>${c.full_name}</option>`).join("")}
                    </select>
                  </td>
                  <td><button class="btn btn-sm btn-primary" onclick="saveKebeleCollector(${k.id})">Save</button></td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Zone → Leader Assignment -->
        <div class="card">
          <div class="card-title">📍 Zone — Leader Assignment
            <button class="btn btn-sm btn-primary" id="btn-add-zone">＋ Add Zone</button>
          </div>
          <div class="form-group" style="margin-bottom:.75rem">
            <select class="form-control" id="zone-filter-kebele">
              <option value="">All Kebeles</option>
              ${kebeles.map(k=>`<option value="${k.id}">${k.name}</option>`).join("")}
            </select>
          </div>
          <div class="table-wrap" style="max-height:420px;overflow-y:auto">
            <table id="zone-assign-table">
              <thead><tr><th>Zone</th><th>Kebele</th><th>Leader</th><th>Actions</th></tr></thead>
              <tbody id="zone-assign-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- All Leaders overview -->
        <div class="card">
          <div class="card-title">🟣 Zone Leaders Overview</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Leader</th><th>Phone</th><th>Zone Assigned</th><th>Kebele</th></tr></thead>
              <tbody>
                ${leaders.map(l=>`<tr>
                  <td><strong>${l.full_name}</strong></td>
                  <td>${l.phone||"—"}</td>
                  <td>${l.zone_name?`<span class="badge badge-purple">${l.zone_name}</span>`:"<span style=\"color:var(--orange)\">⚠ Unassigned</span>"}</td>
                  <td>${l.kebele_name||"—"}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Change own password -->
        <div class="card">
          <div class="card-title">🔑 Change My Password</div>
          <div class="form-grid">
            <div class="form-group"><label>New Password *</label>
              <input class="form-control" id="my-pw-new" type="password" minlength="6"></div>
            <div class="form-group"><label>Confirm *</label>
              <input class="form-control" id="my-pw-confirm" type="password"></div>
          </div>
          <div style="margin-top:.75rem;text-align:right">
            <button class="btn btn-danger" id="btn-change-my-pw">🔑 Update</button>
          </div>
        </div>
      </div>`;

    renderZoneAssignRows(zones,leaders);

    document.getElementById("zone-filter-kebele").addEventListener("change",async e=>{
      const filtered=await API.getSaferZones(e.target.value?{kebeleId:e.target.value}:{});
      renderZoneAssignRows(filtered,leaders);
    });

    document.getElementById("btn-add-zone").addEventListener("click",()=>openAddZoneModal(kebeles,leaders));

    document.getElementById("btn-change-my-pw").addEventListener("click",async()=>{
      const np=document.getElementById("my-pw-new").value;
      const cp=document.getElementById("my-pw-confirm").value;
      if(np.length<6){toast("Min 6 characters","error");return;}
      if(np!==cp){toast("Passwords do not match","error");return;}
      try{await API.changePassword(API.getUser().id,np);toast("Password updated!","success");
        document.getElementById("my-pw-new").value="";document.getElementById("my-pw-confirm").value="";}
      catch(err){toast(err.message,"error");}
    });
  }catch(err){
    content.innerHTML=`<div class="empty"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function renderZoneAssignRows(zones,leaders){
  const tbody=document.getElementById("zone-assign-tbody");if(!tbody)return;
  if(!zones.length){tbody.innerHTML=`<tr><td colspan="4"><div class="empty">No zones</div></td></tr>`;return;}
  tbody.innerHTML=zones.map(z=>`<tr>
    <td>${z.name}</td>
    <td>${z.kebele_name}</td>
    <td>
      <select class="form-control" id="zl-${z.id}" style="width:150px">
        <option value="">None</option>
        ${leaders.map(l=>`<option value="${l.id}" ${z.leader_id===l.id?"selected":""}>${l.full_name}</option>`).join("")}
      </select>
    </td>
    <td style="white-space:nowrap">
      <button class="btn btn-sm btn-primary" onclick="saveZoneLeader(${z.id},'${z.name.replace(/'/g,"\\'")}')">Save</button>
      <button class="btn btn-sm btn-danger" style="margin-left:.3rem" onclick="deleteZone(${z.id})">🗑</button>
    </td>
  </tr>`).join("");
}

async function saveKebeleCollector(kebeleId){
  const collectorId=document.getElementById(`kc-${kebeleId}`).value;
  try{
    await API.updateKebele(kebeleId,{collectorId:collectorId||null});
    toast("Collector assigned!","success");
  }catch(err){toast(err.message,"error");}
}

async function saveZoneLeader(zoneId,zoneName){
  const leaderId=document.getElementById(`zl-${zoneId}`).value;
  try{
    await API.updateSaferZone(zoneId,{name:zoneName,leaderId:leaderId||null});
    toast("Leader assigned!","success");
  }catch(err){toast(err.message,"error");}
}

async function deleteZone(id){
  if(!await confirmDialog("Delete this zone? Workers and tools in it will lose their zone.")) return;
  try{
    await API.deleteSaferZone(id);toast("Zone deleted","success");
    renderSettings();
  }catch(err){toast(err.message,"error");}
}

async function openAddZoneModal(kebeles,leaders){
  buildModal("add-zone-modal","＋ Add New Zone",`
    <div class="form-grid">
      <div class="form-group"><label>Zone Name *</label>
        <input class="form-control" id="az-name" required placeholder="e.g. Zone M - Kezira Industrial">
        <span class="form-error"></span></div>
      <div class="form-group"><label>Kebele *</label>
        <select class="form-control" id="az-kebele" required>
          <option value="">Select Kebele</option>
          ${kebeles.map(k=>`<option value="${k.id}">${k.name}</option>`).join("")}
        </select><span class="form-error"></span></div>
      <div class="form-group" style="grid-column:1/-1"><label>Assign Leader</label>
        <select class="form-control" id="az-leader">
          <option value="">No leader yet</option>
          ${leaders.map(l=>`<option value="${l.id}">${l.full_name} ${l.zone_name?"(has zone)":""}</option>`).join("")}
        </select></div>
      <div class="form-group" style="grid-column:1/-1"><label>Description</label>
        <textarea class="form-control" id="az-desc" rows="2"></textarea></div>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('add-zone-modal')">Cancel</button>
     <button class="btn btn-primary" id="az-save">💾 Create Zone</button>`
  );
  openModal("add-zone-modal");
  document.getElementById("az-save").addEventListener("click",async()=>{
    const name=document.getElementById("az-name").value.trim();
    const kebeleId=document.getElementById("az-kebele").value;
    if(!name||!kebeleId){toast("Name and Kebele required","error");return;}
    try{
      await API.createSaferZone({
        name,kebeleId,
        leaderId:document.getElementById("az-leader").value||null,
        description:document.getElementById("az-desc").value,
      });
      closeModal("add-zone-modal");
      toast("Zone created!","success");
      renderSettings();
    }catch(err){toast(err.message,"error");}
  });
}
