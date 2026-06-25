import PDFDocument from 'pdfkit';

interface HistorySheetData {
  offender: {
    fullName: string;
    alias?: string | null;
    fatherHusbandName?: string | null;
    age?: number | null;
    category?: string | null;
    address?: string | null;
    psName?: string | null;
    mobile?: string | null;
  };
  timeline: Array<{
    firNo: string;
    psName?: string | null;
    caseDate?: Date | string | null;
    stage?: string | null;
    sectionOfLaw?: string | null;
    contrabandType?: string | null;
    arrestStatus?: string | null;
  }>;
  generatedAt: string;
}

export function generateHistorySheetPdf(data: HistorySheetData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Header
  doc.fontSize(16).font('Helvetica-Bold')
     .text('GARUDA — NDPS History Sheet', { align: 'center' });
  doc.fontSize(9).font('Helvetica')
     .text('Tirupati District Police & Excise Department', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Offender Details
  const o = data.offender;
  doc.fontSize(12).font('Helvetica-Bold').text('Offender Details');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  
  const detailRows = [
    ['Full Name', o.fullName || '—'],
    ['Alias', o.alias || '—'],
    ['Father/Husband', o.fatherHusbandName || '—'],
    ['Age', o.age ? `${o.age} Yrs` : '—'],
    ['Category', o.category ? o.category.replace(/_/g, ' ') : '—'],
    ['Police Station', o.psName || '—'],
    ['Address', o.address || '—'],
    ['Mobile', o.mobile || '—'],
  ];

  for (const [label, value] of detailRows) {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value as string);
  }

  doc.moveDown(1);

  // Case Timeline Table
  doc.fontSize(12).font('Helvetica-Bold').text('Case History Timeline');
  doc.moveDown(0.5);

  if (data.timeline.length === 0) {
    doc.fontSize(10).font('Helvetica').text('No cases on record.');
  } else {
    // Table header
    const tableTop = doc.y;
    const colWidths = [60, 80, 70, 80, 100, 70];
    const headers = ['FIR No', 'PS', 'Date', 'Stage', 'Section', 'Arrest'];
    
    doc.fontSize(8).font('Helvetica-Bold');
    let xPos = 50;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i] as string, xPos, tableTop, { width: colWidths[i] as number });
      xPos += (colWidths[i] as number);
    }

    doc.moveTo(50, tableTop + 12).lineTo(545, tableTop + 12).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let y = tableTop + 16;

    for (const row of data.timeline) {
      if (y > 750) { // page break
        doc.addPage();
        y = 50;
      }
      xPos = 50;
      const vals = [
        row.firNo || '—',
        row.psName || '—',
        row.caseDate ? new Date(row.caseDate).toLocaleDateString('en-IN') : '—',
        row.stage || '—',
        row.sectionOfLaw || '—',
        row.arrestStatus ? row.arrestStatus.replace(/_/g, ' ') : '—',
      ];
      for (let i = 0; i < vals.length; i++) {
        doc.text(vals[i] as string, xPos, y, { width: colWidths[i] as number });
        xPos += (colWidths[i] as number);
      }
      y += 14;
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica')
     .text(`Generated: ${data.generatedAt}`, { align: 'right' });
  doc.text('GARUDA — Confidential', { align: 'right' });

  return doc;
}
