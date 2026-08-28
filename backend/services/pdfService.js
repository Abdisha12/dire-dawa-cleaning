const PDFDocument = require("pdfkit");

function fmtETB(n) {
  return "ETB " + parseFloat(n || 0).toLocaleString("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function monthName(m) {
  return [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ][parseInt(m)] || m;
}

function drawHeader(doc, title, metadata = {}) {
  // Ethiopian flag colors accent bar
  doc.rect(40, 40, 172, 4).fill("#009c3a");
  doc.rect(212, 40, 171, 4).fill("#f7d117");
  doc.rect(383, 40, 172, 4).fill("#da121a");
  
  doc.fillColor("#1e3a8a")
     .font("Helvetica-Bold")
     .fontSize(16)
     .text("Dire Dawa City Administration", 40, 55);
     
  doc.fillColor("#4b5563")
     .font("Helvetica")
     .fontSize(11)
     .text("Cleaning Management System - Official Report", 40, 75);
     
  doc.fillColor("#0d9488")
     .font("Helvetica-Bold")
     .fontSize(13)
     .text(title, 40, 95);
     
  doc.strokeColor("#e2e8f0")
     .lineWidth(1)
     .moveTo(40, 112)
     .lineTo(555, 112)
     .stroke();
     
  // Metadata printed on the top right
  let metaY = 55;
  doc.fillColor("#374151")
     .font("Helvetica-Bold")
     .fontSize(8);
     
  if (metadata.month && metadata.year) {
    doc.text(`REPORT PERIOD: ${monthName(metadata.month).toUpperCase()} ${metadata.year}`, 380, metaY, { align: "right", width: 175 });
    metaY += 12;
  }
  if (metadata.dateRange) {
    doc.text(`DATE RANGE: ${metadata.dateRange}`, 380, metaY, { align: "right", width: 175 });
    metaY += 12;
  }
  doc.text(`GENERATED ON: ${new Date().toLocaleString("en-GB")}`, 380, metaY, { align: "right", width: 175 });
}

function drawTable(doc, startY, headers, rowData, colWidths, formatters = {}) {
  let y = startY;
  
  // Table header background
  doc.rect(40, y, 515, 20).fill("#1e3a8a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
  
  let x = 40;
  headers.forEach((h, idx) => {
    const width = colWidths[idx];
    doc.text(h, x + 5, y + 6, { width: width - 10, lineBreak: false });
    x += width;
  });
  
  y += 20;
  
  // Draw rows
  doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
  
  rowData.forEach((row, rowIdx) => {
    // Page overflow safety
    if (y > 740) {
      doc.addPage();
      y = 60; // reset y
      // Redraw table headers on new page
      doc.rect(40, y, 515, 20).fill("#1e3a8a");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
      let px = 40;
      headers.forEach((h, idx) => {
        const width = colWidths[idx];
        doc.text(h, px + 5, y + 6, { width: width - 10, lineBreak: false });
        px += width;
      });
      y += 20;
      doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
    }
    
    // Alternating rows shading
    if (rowIdx % 2 === 1) {
      doc.rect(40, y, 515, 18).fill("#f8fafc");
      doc.fillColor("#1f2937");
    }
    
    // Draw cells
    let rx = 40;
    row.forEach((cell, idx) => {
      const width = colWidths[idx];
      const formatter = formatters[idx];
      const val = formatter ? formatter(cell) : (cell === null || cell === undefined ? "—" : String(cell));
      doc.text(val, rx + 5, y + 5, { width: width - 10, height: 12, overflow: "ellipses", lineBreak: false });
      rx += width;
    });
    
    // Border line
    doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(40, y + 18).lineTo(555, y + 18).stroke();
    y += 18;
  });
  
  return y;
}

function drawFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.strokeColor("#e2e8f0")
       .lineWidth(0.5)
       .moveTo(40, 800)
       .lineTo(555, 800)
       .stroke();
       
    doc.fillColor("#6b7280")
       .font("Helvetica")
       .fontSize(7.5)
       .text("Dire Dawa Cleaning System • Confidential Internal Report", 40, 808);
       
    doc.text(`Page ${i + 1} of ${pages.count}`, 400, 808, { align: "right", width: 155 });
  }
}

/**
 * Generate Payments PDF
 */
function generatePaymentsPDF(doc, data, month, year) {
  drawHeader(doc, "MONTHLY BUSINESS PAYMENTS REPORT", { month, year });
  
  // Calculate totals
  const totalAmount = data.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const payCount = data.length;
  
  // Summary boxes
  doc.rect(40, 130, 245, 45).fill("#f0fdf4");
  doc.rect(40, 130, 245, 45).strokeColor("#bbf7d0").lineWidth(1).stroke();
  doc.fillColor("#166534").font("Helvetica-Bold").fontSize(8.5).text("TOTAL FUNDS COLLECTED", 50, 140);
  doc.fontSize(14).text(fmtETB(totalAmount), 50, 153);
  
  doc.rect(310, 130, 245, 45).fill("#eff6ff");
  doc.rect(310, 130, 245, 45).strokeColor("#bfdbfe").lineWidth(1).stroke();
  doc.fillColor("#1e40af").font("Helvetica-Bold").fontSize(8.5).text("PAYMENTS RECORDED", 320, 140);
  doc.fontSize(14).text(String(payCount), 320, 153);
  
  const headers = ["Business Name", "Zone", "Kebele", "Amount", "Method", "Paid At", "Receipt #"];
  const colWidths = [135, 65, 55, 75, 55, 60, 70];
  const rowData = data.map(p => [
    p.business,
    p.zone,
    p.kebele,
    p.amount,
    p.method,
    p.paid_at,
    p.receipt_number
  ]);
  
  const formatters = {
    3: (val) => fmtETB(val),
    5: (val) => fmtDate(val),
  };
  
  drawTable(doc, 195, headers, rowData, colWidths, formatters);
  drawFooter(doc);
}

/**
 * Generate Worker Payroll PDF
 */
function generatePayrollPDF(doc, data, month, year) {
  drawHeader(doc, "MONTHLY WORKER PAYROLL REPORT", { month, year });
  
  const totalGross = data.reduce((s, w) => s + parseFloat(w.gross || 0), 0);
  const totalBonus = data.reduce((s, w) => s + parseFloat(w.total_bonus || 0), 0);
  const activeCount = data.length;
  
  // Summary boxes
  doc.rect(40, 130, 160, 45).fill("#eff6ff");
  doc.rect(40, 130, 160, 45).strokeColor("#bfdbfe").lineWidth(1).stroke();
  doc.fillColor("#1e40af").font("Helvetica-Bold").fontSize(8).text("TOTAL GROSS PAYROLL", 48, 138);
  doc.fontSize(11).text(fmtETB(totalGross), 48, 151);
  
  doc.rect(215, 130, 160, 45).fill("#fdf2f8");
  doc.rect(215, 130, 160, 45).strokeColor("#fbcfe8").lineWidth(1).stroke();
  doc.fillColor("#9d174d").font("Helvetica-Bold").fontSize(8).text("TOTAL ATTENDANCE BONUSES", 223, 138);
  doc.fontSize(11).text(fmtETB(totalBonus), 223, 151);
  
  doc.rect(390, 130, 165, 45).fill("#f0fdf4");
  doc.rect(390, 130, 165, 45).strokeColor("#bbf7d0").lineWidth(1).stroke();
  doc.fillColor("#166534").font("Helvetica-Bold").fontSize(8).text("WORKERS COUNTED", 398, 138);
  doc.fontSize(11).text(String(activeCount), 398, 151);
  
  const headers = ["Worker Name", "Zone", "Daily Wage", "Present", "Absent", "Bonus", "Gross Pay"];
  const colWidths = [130, 75, 65, 45, 45, 70, 85];
  const rowData = data.map(w => [
    w.full_name,
    w.zone,
    w.daily_wage,
    w.days_present,
    w.days_absent,
    w.total_bonus,
    w.gross
  ]);
  
  const formatters = {
    2: (val) => fmtETB(val) + "/day",
    5: (val) => fmtETB(val),
    6: (val) => fmtETB(val),
  };
  
  drawTable(doc, 195, headers, rowData, colWidths, formatters);
  drawFooter(doc);
}

/**
 * Generate Inspections PDF
 */
function generateInspectionsPDF(doc, data, from, to) {
  let dateRange = "All Records";
  if (from && to) dateRange = `${fmtDate(from)} – ${fmtDate(to)}`;
  else if (from) dateRange = `Since ${fmtDate(from)}`;
  else if (to) dateRange = `Until ${fmtDate(to)}`;
  
  drawHeader(doc, "STREET CLEANLINESS & ZONE INSPECTION REPORT", { dateRange });
  
  const totalInspections = data.length;
  const goodCount = data.filter(i => (i.status || "").toLowerCase() === "good").length;
  const fairCount = data.filter(i => (i.status || "").toLowerCase() === "fair").length;
  const poorCount = data.filter(i => (i.status || "").toLowerCase() === "poor" || (i.status || "").toLowerCase() === "broken").length;
  
  // Summary boxes
  doc.rect(40, 130, 115, 45).fill("#eff6ff");
  doc.rect(40, 130, 115, 45).strokeColor("#bfdbfe").lineWidth(1).stroke();
  doc.fillColor("#1e40af").font("Helvetica-Bold").fontSize(7.5).text("INSPECTIONS CONDUCTED", 46, 138);
  doc.fontSize(11).text(String(totalInspections), 46, 151);
  
  doc.rect(170, 130, 115, 45).fill("#f0fdf4");
  doc.rect(170, 130, 115, 45).strokeColor("#bbf7d0").lineWidth(1).stroke();
  doc.fillColor("#166534").font("Helvetica-Bold").fontSize(7.5).text("GOOD CLEANLINESS", 176, 138);
  doc.fontSize(11).text(String(goodCount), 176, 151);
  
  doc.rect(300, 130, 115, 45).fill("#fffbeb");
  doc.rect(300, 130, 115, 45).strokeColor("#fde68a").lineWidth(1).stroke();
  doc.fillColor("#92400e").font("Helvetica-Bold").fontSize(7.5).text("FAIR CLEANLINESS", 306, 138);
  doc.fontSize(11).text(String(fairCount), 306, 151);
  
  doc.rect(430, 130, 125, 45).fill("#fef2f2");
  doc.rect(430, 130, 125, 45).strokeColor("#fecaca").lineWidth(1).stroke();
  doc.fillColor("#991b1b").font("Helvetica-Bold").fontSize(7.5).text("POOR / BROKEN STATUS", 436, 138);
  doc.fontSize(11).text(String(poorCount), 436, 151);
  
  const headers = ["Date", "Kebele", "Zone", "Status", "Inspector", "Notes"];
  const colWidths = [60, 55, 65, 55, 95, 185];
  const rowData = data.map(i => [
    i.date,
    i.kebele,
    i.zone,
    i.status,
    i.inspector,
    i.notes
  ]);
  
  const formatters = {
    0: (val) => fmtDate(val),
    3: (val) => {
      const s = String(val || "").toUpperCase();
      return s;
    }
  };
  
  drawTable(doc, 195, headers, rowData, colWidths, formatters);
  drawFooter(doc);
}

module.exports = {
  generatePaymentsPDF,
  generatePayrollPDF,
  generateInspectionsPDF
};
