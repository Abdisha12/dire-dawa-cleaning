// backend/services/excelService.js — Excel file generator using ExcelJS
const ExcelJS = require("exceljs");

function fmtETB(n) {
  return "ETB " + parseFloat(n || 0).toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Generate Excel workbook for Monthly Payments Report
 */
async function generatePaymentsExcel(rows, month, year) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Dire Dawa Cleaning System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Payments ${month}-${year}`);

  // Title
  sheet.mergeCells("A1:G1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `DIRE DAWA CITY ADMINISTRATION — PAYMENTS REPORT (${month}/${year})`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "1E3A8A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };

  // Headers
  const headers = ["ID", "Business", "Zone", "Kebele", "Amount (ETB)", "Method", "Status", "Collector", "Paid Date", "Receipt #"];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Data rows
  rows.forEach(r => {
    const row = sheet.addRow([
      r.id,
      r.business,
      r.zone || "—",
      r.kebele || "—",
      parseFloat(r.amount || 0),
      (r.method || "").toUpperCase(),
      (r.status || "").toUpperCase(),
      r.collector || "—",
      fmtDate(r.paid_at),
      r.receipt_number || "—"
    ]);

    row.getCell(5).numFmt = '#,##0.00 "ETB"';
  });

  // Auto-width columns
  sheet.columns.forEach(col => {
    let maxLen = 12;
    col.eachCell({ includeEmpty: true }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 30);
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel workbook for Worker Payroll Report
 */
async function generatePayrollExcel(rows, month, year) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Payroll ${month}-${year}`);

  sheet.mergeCells("A1:G1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `DIRE DAWA CLEANING CMS — WORKER PAYROLL (${month}/${year})`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "166534" } };

  const headers = ["Worker Name", "Zone", "Kebele", "Daily Wage (ETB)", "Days Present", "Days Absent", "Bonus (ETB)", "Gross Pay (ETB)"];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "166534" } };
  });

  rows.forEach(r => {
    const row = sheet.addRow([
      r.full_name,
      r.zone || "—",
      r.kebele || "—",
      parseFloat(r.daily_wage || 0),
      r.days_present || 0,
      r.days_absent || 0,
      parseFloat(r.total_bonus || 0),
      parseFloat(r.gross || 0)
    ]);
    row.getCell(4).numFmt = '#,##0.00 "ETB"';
    row.getCell(7).numFmt = '#,##0.00 "ETB"';
    row.getCell(8).numFmt = '#,##0.00 "ETB"';
  });

  sheet.columns.forEach(col => { col.width = 18; });
  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel workbook for Inspections Report
 */
async function generateInspectionsExcel(rows, from, to) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inspections");

  sheet.mergeCells("A1:F1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `INSPECTION & CLEANLINESS REPORT (${from || "All"} to ${to || "All"})`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "9A3412" } };

  const headers = ["Date", "Kebele", "Zone", "Status", "Inspector", "Photo Count", "Notes"];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "9A3412" } };
  });

  rows.forEach(r => {
    sheet.addRow([
      fmtDate(r.date),
      r.kebele,
      r.zone || "—",
      (r.status || "").toUpperCase(),
      r.inspector,
      r.photo_count || 0,
      r.notes || "—"
    ]);
  });

  sheet.columns.forEach(col => { col.width = 18; });
  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel for Monthly Consolidated Summary (Payments + Workers + Inspections)
 */
async function generateMonthlySummaryExcel({ payments, workers, inspections }, month, year) {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Payments
  const pSheet = workbook.addWorksheet("Revenue Payments");
  pSheet.addRow(["Business", "Zone", "Amount (ETB)", "Method", "Status"]).font = { bold: true };
  payments.forEach(p => pSheet.addRow([p.business, p.zone, parseFloat(p.amount), p.method, p.status]));

  // Sheet 2: Worker Payroll
  const wSheet = workbook.addWorksheet("Worker Payroll");
  wSheet.addRow(["Worker", "Zone", "Present Days", "Absent Days", "Gross Pay (ETB)"]).font = { bold: true };
  workers.forEach(w => wSheet.addRow([w.full_name, w.zone, w.days_present, w.days_absent, parseFloat(w.gross)]));

  // Sheet 3: Inspections
  const iSheet = workbook.addWorksheet("Inspections");
  iSheet.addRow(["Date", "Kebele", "Zone", "Status", "Inspector"]).font = { bold: true };
  inspections.forEach(i => iSheet.addRow([fmtDate(i.date), i.kebele, i.zone, i.status, i.inspector]));

  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  generatePaymentsExcel,
  generatePayrollExcel,
  generateInspectionsExcel,
  generateMonthlySummaryExcel
};
