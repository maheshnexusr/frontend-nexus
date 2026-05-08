import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Render the given DOM element to an A4 portrait PDF, paginating vertically
 * when the captured canvas is taller than one page.
 */
export async function exportDashboardSnapshot(element, { filename, title }) {
  if (!element) throw new Error('No element provided to exportDashboardSnapshot.');

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#f8fafc',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
  });

  const pdf      = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW    = pdf.internal.pageSize.getWidth();
  const pageH    = pdf.internal.pageSize.getHeight();
  const margin   = 24;
  const usableW  = pageW - margin * 2;
  const imgRatio = canvas.height / canvas.width;
  const imgH     = usableW * imgRatio;
  const imgData  = canvas.toDataURL('image/png');

  if (title) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(title, margin, margin + 4);
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 18);
  pdf.setTextColor(0);

  const topOffset = title ? margin + 28 : margin;

  if (imgH + topOffset <= pageH - margin) {
    pdf.addImage(imgData, 'PNG', margin, topOffset, usableW, imgH);
  } else {
    // Multi-page: slice the canvas into page-height strips.
    const pxPerPt   = canvas.width / usableW;
    const pageStripHpx = Math.floor((pageH - margin - topOffset) * pxPerPt);
    let yPx = 0;
    let first = true;
    while (yPx < canvas.height) {
      const stripH = Math.min(pageStripHpx, canvas.height - yPx);
      const stripCanvas = document.createElement('canvas');
      stripCanvas.width  = canvas.width;
      stripCanvas.height = stripH;
      const ctx = stripCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, yPx, canvas.width, stripH, 0, 0, canvas.width, stripH);
      if (!first) pdf.addPage();
      pdf.addImage(
        stripCanvas.toDataURL('image/png'),
        'PNG',
        margin,
        first ? topOffset : margin,
        usableW,
        stripH / pxPerPt,
      );
      yPx += stripH;
      first = false;
    }
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
