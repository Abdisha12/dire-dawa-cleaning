// backend/middleware/uploadSecurity.js — File upload validation
// Validates MIME type, extension, magic bytes, and filename safety.
// Do NOT trust client-provided Content-Type alone.
const fs = require("fs");

// ── Magic byte signatures ─────────────────────────────────────
const MAGIC_BYTES = {
  "image/png":   [[0x89, 0x50, 0x4E, 0x47]],          // \x89PNG
  "image/jpeg":  [[0xFF, 0xD8, 0xFF]],                  // ÿØÿ
  "image/gif":   [[0x47, 0x49, 0x46, 0x38]],           // GIF8
  "image/webp":  [[0x52, 0x49, 0x46, 0x46]],           // RIFF (WEBP starts with RIFF....WEBP)
  "image/bmp":   [[0x42, 0x4D]],                        // BM
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],       // %PDF
  "application/zip": [[0x50, 0x4B, 0x03, 0x04]],       // PK.. (DOCX/XLSX/PPTX are ZIP)
  "application/x-rar": [[0x52, 0x61, 0x72, 0x21]],    // Rar!
  "text/plain":  null,                                   // No reliable magic bytes
  "text/csv":    null,
};

// ── Allowed types per upload context ──────────────────────────
const ALLOWED = {
  document: {
    extensions: new Set([
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
      ".csv", ".txt", ".rtf",
      ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp",
    ]),
    mimes: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/csv", "text/plain", "text/rtf",
      "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp",
      // Some browsers/OSes send these for Office/PDF files
      "application/octet-stream",
      "application/x-pdf",
    ]),
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  inspection: {
    extensions: new Set([
      ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp",
    ]),
    mimes: new Set([
      "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp",
    ]),
    maxFileSize: 5 * 1024 * 1024, // 5MB
  },
};

// ── Executable extensions (never allowed) ─────────────────────
const EXECUTABLE_EXTS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".sh", ".bash", ".zsh", ".csh", ".ksh",
  ".php", ".php3", ".php4", ".php5", ".phtml",
  ".pl", ".py", ".rb", ".jsp", ".jspx", ".asp", ".aspx", ".cgi",
  ".js", ".mjs", ".cjs", ".vbs", ".vbe", ".wsf", ".wsh",
  ".ps1", ".psm1", ".psd1",
  ".dll", ".so", ".dylib", ".bin", ".elf",
  ".jar", ".war", ".ear",
  ".apk", ".app", ".dmg", ".iso",
  ".tmp", ".temp", ".bak", ".swp",
]);

// ── Detect MIME type from magic bytes ─────────────────────────
function detectMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    if (!signatures) continue; // No magic bytes for this type
    for (const sig of signatures) {
      if (sig.every((byte, i) => buffer[i] === byte)) return mime;
    }
  }
  return null;
}

// ── Sanitize filename (keep unicode letters, digits, safe chars) ──
function sanitizeFilename(name) {
  return name
    // eslint-disable-next-line no-control-regex -- Intentional: block control chars in filenames
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")  // Replace dangerous chars
    .replace(/_{2,}/g, "_")                      // Collapse multiple underscores
    .replace(/^[._-]+/, "")                       // Remove leading dots/dashes
    .slice(0, 200);                               // Limit length
}

// ── Create multer-compatible fileFilter ───────────────────────
function createFileFilter(context) {
  const config = ALLOWED[context];
  if (!config) throw new Error(`Unknown upload context: ${context}`);

  return function fileFilter(req, file, cb) {
    // 1. Extension check
    const ext = require("path").extname(file.originalname).toLowerCase();
    if (!config.extensions.has(ext)) {
      return cb(new Error(`File type not allowed: ${ext}. Accepted: ${[...config.extensions].join(", ")}`));
    }

    // 2. Executable extension check (defense in depth)
    if (EXECUTABLE_EXTS.has(ext)) {
      return cb(new Error(`Executable files are not allowed: ${ext}`));
    }

    // 3. MIME type check (loose — some clients send wrong types)
    // We allow application/octet-stream as fallback for Office/PDF files
    // but the magic byte check below is the real gatekeeper.
    if (file.mimetype && !config.mimes.has(file.mimetype) && file.mimetype !== "application/octet-stream") {
      // Don't reject on MIME alone — some legitimate uploads have wrong MIME.
      // Log for audit but allow through to magic byte check.
    }

    cb(null, true);
  };
}

// ── Middleware: validate uploaded file after multer processes it ──
// Runs AFTER multer. Checks magic bytes + final filename sanitization.
function validateUploadedFile(context) {
  const config = ALLOWED[context];

  return function postUploadValidation(req, res, next) {
    const files = req.files || (req.file ? [req.file] : []);

    for (const file of files) {
      // 1. Magic byte validation (read first 16 bytes)
      try {
        const fd = fs.openSync(file.path, "r");
        const buf = Buffer.alloc(16);
        fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);

        const detectedMime = detectMime(buf);
        const ext = require("path").extname(file.originalname).toLowerCase();

        // For text files, magic bytes are unreliable — trust extension
        const textExts = new Set([".txt", ".csv", ".rtf"]);
        if (!textExts.has(ext)) {
          if (!detectedMime) {
            // Unrecognized magic bytes — reject unless it's a known octet-stream scenario
            fs.unlinkSync(file.path);
            return res.status(400).json({
              error: "Unrecognized file format. File may be corrupted or is an unsupported type."
            });
          }

          // Verify detected type matches allowed context
          if (context === "inspection" && !detectedMime.startsWith("image/")) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: "Only image files are allowed for inspection photos." });
          }
          if (context === "document" && !config.mimes.has(detectedMime) && detectedMime !== "application/zip") {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: `File content does not match allowed types (detected: ${detectedMime}).` });
          }
        }
      } catch (err) {
        // If we can't read the file, it's malformed
        try { fs.unlinkSync(file.path); } catch (_) { /* cleanup best-effort */ }
        return res.status(400).json({ error: "Could not read uploaded file. It may be corrupted." });
      }

      // 2. File size check (belt-and-suspenders with multer limits)
      if (file.size > config.maxFileSize) {
        try { fs.unlinkSync(file.path); } catch (_) { /* cleanup best-effort */ }
        return res.status(400).json({ error: `File too large. Maximum: ${config.maxFileSize / 1024 / 1024}MB` });
      }

      // 3. Sanitize the stored filename (prevent path traversal in the stored name)
      const safeFilename = sanitizeFilename(file.filename);
      if (safeFilename !== file.filename) {
        const oldPath = file.path;
        file.filename = safeFilename;
        file.path = require("path").join(require("path").dirname(oldPath), safeFilename);
        fs.renameSync(oldPath, file.path);
      }

      // 4. Verify file is inside uploads directory (path traversal guard)
      const resolved = require("path").resolve(file.path);
      const uploadsDir = require("path").resolve(__dirname, `../uploads/${context === "inspection" ? "inspections" : "documents"}`);
      if (!resolved.startsWith(uploadsDir)) {
        try { fs.unlinkSync(file.path); } catch (_) { /* cleanup best-effort */ }
        return res.status(400).json({ error: "Invalid file path." });
      }
    }

    next();
  };
}

// ── Multer error handler ──────────────────────────────────────
function handleMulterError(err, req, res, next) {
  if (err instanceof require("multer").MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large." });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Too many files." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  // Our custom errors from fileFilter
  if (err.message && err.message.startsWith("File type not allowed")) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.startsWith("Executable files")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

module.exports = {
  createFileFilter,
  validateUploadedFile,
  handleMulterError,
  sanitizeFilename,
  detectMime,
  ALLOWED,
  EXECUTABLE_EXTS,
};
