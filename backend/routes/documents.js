// backend/routes/documents.js — Document & File Management API
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");
const audit = require("../services/auditService");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/documents");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `doc_${Date.now()}_${safeName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Middleware for token in query param when downloading files directly in browser tab
function authParamOrHeader(req, res, next) {
  if (req.query.token && !req.headers["x-session-token"]) {
    req.headers["x-session-token"] = req.query.token;
  }
  authenticate(req, res, next);
}

router.use(authParamOrHeader);

// GET /api/documents — list documents with category, zone, kebele filters & search
router.get("/", async (req, res, next) => {
  try {
    const { category, saferZoneId, kebeleId, search } = req.query;
    let sql = `SELECT d.*, u.full_name AS uploader_name, sz.name AS zone_name, k.name AS kebele_name
               FROM documents d
               JOIN users u ON u.id = d.uploaded_by
               LEFT JOIN safer_zones sz ON sz.id = d.safer_zone_id
               LEFT JOIN kebeles k ON k.id = d.kebele_id
               WHERE 1=1`;
    const params = [];

    if (req.user.role === "leader") {
      sql += " AND sz.leader_id = ?";
      params.push(req.user.id);
    } else {
      if (saferZoneId) { sql += " AND d.safer_zone_id = ?"; params.push(saferZoneId); }
      if (kebeleId) { sql += " AND d.kebele_id = ?"; params.push(kebeleId); }
    }

    if (category) { sql += " AND d.category = ?"; params.push(category); }
    if (search) {
      sql += " AND (d.title LIKE ? OR d.description LIKE ? OR d.file_name LIKE ?)";
      const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const q = `%${escaped}%`;
      params.push(q, q, q);
    }

    sql += " ORDER BY d.created_at DESC";
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/documents — upload document with metadata
router.post("/", requireRole("admin", "collector", "leader"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File upload required" });
    const { title, description, category, saferZoneId, kebeleId } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });

    const relativePath = `/uploads/documents/${req.file.filename}`;

    const [r] = await db.execute(
      `INSERT INTO documents (title, description, category, file_path, file_name, file_size, mime_type, safer_zone_id, kebele_id, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        category || "other",
        relativePath,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        saferZoneId || null,
        kebeleId || null,
        req.user.id
      ]
    );

    audit.log(req, "CREATE", "document", r.insertId, null, { title, category, fileName: req.file.originalname });
    res.status(201).json({ id: r.insertId, title, category, filePath: relativePath });
  } catch (err) { next(err); }
});

// GET /api/documents/:id/download — download/stream file
router.get("/:id/download", async (req, res, next) => {
  try {
    const [rows] = await db.execute("SELECT * FROM documents WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Document not found" });
    const doc = rows[0];
    const fullPath = path.join(__dirname, "..", doc.file_path);

    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "File missing on disk" });

    res.download(fullPath, doc.file_name);
  } catch (err) { next(err); }
});

// PUT /api/documents/:id — update metadata
router.put("/:id", requireRole("admin", "collector", "leader"), async (req, res, next) => {
  try {
    const { title, description, category } = req.body;
    await db.execute(
      "UPDATE documents SET title = ?, description = ?, category = ? WHERE id = ?",
      [title, description || null, category, req.params.id]
    );
    audit.log(req, "UPDATE", "document", parseInt(req.params.id), null, { title, category });
    res.json({ message: "Updated" });
  } catch (err) { next(err); }
});

// DELETE /api/documents/:id — delete file & record
router.delete("/:id", requireRole("admin", "collector"), async (req, res, next) => {
  try {
    const [rows] = await db.execute("SELECT * FROM documents WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const doc = rows[0];

    const fullPath = path.join(__dirname, "..", doc.file_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    await db.execute("DELETE FROM documents WHERE id = ?", [req.params.id]);
    audit.log(req, "DELETE", "document", parseInt(req.params.id), { title: doc.title }, null);
    res.json({ message: "Deleted" });
  } catch (err) { next(err); }
});

module.exports = router;
