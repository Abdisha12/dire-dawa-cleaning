// frontend/js/utils.js

function toast(msg,type="info",duration=3500){
  let c=document.getElementById("toast-container");
  if(!c){c=document.createElement("div");c.id="toast-container";document.body.appendChild(c);}
  const el=document.createElement("div");
  el.className=`toast toast-${type}`;
  el.innerHTML=`<span>${{success:"✅",error:"❌",info:"ℹ️"}[type]||""}</span><span>${msg}</span>`;
  c.appendChild(el);setTimeout(()=>el.remove(),duration);
}

function confirmDialog(msg){
  return new Promise(resolve=>{
    const o=document.createElement("div");o.className="modal-overlay";
    o.innerHTML=`<div class="modal" style="max-width:360px">
      <div class="modal-header"><h3>Confirm</h3></div>
      <div class="modal-body"><p>${msg}</p></div>
      <div class="modal-footer">
        <button class="btn btn-outline" id="cc">Cancel</button>
        <button class="btn btn-danger" id="co">Confirm</button>
      </div></div>`;
    document.body.appendChild(o);
    o.querySelector("#cc").onclick=()=>{o.remove();resolve(false);};
    o.querySelector("#co").onclick=()=>{o.remove();resolve(true);};
  });
}

function openModal(id){document.getElementById(id)?.classList.remove("hidden");}
function closeModal(id){document.getElementById(id)?.classList.add("hidden");}

function buildModal(id,title,bodyHTML,footerHTML="",large=false){
  let el=document.getElementById(id);
  if(!el){el=document.createElement("div");el.id=id;document.body.appendChild(el);}
  el.className="modal-overlay hidden";
  el.innerHTML=`<div class="modal ${large?"modal-lg":""}">
    <div class="modal-header"><h3>${title}</h3><button class="btn-icon" onclick="closeModal('${id}')">✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
    ${footerHTML?`<div class="modal-footer">${footerHTML}</div>`:""}
  </div>`;
  el.addEventListener("click",e=>{if(e.target===el)closeModal(id);});
  return el;
}

function validateForm(formEl){
  let valid=true;
  formEl.querySelectorAll("[required]").forEach(inp=>{
    const err=inp.parentElement.querySelector(".form-error");
    if(!inp.value.trim()){inp.classList.add("error");if(err)err.textContent="Required";valid=false;}
    else{inp.classList.remove("error");if(err)err.textContent="";}
  });
  return valid;
}

function statusBadge(s){
  const m={
    paid:["badge-green","✓ Paid"],pending:["badge-orange","⏳ Pending"],overdue:["badge-red","⚠ Overdue"],
    active:["badge-green","● Active"],warning:["badge-orange","⚠ Warning"],danger:["badge-red","🔴 Danger"],
    admin:["badge-red","Admin"],collector:["badge-blue","Collector"],
    leader:["badge-purple","Leader"],viewer:["badge-gray","Viewer"],
    draft:["badge-gray","Draft"],submitted:["badge-blue","Submitted"],
    reviewed:["badge-orange","Reviewed"],approved:["badge-green","Approved"],
    good:["badge-green","Good"],fair:["badge-orange","Fair"],
    poor:["badge-red","Poor"],broken:["badge-red","Broken"],
  };
  const [cls,label]=m[s]||["badge-gray",s];
  return `<span class="badge ${cls}">${label}</span>`;
}

function fmtETB(n){return "ETB "+parseFloat(n||0).toLocaleString("en-ET",{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtDate(d){if(!d)return "—";return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function monthName(m){return["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]||m;}

function paginate(data,page,perPage=25){
  const total=data.length,pages=Math.ceil(total/perPage),slice=data.slice((page-1)*perPage,page*perPage);
  return{slice,total,pages};
}

function renderPagination(containerId,currentPage,totalPages,onPage){
  const el=document.getElementById(containerId);
  if(!el||totalPages<=1){if(el)el.innerHTML="";return;}
  let html="";
  for(let i=1;i<=totalPages;i++) html+=`<button class="page-btn ${i===currentPage?"active":""}" data-p="${i}">${i}</button>`;
  el.innerHTML=html;
  el.querySelectorAll(".page-btn").forEach(btn=>btn.addEventListener("click",()=>onPage(parseInt(btn.dataset.p))));
}

function filterTable(tableId,searchVal){
  const tbody=document.querySelector(`#${tableId} tbody`);if(!tbody)return;
  const q=searchVal.toLowerCase();
  tbody.querySelectorAll("tr").forEach(tr=>{tr.style.display=tr.textContent.toLowerCase().includes(q)?"":"none";});
}

function downloadCSV(url){const a=document.createElement("a");a.href=url;a.target="_blank";document.body.appendChild(a);a.click();a.remove();}

const spinnerHTML=`<div class="loading-overlay"><div class="spinner"></div> Loading…</div>`;

// Role-aware hierarchy banner shown on leader pages
function leaderBanner(){
  const user=API.getUser();
  const zone=user?.zone;
  if(!zone) return "";
  return `<div class="leader-info">
    🏷️ <strong>Your Zone:</strong> ${zone.name} &nbsp;|&nbsp;
    📍 <strong>Kebele:</strong> ${zone.kebele_name} &nbsp;|&nbsp;
    👤 You manage workers, tools, and reports for this zone only.
  </div>`;
}

function validateFaydaId(val) {
  if (!val) return true;
  const clean = val.replace(/[\s-]/g, "");
  return /^\d{12}$/.test(clean);
}

function formatFaydaId(val) {
  if (!val) return "";
  const clean = val.replace(/[\s-]/g, "");
  if (/^\d{12}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  }
  return val;
}

