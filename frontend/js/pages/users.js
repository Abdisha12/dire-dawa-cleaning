let _usersData=[];

async function renderUsers(){
  const content=document.getElementById("page-content");
  if(!API.hasRole("admin")){content.innerHTML=`<div class="empty"><div class="icon">🔒</div><p>Admin access required</p></div>`;return;}
  content.innerHTML=spinnerHTML;
  try{
    _usersData=await API.getUsers();
    const me=API.getUser();
    content.innerHTML=`
      <div class="hierarchy-chain">
        <span class="node">🔴 Admin (full control)</span><span class="arrow">→</span>
        <span class="node">🔵 Collector (manages kebele)</span><span class="arrow">→</span>
        <span class="node">🟣 Leader (manages zone)</span><span class="arrow">→</span>
        <span class="node">👁 Viewer (read-only)</span>
      </div>
      <div class="toolbar">
        <select class="form-control" id="usr-filter-role" style="width:150px">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="collector">Collector</option>
          <option value="leader">Leader</option>
          <option value="viewer">Viewer</option>
        </select>
        <input class="search-input" id="usr-search" placeholder="🔍 Search users…">
        <div class="toolbar-right">
          <button class="btn btn-primary" id="btn-add-user">＋ Add User</button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table id="usr-table">
            <thead><tr>
              <th>Username</th><th>Full Name</th><th>Phone</th><th>Fayda/ID</th>
              <th>Role</th><th>Zone (if leader)</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody id="usr-tbody"></tbody>
          </table>
        </div>
      </div>`;
    await renderUserRows(me);
    document.getElementById("usr-search")?.addEventListener("input",e=>filterTable("usr-table",e.target.value));
    document.getElementById("usr-filter-role")?.addEventListener("change",async e=>{
      _usersData=await API.getUsers(e.target.value?{role:e.target.value}:{});
      await renderUserRows(me);
    });
    document.getElementById("btn-add-user")?.addEventListener("click",()=>openUserModal(null,me));
  }catch(err){
    content.innerHTML=`<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function renderUserRows(me){
  const tbody=document.getElementById("usr-tbody");if(!tbody)return;
  if(!_usersData.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="icon">👥</div><p>No users</p></div></td></tr>`;return;}

  // fetch zones to show leader assignments
  let zones=[];
  try{zones=await API.getSaferZones();}catch{}

  tbody.innerHTML=_usersData.map(u=>{
    const zone=zones.find(z=>z.leader_id===u.id);
    return `<tr>
      <td><strong>${escapeHtml(u.username)}</strong> ${u.id===me?.id?'<span class="badge badge-blue" style="font-size:.65rem">You</span>':""}</td>
      <td>${escapeHtml(u.full_name)}</td>
      <td>${escapeHtml(u.phone||"—")}</td>
      <td>${escapeHtml(u.fayda_id||"—")}</td>
      <td>${statusBadge(u.role)}</td>
      <td>${u.role==="leader"?(zone?`<span class="badge badge-purple">${escapeHtml(zone.name)}</span>`:'<span style="color:var(--orange)">⚠ Unassigned</span>'):"—"}</td>
      <td>${u.is_active?statusBadge("active"):'<span class="badge badge-gray">Inactive</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="openUserModal(${u.id})">✏️</button>
        <button class="btn btn-sm btn-outline" onclick="openChangePassword(${u.id},${escapeJsStr(u.username)})">🔑</button>
        ${u.id!==me?.id?`<button class="btn btn-sm btn-danger" style="margin-left:.3rem" onclick="deleteUser(${u.id})">🗑</button>`:""}
      </td>
    </tr>`;
  }).join("");
}

function openUserModal(id,meArg){
  const me=meArg||API.getUser();
  const u=id?_usersData.find(x=>x.id===id):null;
  buildModal("user-modal",id?"Edit User":"Add User",`
    <form id="user-form" class="form-grid">
      <div class="form-group"><label>Username *</label>
        <input class="form-control" id="uf-username" value="${escapeAttr(u?.username||"")}" ${id?'readonly style="background:var(--gray-100)"':""} required>
        <span class="form-error"></span></div>
      ${!id?`<div class="form-group"><label>Password *</label>
        <input class="form-control" id="uf-password" type="password" minlength="6" required>
        <span class="form-error"></span></div>`:""}
      <div class="form-group"><label>Full Name *</label>
        <input class="form-control" id="uf-fullname" value="${escapeAttr(u?.full_name||"")}" required>
        <span class="form-error"></span></div>
      <div class="form-group"><label>Phone</label>
        <input class="form-control" id="uf-phone" value="${escapeAttr(u?.phone||"")}"></div>
      <div class="form-group"><label>Fayda/National ID</label>
        <input class="form-control" id="uf-fayda" value="${escapeAttr(u?.fayda_id||"")}">
        <span class="form-error"></span></div>
      <div class="form-group"><label>Role *</label>
        <select class="form-control" id="uf-role" required>
          <option value="viewer" ${u?.role==="viewer"?"selected":""}>Viewer (read-only)</option>
          <option value="leader" ${u?.role==="leader"?"selected":""}>Zone Leader</option>
          <option value="collector" ${u?.role==="collector"?"selected":""}>Collector</option>
          <option value="admin" ${u?.role==="admin"?"selected":""}>Admin</option>
        </select></div>
      ${id?`<div class="form-group"><label>Status</label>
        <select class="form-control" id="uf-active">
          <option value="1" ${u?.is_active!=0?"selected":""}>Active</option>
          <option value="0" ${u?.is_active==0?"selected":""}>Inactive</option>
        </select></div>`:""}
    </form>
    <div style="margin-top:.75rem;padding:.75rem;background:var(--blue-l);border-radius:6px;font-size:.78rem;color:var(--blue)">
      ℹ️ <strong>Role hierarchy:</strong><br>
      🔴 <strong>Admin</strong> — full system control, manages collectors & leaders<br>
      🔵 <strong>Collector</strong> — oversees a kebele, reviews zone leader reports<br>
      🟣 <strong>Leader</strong> — manages workers/tools/reports for ONE assigned zone<br>
      👁 <strong>Viewer</strong> — read-only dashboards & reports<br><br>
      After creating a Leader, assign them to a zone in <strong>Settings → Zone Assignment</strong>.
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('user-modal')">Cancel</button>
     <button class="btn btn-primary" id="user-save">💾 Save User</button>`,true
  );
  openModal("user-modal");
  document.getElementById("user-save").addEventListener("click",async()=>{
    const faydaVal = document.getElementById("uf-fayda").value.trim();
    if (faydaVal) {
      if (!validateFaydaId(faydaVal)) {
        const faydaInp = document.getElementById("uf-fayda");
        faydaInp.classList.add("error");
        const err = faydaInp.parentElement.querySelector(".form-error");
        if (err) err.textContent = "Must be exactly 12 digits";
        toast("Fayda ID must be exactly 12 digits", "error");
        return;
      } else {
        const faydaInp = document.getElementById("uf-fayda");
        faydaInp.classList.remove("error");
        const err = faydaInp.parentElement.querySelector(".form-error");
        if (err) err.textContent = "";
      }
    }

    if(!validateForm(document.getElementById("user-form"))) return;
    const payload={
      username:document.getElementById("uf-username").value.trim(),
      fullName:document.getElementById("uf-fullname").value.trim(),
      phone:document.getElementById("uf-phone").value.trim(),
      faydaId:faydaVal ? faydaVal.replace(/[\s-]/g, "") : null,
      role:document.getElementById("uf-role").value,
      isActive:id?document.getElementById("uf-active").value==="1":true,
    };
    if(!id) payload.password=document.getElementById("uf-password").value;
    try{
      if(id) await API.updateUser(id,payload);
      else   await API.createUser(payload);
      closeModal("user-modal");
      toast(id?"User updated":"User created — now assign a zone in Settings if Leader","success");
      _usersData=await API.getUsers();await renderUserRows(me);
    }catch(err){toast(escapeHtml(err.message),"error");}
  });
}

function openChangePassword(id,username){
  const isSelf=API.getUser()?.id===id;
  const needCurrentPassword=isSelf;
  buildModal("pw-modal",`🔑 Change Password — ${escapeHtml(username)}`,`
    <div class="form-grid">
      ${needCurrentPassword?`<div class="form-group" style="grid-column:1/-1"><label>Current Password *</label>
        <input class="form-control" id="pw-current" type="password" required>
        <span class="form-error"></span></div>`:""}
      <div class="form-group" style="grid-column:1/-1"><label>New Password * (min 8 chars, letter + number)</label>
        <input class="form-control" id="pw-new" type="password" minlength="8" required>
        <span class="form-error"></span></div>
      <div class="form-group" style="grid-column:1/-1"><label>Confirm Password *</label>
        <input class="form-control" id="pw-confirm" type="password" required>
        <span class="form-error"></span></div>
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal('pw-modal')">Cancel</button>
     <button class="btn btn-danger" id="pw-save">🔑 Change Password</button>`
  );
  openModal("pw-modal");
  document.getElementById("pw-save").addEventListener("click",async()=>{
    const cp=needCurrentPassword?document.getElementById("pw-current").value:undefined;
    const np=document.getElementById("pw-new").value,cf=document.getElementById("pw-confirm").value;
    if(np.length<8){toast("Min 8 characters","error");return;}
    if(!/[a-zA-Z]/.test(np)){toast("Must contain at least one letter","error");return;}
    if(!/[0-9]/.test(np)){toast("Must contain at least one number","error");return;}
    if(np!==cf){toast("Passwords do not match","error");return;}
    try{await API.changePassword(id,{currentPassword:cp,newPassword:np,confirmPassword:cf});closeModal("pw-modal");toast("Password changed!","success");}
    catch(err){toast(escapeHtml(err.message),"error");}
  });
}

async function deleteUser(id){
  const u=_usersData.find(x=>x.id===id);
  if(!await confirmDialog(`Delete user "${escapeHtml(u?.username)}"? This cannot be undone.`)) return;
  try{
    await API.deleteUser(id);toast("User deleted","success");
    _usersData=_usersData.filter(x=>x.id!==id);await renderUserRows(API.getUser());
  }catch(err){toast(escapeHtml(err.message),"error");}
}
