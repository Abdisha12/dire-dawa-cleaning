// frontend/js/pages/documents.js — Document & File Management Page

async function renderDocuments() {
  const content = document.getElementById("page-content");
  content.innerHTML = spinnerHTML;

  try {
    const [kebeles, zones] = await Promise.all([
      API.getKebeles().catch(() => []),
      API.getSaferZones().catch(() => [])
    ]);

    let activeCategory = "";

    content.innerHTML = `
      <div class="card" style="margin-bottom:1rem">
        <div class="card-title">
          <span>📁 Document & File Management</span>
          ${API.hasRole("admin", "collector", "leader") ? `<button class="btn btn-primary" id="btn-upload-doc">＋ Upload Document</button>` : ""}
        </div>

        <div style="display:flex;gap:.5rem;margin-bottom:1rem;overflow-x:auto;padding-bottom:.3rem">
          <button class="btn btn-sm btn-primary cat-tab" data-cat="">All Documents</button>
          <button class="btn btn-sm btn-outline cat-tab" data-cat="contract">📄 Contracts</button>
          <button class="btn btn-sm btn-outline cat-tab" data-cat="photo">🖼 Zone Photos</button>
          <button class="btn btn-sm btn-outline cat-tab" data-cat="training">🎓 Training</button>
          <button class="btn btn-sm btn-outline cat-tab" data-cat="incident">⚠️ Incidents</button>
          <button class="btn btn-sm btn-outline cat-tab" data-cat="report">📝 Reports</button>
          <button class="btn btn-sm btn-outline cat-tab" data-cat="other">📎 Other</button>
        </div>

        <div class="toolbar">
          <input type="text" class="search-input" id="doc-search" placeholder="🔍 Search document title or keywords..." style="flex:1">
          <select class="form-control" id="doc-zone-filter" style="width:180px">
            <option value="">All Zones</option>
            ${zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join("")}
          </select>
        </div>
      </div>

      <div id="doc-grid-container"></div>
    `;

    document.querySelectorAll(".cat-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".cat-tab").forEach(t => {
          t.classList.remove("btn-primary");
          t.classList.add("btn-outline");
        });
        tab.classList.remove("btn-outline");
        tab.classList.add("btn-primary");
        activeCategory = tab.dataset.cat;
        loadDocs();
      });
    });

    document.getElementById("doc-search").addEventListener("input", debounce(() => loadDocs(), 300));
    document.getElementById("doc-zone-filter").addEventListener("change", () => loadDocs());

    const btnUp = document.getElementById("btn-upload-doc");
    if (btnUp) {
      btnUp.addEventListener("click", () => openUploadDocModal(kebeles, zones));
    }

    async function loadDocs() {
      const container = document.getElementById("doc-grid-container");
      if (!container) return;
      container.innerHTML = spinnerHTML;

      const search = document.getElementById("doc-search")?.value.trim() || "";
      const saferZoneId = document.getElementById("doc-zone-filter")?.value || "";

      try {
        const docs = await API.getDocuments({ category: activeCategory, search, saferZoneId });
        renderDocCards(docs);
      } catch (err) {
        container.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
      }
    }

    function renderDocCards(docs) {
      const container = document.getElementById("doc-grid-container");
      if (!container) return;

      if (!docs.length) {
        container.innerHTML = `<div class="empty"><div class="icon">📂</div><p>No documents found matching your criteria.</p></div>`;
        return;
      }

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">
          ${docs.map(d => {
            const catIcons = {
              contract: "📄", photo: "🖼️", training: "🎓", incident: "⚠️", report: "📝", other: "📎"
            };
            const icon = catIcons[d.category] || "📎";
            const sizeMB = (d.file_size / (1024 * 1024)).toFixed(2);
            const isImage = d.mime_type?.startsWith("image/");

            return `
              <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
                <div>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
                    <span style="font-size:1.4rem">${icon}</span>
                    <span class="badge badge-purple" style="text-transform:capitalize">${escapeHtml(d.category)}</span>
                  </div>

                  ${isImage ? `<div style="height:120px;margin-bottom:.5rem;overflow:hidden;border-radius:6px;background:var(--gray-100)">
                    <img src="${escapeAttr(d.file_path)}" style="width:100%;height:100%;object-fit:cover">
                  </div>` : ""}

                  <h4 style="font-size:.9rem;font-weight:700;margin-bottom:.3rem;line-clamp:2">${escapeHtml(d.title)}</h4>
                  <p style="font-size:.78rem;color:var(--gray-500);margin-bottom:.75rem;line-height:1.4">${escapeHtml(d.description || "No description provided.")}</p>
                </div>

                <div style="border-top:1px solid var(--gray-100);padding-top:.6rem;font-size:.72rem;color:var(--gray-500)">
                  <div style="display:flex;justify-content:space-between;margin-bottom:.4rem">
                    <span>${escapeHtml(d.file_name)}</span>
                    <span>${sizeMB} MB</span>
                  </div>
                  <div style="margin-bottom:.6rem">Uploaded by <strong>${escapeHtml(d.uploader_name)}</strong> on ${fmtDate(d.created_at)}</div>
                  <div style="display:flex;gap:.4rem">
                    <button class="btn btn-sm btn-primary" style="flex:1;justify-content:center" onclick="API.downloadFile('${API.documentDownloadUrl(d.id)}','${escapeJsStr(d.file_name)}').catch(e=>toast(e.message,'error'))">⬇ Download</button>
                    ${API.hasRole("admin", "collector") ? `<button class="btn btn-sm btn-danger" onclick="deleteDocSingle(${d.id})">🗑</button>` : ""}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    loadDocs();
  } catch (err) {
    content.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function openUploadDocModal(kebeles, zones) {
  buildModal("upload-doc-modal", "＋ Upload Document", `
    <form id="upload-doc-form">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label>Document Title *</label>
          <input class="form-control" id="ud-title" required placeholder="e.g. Zone Cleaning Contract 2026">
        </div>
        <div class="form-group">
          <label>Category *</label>
          <select class="form-control" id="ud-cat" required>
            <option value="contract">Contract</option>
            <option value="photo">Zone Photo</option>
            <option value="training">Training Material</option>
            <option value="incident">Incident Report</option>
            <option value="report">Report</option>
            <option value="other" selected>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Associate Zone</label>
          <select class="form-control" id="ud-zone">
            <option value="">None / System Wide</option>
            ${zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Select File (Max 10MB) *</label>
          <input type="file" class="form-control" id="ud-file" required>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Description / Notes</label>
          <textarea class="form-control" id="ud-desc" rows="3" placeholder="Optional notes..."></textarea>
        </div>
      </div>
    </form>
  `, `
    <button class="btn btn-outline" onclick="closeModal('upload-doc-modal')">Cancel</button>
    <button class="btn btn-primary" id="btn-save-doc">📤 Upload</button>
  `);

  openModal("upload-doc-modal");

  document.getElementById("btn-save-doc").onclick = async () => {
    const title = document.getElementById("ud-title").value.trim();
    const file = document.getElementById("ud-file").files[0];
    if (!title || !file) {
      toast("Title and file are required", "error");
      return;
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("category", document.getElementById("ud-cat").value);
    fd.append("saferZoneId", document.getElementById("ud-zone").value);
    fd.append("description", document.getElementById("ud-desc").value);
    fd.append("file", file);

    try {
      toast("Uploading document...", "info");
      await API.uploadDocument(fd);
      closeModal("upload-doc-modal");
      toast("Document uploaded successfully!", "success");
      renderDocuments();
    } catch (err) { toast(escapeHtml(err.message), "error"); }
  };
}

async function deleteDocSingle(id) {
  if (!await confirmDialog("Delete this document permanently?")) return;
  try {
    await API.deleteDocument(id);
    toast("Document deleted", "info");
    renderDocuments();
  } catch (err) { toast(err.message, "error"); }
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
