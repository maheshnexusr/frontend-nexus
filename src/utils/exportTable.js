/**
 * Tabular export helpers: CSV, Excel (HTML-based .xls), and PDF (jsPDF).
 * Shape: columns = [{ header, accessor }], rows = array of objects.
 */

import jsPDF from 'jspdf';

function esc(val) {
  const s = val == null ? '' : String(val);
  return s.replace(/"/g, '""');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV({ columns, rows, filename }) {
  const header = columns.map((c) => `"${esc(c.header)}"`).join(',');
  const body   = rows
    .map((r) => columns.map((c) => `"${esc(r[c.accessor])}"`).join(','))
    .join('\n');
  const csv = '\uFEFF' + [header, body].filter(Boolean).join('\n');
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    filename.endsWith('.csv') ? filename : `${filename}.csv`,
  );
}

/**
 * Generates an Excel-compatible HTML file (.xls). Excel and Google Sheets
 * both open this format natively and it requires no extra dependency.
 */
export function exportXLSX({ columns, rows, filename, sheetName = 'Sheet1' }) {
  const headerHtml = columns
    .map((c) => `<th style="background:#0ea5e9;color:#fff;padding:6px 10px;text-align:left;">${esc(c.header)}</th>`)
    .join('');
  const bodyHtml = rows
    .map((r) =>
      '<tr>' +
      columns
        .map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${esc(r[c.accessor])}</td>`)
        .join('') +
      '</tr>',
    )
    .join('');
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/>
<xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${esc(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml>
</head><body>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
<thead><tr>${headerHtml}</tr></thead>
<tbody>${bodyHtml}</tbody>
</table></body></html>`;
  triggerDownload(
    new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
    filename.endsWith('.xls') ? filename : `${filename}.xls`,
  );
}

export function exportPDF({ columns, rows, filename, title }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  const margin  = 32;
  let y = margin;

  if (title) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y);
    y += 18;
  }
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 14;
  doc.setTextColor(0);

  const totalW  = pageW - margin * 2;
  const colWidth = totalW / columns.length;
  const rowHeight = 18;

  // Header row
  doc.setFillColor(14, 165, 233);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, y, totalW, rowHeight, 'F');
  columns.forEach((c, i) => {
    doc.text(String(c.header), margin + 4 + i * colWidth, y + 12, { maxWidth: colWidth - 8 });
  });
  y += rowHeight;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30);

  rows.forEach((r, rowIdx) => {
    if (y + rowHeight > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    if (rowIdx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, totalW, rowHeight, 'F');
    }
    columns.forEach((c, i) => {
      const v = r[c.accessor];
      const text = (v == null ? '—' : String(v)).slice(0, Math.floor(colWidth / 4));
      doc.text(text, margin + 4 + i * colWidth, y + 12, { maxWidth: colWidth - 8 });
    });
    y += rowHeight;
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Unified dispatcher.
 */
export function exportTable(format, args) {
  if (format === 'csv')  return exportCSV(args);
  if (format === 'xlsx' || format === 'xls' || format === 'excel') return exportXLSX(args);
  if (format === 'pdf')  return exportPDF(args);
  throw new Error(`Unknown export format: ${format}`);
}
