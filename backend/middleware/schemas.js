// backend/middleware/schemas.js — Zod validation schemas for all high-risk endpoints
const { z } = require("zod");

// ── Reusable primitives ───────────────────────────────────────
const id = z.coerce.number().int().positive();
const month = z.coerce.number().int().min(1).max(12);
const year = z.coerce.number().int().min(2020).max(2100);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};

// ── Auth ──────────────────────────────────────────────────────
const login = {
  body: z.object({
    username: z.string().min(1).max(60).trim(),
    password: z.string().min(1).max(200),
  }),
};

// ── Users ─────────────────────────────────────────────────────
const createUser = {
  body: z.object({
    username: z.string().min(3).max(60).trim(),
    password: z.string().min(8).max(200),
    fullName: z.string().min(1).max(120).trim(),
    faydaId: z.string().max(50).trim().optional().nullable(),
    phone: z.string().max(30).trim().optional().nullable(),
    role: z.enum(["admin", "collector", "leader", "viewer"]),
  }),
};

const updateUser = {
  body: z.object({
    fullName: z.string().min(1).max(120).trim(),
    faydaId: z.string().max(50).trim().optional().nullable(),
    phone: z.string().max(30).trim().optional().nullable(),
    role: z.enum(["admin", "collector", "leader", "viewer"]),
    isActive: z.boolean(),
  }),
  params: z.object({ id }),
};

const changePassword = {
  body: z.object({
    currentPassword: z.string().max(200).optional(),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().max(200).optional(),
  }).refine(data => !data.confirmPassword || data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
  params: z.object({ id }),
};

// ── Locations ─────────────────────────────────────────────────
const updateKebele = {
  body: z.object({
    name: z.string().min(1).max(80).trim(),
    collectorId: z.coerce.number().int().positive().optional().nullable(),
  }),
  params: z.object({ id }),
};

const createZone = {
  body: z.object({
    name: z.string().min(1).max(80).trim(),
    kebeleId: id,
    leaderId: z.coerce.number().int().positive().optional().nullable(),
  }),
};

const updateZone = {
  body: z.object({
    name: z.string().min(1).max(80).trim(),
    leaderId: z.coerce.number().int().positive().optional().nullable(),
  }),
  params: z.object({ id }),
};

// ── Businesses ────────────────────────────────────────────────
const createBusiness = {
  body: z.object({
    name: z.string().min(1).max(120).trim(),
    ownerName: z.string().max(120).trim().optional().nullable(),
    ownerFaydaId: z.string().max(50).trim().optional().nullable(),
    type: z.string().max(40).trim().optional().nullable(),
    monthlyTarget: z.coerce.number().min(0).optional(),
    saferZoneId: id,
    kebeleId: id.optional(),
    notes: z.string().max(2000).trim().optional().nullable(),
  }),
};

const updateBusiness = {
  body: z.object({
    name: z.string().min(1).max(120).trim(),
    ownerName: z.string().max(120).trim().optional().nullable(),
    ownerFaydaId: z.string().max(50).trim().optional().nullable(),
    type: z.string().max(40).trim().optional().nullable(),
    monthlyTarget: z.coerce.number().min(0).optional(),
    saferZoneId: id.optional(),
    notes: z.string().max(2000).trim().optional().nullable(),
  }),
  params: z.object({ id }),
};

// ── Payments ──────────────────────────────────────────────────
const createPayment = {
  body: z.object({
    businessId: id,
    amount: z.coerce.number().positive().max(10000000),
    method: z.string().max(30).trim().optional(),
    month,
    year,
    notes: z.string().max(1000).trim().optional().nullable(),
    gateway: z.enum(["telebirr", "cbebirr"]).optional(),
  }),
};

const updatePayment = {
  body: z.object({
    status: z.enum(["pending", "paid", "overdue"]).optional(),
    notes: z.string().max(1000).trim().optional().nullable(),
  }),
  params: z.object({ id }),
};

const dashboardQuery = z.object({
  month: month.optional(),
  year: year.optional(),
}).passthrough();

// ── Workers ───────────────────────────────────────────────────
const createWorker = {
  body: z.object({
    fullName: z.string().min(1).max(120).trim(),
    contact: z.string().max(30).trim().optional().nullable(),
    faydaId: z.string().max(50).trim().optional().nullable(),
    dailyWage: z.coerce.number().min(0).max(10000).optional(),
    saferZoneId: id.optional().nullable(),
    customAttributes: z.record(z.string(), z.string()).optional(),
  }),
};

const updateWorker = {
  body: z.object({
    fullName: z.string().min(1).max(120).trim(),
    contact: z.string().max(30).trim().optional().nullable(),
    faydaId: z.string().max(50).trim().optional().nullable(),
    dailyWage: z.coerce.number().min(0).max(10000),
    saferZoneId: id.optional().nullable(),
    isActive: z.boolean(),
    customAttributes: z.record(z.string(), z.string()).optional(),
  }),
  params: z.object({ id }),
};

const bulkAttendance = {
  body: z.object({
    date: dateStr,
    records: z.array(z.object({
      workerId: id,
      present: z.boolean(),
      bonus: z.coerce.number().min(0).max(10000).optional().nullable(),
    })).min(1).max(200),
  }),
};

const paySalary = {
  body: z.object({
    amount: z.coerce.number().positive().max(1000000),
    paidAt: dateStr,
    periodFrom: dateStr,
    periodTo: dateStr,
    notes: z.string().max(1000).trim().optional().nullable(),
  }),
  params: z.object({ id }),
};

const workerAttendanceQuery = {
  query: z.object({
    from: dateStr.optional(),
    to: dateStr.optional(),
  }).passthrough(),
};

// ── Inspections ───────────────────────────────────────────────
const createInspection = {
  body: z.object({
    kebeleId: id,
    saferZoneId: id.optional().nullable(),
    date: dateStr,
    status: z.enum(["active", "warning", "danger"]).optional(),
    notes: z.string().max(5000).trim().optional().nullable(),
  }),
};

const updateInspection = {
  body: z.object({
    status: z.enum(["active", "warning", "danger"]),
    notes: z.string().max(5000).trim().optional().nullable(),
  }),
  params: z.object({ id }),
};

// ── Tools ─────────────────────────────────────────────────────
const createTool = {
  body: z.object({
    name: z.string().min(1).max(120).trim(),
    category: z.string().max(60).trim().optional().nullable(),
    quantity: z.coerce.number().int().min(0).max(10000).optional(),
    conditionStatus: z.enum(["good", "fair", "poor", "broken"]).optional(),
    saferZoneId: id.optional().nullable(),
    notes: z.string().max(2000).trim().optional().nullable(),
  }),
};

const updateTool = {
  body: z.object({
    name: z.string().min(1).max(120).trim(),
    category: z.string().max(60).trim().optional().nullable(),
    quantity: z.coerce.number().int().min(0).max(10000),
    conditionStatus: z.enum(["good", "fair", "poor", "broken"]),
    saferZoneId: id.optional().nullable(),
    notes: z.string().max(2000).trim().optional().nullable(),
  }),
  params: z.object({ id }),
};

// ── Zone Reports ──────────────────────────────────────────────
const createZoneReport = {
  body: z.object({
    saferZoneId: id,
    reportDate: dateStr,
    reportMonth: month.optional(),
    reportYear: year.optional(),
    workersPresent: z.coerce.number().int().min(0).max(10000).optional(),
    workersAbsent: z.coerce.number().int().min(0).max(10000).optional(),
    collectionTotal: z.coerce.number().min(0).max(100000000).optional(),
    issuesReported: z.string().max(5000).trim().optional().nullable(),
    actionsTaken: z.string().max(5000).trim().optional().nullable(),
    toolsStatus: z.string().max(2000).trim().optional().nullable(),
  }),
};

const updateZoneReport = {
  body: z.object({
    workersPresent: z.coerce.number().int().min(0).max(10000),
    workersAbsent: z.coerce.number().int().min(0).max(10000),
    collectionTotal: z.coerce.number().min(0).max(100000000),
    issuesReported: z.string().max(5000).trim().optional().nullable(),
    actionsTaken: z.string().max(5000).trim().optional().nullable(),
    toolsStatus: z.string().max(2000).trim().optional().nullable(),
    status: z.enum(["draft", "submitted", "reviewed", "approved"]).optional(),
  }),
  params: z.object({ id }),
};

const reviewZoneReport = {
  body: z.object({
    status: z.enum(["reviewed", "approved"]),
    reviewerNotes: z.string().max(5000).trim().optional().nullable(),
  }),
  params: z.object({ id }),
};

// ── Documents ─────────────────────────────────────────────────
const updateDocument = {
  body: z.object({
    title: z.string().min(1).max(200).trim(),
    description: z.string().max(5000).trim().optional().nullable(),
    category: z.string().max(60).trim().optional(),
  }),
  params: z.object({ id }),
};

// ── Notifications ─────────────────────────────────────────────
const paginationQuery = z.object({
  page: pagination.page,
  limit: pagination.limit,
}).passthrough();

// ── Reports ───────────────────────────────────────────────────
const reportQuery = z.object({
  month: month.optional(),
  year: year.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  format: z.enum(["csv", "pdf", "xlsx"]).optional(),
}).passthrough();

// ── Audit Log ─────────────────────────────────────────────────
const auditLogQuery = z.object({
  page: pagination.page,
  limit: pagination.limit,
  userId: id.optional(),
  entityType: z.string().max(50).optional(),
}).passthrough();

module.exports = {
  login,
  createUser, updateUser, changePassword,
  updateKebele, createZone, updateZone,
  createBusiness, updateBusiness,
  createPayment, updatePayment, dashboardQuery,
  createWorker, updateWorker, bulkAttendance, paySalary, workerAttendanceQuery,
  createInspection, updateInspection,
  createTool, updateTool,
  createZoneReport, updateZoneReport, reviewZoneReport,
  updateDocument,
  paginationQuery, reportQuery, auditLogQuery,
};
