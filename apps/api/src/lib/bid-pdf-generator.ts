// Bid PDF generator.
//
// Renders a PricedEstimate as a multi-page, agency-bid-ready PDF that
// the estimator can attach to the bid envelope. Layout:
//
//   Page 1 header  — YGE company block (legal name, address, CSLB/DIR)
//                    + project header (name, owner, location, due date)
//                    + bid item table (line #, schedule, description,
//                      qty, unit, unit price, extended).
//   Subsequent     — bid item table continuation rows.
//   Last page      — totals block (direct + markup breakdown + bid
//                    total) + signature line + footer.
//
// Uses pdf-lib's standard 14 fonts (Helvetica / Helvetica-Bold) so we
// don't have to ship a font file. Money formatted as US dollars with
// the cents → dollars boundary respected (per CLAUDE.md: money is
// stored as Int cents, displayed at the edge).
//
// All values are pulled from the PricedEstimate + MasterProfile —
// nothing hardcoded except column widths + page margins.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  type PricedEstimate,
  computeEstimateTotals,
  lineExtendedCents,
  type MasterProfile,
} from '@yge/shared';

const PAGE_W = 612; // 8.5 in @ 72dpi
const PAGE_H = 792; // 11 in @ 72dpi
const MARGIN = 36;
const HEADER_H = 96;
const FOOTER_H = 28;
const ROW_H = 14;
const HEADER_ROW_H = 18;

function fmtCents(c: number): string {
  const sign = c < 0 ? '-' : '';
  const cents = Math.abs(Math.round(c));
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  const dollarsStr = dollars.toLocaleString('en-US');
  return `${sign}$${dollarsStr}.${remainder.toString().padStart(2, '0')}`;
}

function fmtQty(q: number): string {
  // Trim trailing zeros: 1.000 → 1, 1.50 → 1.5, 1.234 → 1.234
  return Number.parseFloat(q.toFixed(4)).toString();
}

function fmtPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export interface BidPdfOptions {
  estimate: PricedEstimate;
  master: MasterProfile;
}

interface DrawTextOpts {
  x: number;
  y: number;
  size?: number;
  font?: PDFFont;
  color?: ReturnType<typeof rgb>;
  /** When set, right-align the text to this `x` value. */
  rightAlignTo?: number;
}

/**
 * Render a bid PDF from a priced estimate + master profile. Returns
 * raw PDF bytes ready to ship as `application/pdf`.
 */
export async function generateBidPdf(opts: BidPdfOptions): Promise<Uint8Array> {
  const { estimate, master } = opts;
  const totals = computeEstimateTotals(estimate);

  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function drawText(text: string, opts: DrawTextOpts): void {
    const f = opts.font ?? helv;
    const size = opts.size ?? 9;
    const c = opts.color ?? rgb(0, 0, 0);
    const x =
      opts.rightAlignTo !== undefined
        ? opts.rightAlignTo - f.widthOfTextAtSize(text, size)
        : opts.x;
    page.drawText(text, { x, y: opts.y, size, font: f, color: c });
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number, weight = 0.5): void {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: weight,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  function newPage(): void {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  // ---- Header (company + project) ----------------------------------
  function drawHeader(): void {
    // Company block (left)
    drawText(master.legalName, { x: MARGIN, y, size: 14, font: helvBold });
    y -= 12;
    drawText(
      `${master.address.street}, ${master.address.city}, ${master.address.state} ${master.address.zip}`,
      { x: MARGIN, y, size: 8 },
    );
    y -= 10;
    drawText(
      `${master.primaryPhone} · ${master.primaryEmail}`,
      { x: MARGIN, y, size: 8 },
    );
    y -= 10;
    drawText(
      `CSLB ${master.cslbLicense} · DIR ${master.dirNumber}${master.dotNumber ? ` · DOT ${master.dotNumber}` : ''}`,
      { x: MARGIN, y, size: 8 },
    );
    y -= 14;

    drawLine(MARGIN, y, PAGE_W - MARGIN, y, 1);
    y -= 14;

    // Project block
    drawText(estimate.projectName, { x: MARGIN, y, size: 13, font: helvBold });
    y -= 14;
    if (estimate.ownerAgency) {
      drawText(`Owner: ${estimate.ownerAgency}`, { x: MARGIN, y, size: 9 });
      y -= 10;
    }
    if (estimate.location) {
      drawText(`Location: ${estimate.location}`, { x: MARGIN, y, size: 9 });
      y -= 10;
    }
    if (estimate.bidDueDate) {
      drawText(`Bid due: ${estimate.bidDueDate}`, { x: MARGIN, y, size: 9 });
      y -= 10;
    }
    y -= 8;
  }

  drawHeader();

  // ---- Bid item table ----------------------------------------------
  // Column layout (left → right):
  //   #     line number (right-align)            44
  //   Sch.  schedule (left)                      56
  //   Desc  description (left, truncate)         260
  //   Qty   quantity (right)                     50
  //   Unit  unit (left)                          36
  //   Unit$ unit price (right)                   54
  //   Ext.  extended (right)                     72
  const colX = {
    line: MARGIN + 28,    // right edge of "#"
    schStart: MARGIN + 34,
    descStart: MARGIN + 92,
    descMaxW: 240,
    qty: MARGIN + 360,    // right edge of "Qty"
    unitStart: MARGIN + 370,
    unitPrice: MARGIN + 460, // right edge
    ext: MARGIN + 540,    // right edge of "Ext." (≈PAGE_W − MARGIN)
  };

  function drawTableHeader(): void {
    drawText('#', { x: colX.schStart - 14, y, size: 8, font: helvBold });
    drawText('Sch.', { x: colX.schStart, y, size: 8, font: helvBold });
    drawText('Description', { x: colX.descStart, y, size: 8, font: helvBold });
    drawText('Qty', { x: colX.qty, y, size: 8, font: helvBold, rightAlignTo: colX.qty });
    drawText('Unit', { x: colX.unitStart, y, size: 8, font: helvBold });
    drawText('Unit price', { x: colX.unitPrice, y, size: 8, font: helvBold, rightAlignTo: colX.unitPrice });
    drawText('Extended', { x: colX.ext, y, size: 8, font: helvBold, rightAlignTo: colX.ext });
    y -= 4;
    drawLine(MARGIN, y, PAGE_W - MARGIN, y, 0.5);
    y -= HEADER_ROW_H - 4;
  }

  function ensureRoomForRow(): void {
    if (y - ROW_H < MARGIN + FOOTER_H) {
      newPage();
      drawTableHeader();
    }
  }

  function truncate(text: string, maxW: number, size: number): string {
    if (helv.widthOfTextAtSize(text, size) <= maxW) return text;
    let out = text;
    while (out.length > 1 && helv.widthOfTextAtSize(out + '…', size) > maxW) {
      out = out.slice(0, -1);
    }
    return out + '…';
  }

  drawTableHeader();

  // Render base bid lines first, then alternates flagged "[ALT]".
  const ordered = [
    ...estimate.bidItems.filter((b) => !b.isAlternate),
    ...estimate.bidItems.filter((b) => b.isAlternate),
  ];
  ordered.forEach((item, idx) => {
    ensureRoomForRow();
    const ext = lineExtendedCents(item);
    drawText(String(idx + 1), { x: colX.line, y, size: 9, rightAlignTo: colX.line });
    drawText(item.schedule ?? '', { x: colX.schStart, y, size: 9 });
    const descPrefix = item.isAlternate ? '[ALT] ' : '';
    const desc = truncate(descPrefix + item.description, colX.descMaxW, 9);
    drawText(desc, { x: colX.descStart, y, size: 9 });
    drawText(fmtQty(item.quantity), { x: colX.qty, y, size: 9, rightAlignTo: colX.qty });
    drawText(item.unit ?? '', { x: colX.unitStart, y, size: 9 });
    if (item.unitPriceCents != null) {
      drawText(fmtCents(item.unitPriceCents), {
        x: colX.unitPrice, y, size: 9, rightAlignTo: colX.unitPrice,
      });
      drawText(fmtCents(ext), {
        x: colX.ext, y, size: 9, rightAlignTo: colX.ext,
      });
    } else {
      drawText('—', { x: colX.unitPrice, y, size: 9, rightAlignTo: colX.unitPrice, color: rgb(0.6, 0, 0) });
      drawText('—', { x: colX.ext, y, size: 9, rightAlignTo: colX.ext, color: rgb(0.6, 0, 0) });
    }
    y -= ROW_H;
  });

  // ---- Totals block -------------------------------------------------
  // Always pull onto a new page if we don't have room for the totals.
  const TOTALS_H = 16 * 10;
  if (y - TOTALS_H < MARGIN + FOOTER_H) newPage();

  y -= 8;
  drawLine(MARGIN, y, PAGE_W - MARGIN, y, 0.75);
  y -= 14;

  function drawTotalRow(label: string, value: number, opts: { bold?: boolean; size?: number } = {}): void {
    const size = opts.size ?? 9;
    const font = opts.bold ? helvBold : helv;
    drawText(label, { x: PAGE_W - MARGIN - 220, y, size, font });
    drawText(fmtCents(value), { x: PAGE_W - MARGIN, y, size, font, rightAlignTo: PAGE_W - MARGIN });
    y -= size + 4;
  }

  drawTotalRow('Direct cost', totals.directCents);
  const b = totals.markupBreakdown;
  if (b.laborBurdenCents > 0) drawTotalRow(`Labor burden (${fmtPct(estimate.markup?.laborBurdenPct ?? 0)})`, b.laborBurdenCents);
  if (b.equipmentBurdenCents > 0) drawTotalRow(`Equipment burden (${fmtPct(estimate.markup?.equipmentBurdenPct ?? 0)})`, b.equipmentBurdenCents);
  if (b.subMarkupCents > 0) drawTotalRow(`Sub markup (${fmtPct(estimate.markup?.subMarkupPct ?? 0)})`, b.subMarkupCents);
  if (b.bondCents > 0) drawTotalRow(`Bond (${fmtPct(estimate.markup?.bondPct ?? 0)})`, b.bondCents);
  if (b.insuranceCents > 0) drawTotalRow(`Insurance (${fmtPct(estimate.markup?.insurancePct ?? 0)})`, b.insuranceCents);
  if (b.contingencyCents > 0) drawTotalRow(`Contingency (${fmtPct(estimate.markup?.contingencyPct ?? 0)})`, b.contingencyCents);
  drawTotalRow(`Overhead & profit (${fmtPct(estimate.oppPercent)})`, totals.oppCents);
  y -= 4;
  drawLine(PAGE_W - MARGIN - 240, y, PAGE_W - MARGIN, y, 0.75);
  y -= 14;
  drawTotalRow('BID TOTAL', totals.bidTotalCents, { bold: true, size: 12 });
  if (totals.alternateCents > 0) {
    y -= 4;
    drawTotalRow('Alternates (not in base bid)', totals.alternateCents);
  }

  // Per-unit price, when configured.
  if (estimate.perUnitPrice && estimate.perUnitPrice.value > 0) {
    const perUnit = Math.round(totals.bidTotalCents / estimate.perUnitPrice.value);
    drawText(
      `Equivalent per ${estimate.perUnitPrice.unit}: ${fmtCents(perUnit)} (${fmtQty(estimate.perUnitPrice.value)} ${estimate.perUnitPrice.unit}s)`,
      { x: PAGE_W - MARGIN - 240, y, size: 8 },
    );
    y -= 12;
  }

  // ---- Signature line ----------------------------------------------
  y -= 28;
  if (y < MARGIN + FOOTER_H + 60) newPage();
  drawLine(MARGIN, y, MARGIN + 220, y, 0.75);
  drawLine(PAGE_W - MARGIN - 120, y, PAGE_W - MARGIN, y, 0.75);
  y -= 10;
  drawText('Signature', { x: MARGIN, y, size: 8 });
  drawText('Date', { x: PAGE_W - MARGIN - 120, y, size: 8 });
  y -= 22;
  // Authorized officer (first officer w/ "president"/"vp" role, else first).
  const officer =
    master.officers.find((o) => /president|vp|owner/i.test(o.roleKey)) ??
    master.officers[0];
  if (officer) {
    drawText(`${officer.name}, ${officer.title}`, { x: MARGIN, y, size: 9 });
    y -= 10;
    drawText(`${officer.phone ?? master.primaryPhone} · ${officer.email ?? master.primaryEmail}`, { x: MARGIN, y, size: 8 });
  }

  // ---- Footer (every page) -----------------------------------------
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const total = pages.length;
    p.drawText(
      `${master.shortName} bid · ${estimate.projectName} · generated ${new Date(estimate.updatedAt).toISOString().slice(0, 10)}`,
      { x: MARGIN, y: MARGIN - 12, size: 7, font: helv, color: rgb(0.5, 0.5, 0.5) },
    );
    const pageLabel = `Page ${i + 1} of ${total}`;
    const w = helv.widthOfTextAtSize(pageLabel, 7);
    p.drawText(pageLabel, {
      x: PAGE_W - MARGIN - w,
      y: MARGIN - 12,
      size: 7,
      font: helv,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return await doc.save();
}

// Helper exported only for tests / unused-warning suppression.
export const _internal = { fmtCents, fmtQty, fmtPct };
// Unused-page reference suppression for PDFPage type so the import
// stays even if pdf-lib reshapes its exports later.
export type _BidPdfPageT = PDFPage;
