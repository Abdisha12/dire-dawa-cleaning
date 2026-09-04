// backend/routes/documents.js — Document & File Management API
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("../config/db");
const audit = require("../services/auditService");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const schemas = require("../middleware/schemas");
const { createFileFilter, validateUploadedFile, handleMulterError } = require("../middleware/uploadSecurity");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/documents");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: createFileFilter("document"),
});

router.use(authenticate);

// GET /api/documents — list documents with category, zone, kebele filters & search
router.get("/", validate(schemas.documentListQuery, "query"), async (req, res, next) => {
  try {
    const { category, saferZoneId, kebeleId, search } = req.query;
    // Zod coerce.number will convert valid int strings; id primitive ensures int positive
    const szId = saferZoneId ? Number(saferZoneId) : null;
    const kbId = kebeleId ? Number(kebeleId) : null;
    let sql = `SELECT d.*, u.full_name AS uploader_name, sz.name AS zone_name, k.name AS kebele_name
               FROM documents d
               JOIN users u ON u.id = d.uploaded_by
               LEFT JOIN safer_zones sz ON sz.id = d.safer_zone_id
               LEFT JOIN kebeles k ON k.id = d.kebele_id
               WHERE 1=1`;
    const params = [];
    let paramIdx = 1;

    if (req.user.role === "leader") {
      sql += ` AND sz.leader_id = $${paramIdx}`;
      params.push(req.user.id);
      paramIdx++;
    } else {
      if (szId) { sql += ` AND d.safer_zone_id = $${paramIdx}`; params.push(szId); paramIdx++; }
      if (kbId) { sql += ` AND d.kebele_id = $${paramIdx}`; params.push(kbId); paramIdx++; }
    }

    if (category) { sql += ` AND d.category = $${paramIdx}`; params.push(category); paramIdx++; }
    if (search) {
      sql += ` AND (d.title LIKE $${paramIdx} OR d.description LIKE $${paramIdx + 1} OR d.file_name LIKE $${paramIdx + 2})`;
      const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const q = `%${escaped}%`;
      params.push(q, q, q);
      paramIdx += 3;
    }

    sql += " ORDER BY d.created_at DESC";
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/documents — upload document with metadata
router.post("/", requireRole("admin", "collector", "leader"),
  upload.single("file"),
  validateUploadedFile("document"),
  handleMulterError,
  async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File upload required" });
    const { title, description, category, saferZoneId, kebeleId } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });

    const relativePath = `/uploads/documents/${req.file.filename}`;

    const r = await db.query(
      `INSERT INTO documents (title, description, category, file_path, file_name, file_size, mime_type, safer_zone_id, kebele_id, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
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
    const insertedId = r.rows[0].id;

    audit.log(req, "CREATE", "document", insertedId, null, { title, category, fileName: req.file.originalname });
    res.status(201).json({ id: insertedId, title, category, filePath: relativePath });
  } catch (err) { next(err); }
});

// GET /api/documents/:id/download — download/stream file
router.get("/:id/download", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Document not found" });
    const doc = result.rows[0];
    const fullPath = path.join(__dirname, "..", doc.file_path);

    const resolved = path.resolve(fullPath);
    const uploadsDir = path.resolve(__dirname, "../uploads/documents");
    if (!resolved.startsWith(uploadsDir)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "File missing on disk" });

    res.download(fullPath, doc.file_name);
  } catch (err) { next(err); }
});

// PUT /api/documents/:id — update metadata
router.put("/:id", requireRole("admin", "collector", "leader"), validate(schemas.updateDocument), async (req, res, next) => {
  try {
    const { title, description, category } = req.body;
    await db.query(
      "UPDATE documents SET title = $1, description = $2, category = $3 WHERE id = $4",
      [title, description || null, category, req.params.id]
    );
    audit.log(req, "UPDATE", "document", parseInt(req.params.id), null, { title, category });
    res.json({ message: "Updated" });
  } catch (err) { next(err); }
});

// DELETE /api/documents/:id — delete file & record
router.delete("/:id", requireRole("admin", "collector"), async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    const doc = result.rows[0];

    const fullPath = path.join(__dirname, "..", doc.file_path);
    const resolved = path.resolve(fullPath);
    const uploadsDir = path.resolve(__dirname, "../uploads/documents");
    if (resolved.startsWith(uploadsDir) && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    await db.query("DELETE FROM documents WHERE id = $1", [req.params.id]);
    audit.log(req, "DELETE", "document", parseInt(req.params.id), { title: doc.title }, null);
    res.json({ message: "Deleted" });
  } catch (err) { next(err); }
});

module.exports = router;
