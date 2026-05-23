// PDF export — flatten measurements onto the source plan set.
//
// Uses pdf-lib to load the takeoff's source PDF, then draws scale + every
// measurement per sheet, then saves as a new PDF and returns the bytes.
//
// Coordinate-system gotcha: pdf-lib uses PDF-native coords (origin at bottom-
// left, y goes UP). Our stored points come from pdfjs's default viewport
// transform which uses top-down (origin at top-left, y goes DOWN). So every
// y value gets flipped on draw via `pageHeight - y`.

import { PDFDocument, StandardFonts, rgb, type PDFPage, type RGB } from 'pdf-lib';
import {
  defaultMeasurementColor,
  measurementValue,
  type PlanPoint,
  type PlanScale,
  type PlanSheetTakeoff,
  type PlanTakeoff,
  type TakeoffMeasurement,
} from '@yge/shared';

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  );
}

function drawScale(page: PDFPage, scale: PlanScale, h: number, thickness: number): void {
  const color = rgb(0.86, 0.15, 0.15);
  page.drawLine({
    start: { x: scale.pointA.x, y: h - scale.pointA.y },
    end: { x: scale.pointB.x, y: h - scale.pointB.y },
    thickness,
    color,
    dashArray: [thickness * 3, thickness * 2],
  });
}

function drawMeasurement(
  page: PDFPage,
  m: TakeoffMeasurement,
  scale: PlanScale | undefined,
  h: number,
  thickness: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
): void {
  const color = hexToRgb(m.color ?? defaultMeasurementColor(m.kind));
  const v = measurementValue(m, scale);
  const labelText = (() => {
    switch (m.kind) {
      case 'COUNT':
        return `${v.value} ${v.unit}`;
      default:
        return scale ? `${v.value.toFixed(v.unit === 'EA' ? 0 : 1)} ${v.unit}` : m.kind;
    }
  })();
  const fontSize = 9;

  if (m.kind === 'LENGTH' || m.kind === 'POLYLINE') {
    const pts = m.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (!a || !b) continue;
      page.drawLine({
        start: { x: a.x, y: h - a.y },
        end: { x: b.x, y: h - b.y },
        thickness,
        color,
      });
    }
    const last = pts[pts.length - 1];
    const first = pts[0];
    const labelPt = last && first
      ? m.kind === 'LENGTH'
        ? { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }
        : { x: last.x + 2, y: last.y - 2 }
      : null;
    if (labelPt) {
      page.drawText(labelText, {
        x: labelPt.x,
        y: h - labelPt.y,
        size: fontSize,
        font,
        color,
      });
    }
    return;
  }

  if (m.kind === 'AREA' || m.kind === 'VOLUME') {
    const pts = m.points;
    if (pts.length < 3) return;
    // Draw polygon edges.
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!a || !b) continue;
      page.drawLine({
        start: { x: a.x, y: h - a.y },
        end: { x: b.x, y: h - b.y },
        thickness,
        color,
      });
    }
    // Centroid label.
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    page.drawText(labelText, {
      x: cx,
      y: h - cy,
      size: fontSize,
      font,
      color,
    });
    return;
  }

  if (m.kind === 'RADIUS') {
    const a = m.points[0];
    const b = m.points[1];
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    page.drawCircle({
      x: a.x,
      y: h - a.y,
      size: r,
      borderColor: color,
      borderWidth: thickness,
    });
    page.drawText(labelText, {
      x: a.x,
      y: h - (a.y - r - 4),
      size: fontSize,
      font,
      color,
    });
    return;
  }

  if (m.kind === 'COUNT') {
    m.points.forEach((p, i) => {
      page.drawCircle({
        x: p.x,
        y: h - p.y,
        size: thickness * 4,
        color,
        opacity: 0.85,
      });
      page.drawText(String(i + 1), {
        x: p.x - thickness * 1.5,
        y: h - p.y - thickness * 1.5,
        size: thickness * 4,
        font,
        color: rgb(1, 1, 1),
      });
    });
    return;
  }
}

/** Build the annotated PDF for a takeoff. Returns the PDF bytes. */
export async function exportTakeoffPdf(takeoff: PlanTakeoff): Promise<Uint8Array> {
  const res = await fetch(takeoff.planRef);
  if (!res.ok) throw new Error(`Couldn't fetch source PDF (${res.status})`);
  const sourceBytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const sheet of takeoff.sheets) {
    const page = pdfDoc.getPage(sheet.sheetIndex);
    if (!page) continue;
    const h = page.getHeight();
    const baseThickness = Math.max(1, page.getWidth() / 800);
    if (sheet.scale) drawScale(page, sheet.scale, h, baseThickness);
    for (const m of sheet.measurements) {
      drawMeasurement(page, m, sheet.scale, h, baseThickness, font);
    }
  }

  return pdfDoc.save();
}

/** Trigger a browser download of the annotated PDF. */
export async function downloadTakeoffPdf(takeoff: PlanTakeoff): Promise<void> {
  const bytes = await exportTakeoffPdf(takeoff);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${takeoff.name.replace(/[^\w.-]+/g, '_')}-takeoff.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
