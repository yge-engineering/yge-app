// PDF page splitter — turns a single multi-page PDF into per-page
// records the Plans-to-Estimate pipeline can route to specialized
// passes (title-block reader, bid-schedule parser, spec reader).
//
// Phase 1 ships the page-extraction half: load the PDF via pdf-lib,
// produce one `PdfPage` per page with metadata. OCR for scanned
// pages + structured-page text extraction (currently only a
// best-effort heuristic) layer on top later.
//
// pdf-lib doesn't expose page-text extraction directly — that
// requires either pdfjs-dist (heavier dep, complicated server-side
// setup) or a purpose-built parser. Phase 1 returns an empty
// `text` field and a TODO marker; the OCR / pdfjs-dist
// integration in a follow-up commit fills it in. Routing logic
// can already be tested against page metadata alone.

import { PDFDocument } from 'pdf-lib';

export interface PdfPage {
  /** Zero-based page index. */
  index: number;
  /** Page width in PDF points (1/72 inch). */
  widthPts: number;
  /** Page height in PDF points. */
  heightPts: number;
  /** Plain-text contents when available. Empty string for Phase 1
   *  until the text extractor lands. */
  text: string;
  /** Whether the page is likely a scan (no embedded text fonts).
   *  Heuristic: when the page has no /Font resources, it's almost
   *  certainly an image-only page that needs OCR. Phase 1 marks
   *  every page true (the extractor doesn't differentiate yet). */
  needsOcr: boolean;
}

export interface PdfSplitResult {
  pageCount: number;
  pages: PdfPage[];
  /** PDF document title from the metadata, when present. */
  title?: string;
  /** PDF producer (the tool that wrote the PDF) — useful for the
   *  AI page-routing heuristics ('Bluebeam-output PDFs put the
   *  bid schedule on a known sheet'). */
  producer?: string;
}

/**
 * Load a PDF byte buffer + return one PdfPage entry per page. Does
 * NOT extract page text — that's a follow-up.
 */
export async function splitPdfPages(bytes: Uint8Array): Promise<PdfSplitResult> {
  const pdf = await PDFDocument.load(bytes);
  const pageCount = pdf.getPageCount();
  const pages: PdfPage[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    const page = pdf.getPage(i);
    const { width, height } = page.getSize();
    pages.push({
      index: i,
      widthPts: width,
      heightPts: height,
      text: '',
      needsOcr: true, // Phase 1: assume every page needs OCR until the extractor lands
    });
  }
  return {
    pageCount,
    pages,
    title: pdf.getTitle() ?? undefined,
    producer: pdf.getProducer() ?? undefined,
  };
}

// ---- Page routing heuristics --------------------------------------------

/**
 * Categorize a page into one of the Plans-to-Estimate buckets so
 * the multi-pass orchestrator knows which prompt to run. Phase 1
 * uses page-position heuristics:
 *   - First page  -> TITLE_BLOCK
 *   - Pages 2-3   -> BID_SCHEDULE  (Caltrans + Cal FIRE put it
 *                                   immediately after the title)
 *   - Last 30%    -> SPECIFICATIONS
 *   - Everything else -> DRAWINGS
 *
 * Real categorization needs page text content; this is the
 * placeholder until the extractor + a smarter classifier ship.
 */
export type PdfPageCategory =
  | 'TITLE_BLOCK'
  | 'BID_SCHEDULE'
  | 'DRAWINGS'
  | 'SPECIFICATIONS';

export function categorizePage(
  page: PdfPage,
  totalPages: number,
): PdfPageCategory {
  if (page.index === 0) return 'TITLE_BLOCK';
  if (page.index <= 2) return 'BID_SCHEDULE';
  const specStart = Math.floor(totalPages * 0.7);
  if (page.index >= specStart) return 'SPECIFICATIONS';
  return 'DRAWINGS';
}

export function categorizeAll(result: PdfSplitResult): Array<PdfPage & { category: PdfPageCategory }> {
  return result.pages.map((p) => ({ ...p, category: categorizePage(p, result.pageCount) }));
}
