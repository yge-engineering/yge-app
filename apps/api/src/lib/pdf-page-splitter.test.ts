import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { categorizeAll, categorizePage, splitPdfPages } from './pdf-page-splitter';

async function makePdfWithPages(count: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < count; i += 1) {
    pdf.addPage([612, 792]); // letter
  }
  pdf.setTitle('Test plan set');
  return pdf.save();
}

describe('splitPdfPages', () => {
  it('returns one page record per source page', async () => {
    const bytes = await makePdfWithPages(5);
    const result = await splitPdfPages(bytes);
    expect(result.pageCount).toBe(5);
    expect(result.pages).toHaveLength(5);
    expect(result.pages[0]!.widthPts).toBe(612);
    expect(result.pages[0]!.heightPts).toBe(792);
    expect(result.title).toBe('Test plan set');
  });

  it('marks every page needsOcr=true in phase 1', async () => {
    const bytes = await makePdfWithPages(3);
    const result = await splitPdfPages(bytes);
    expect(result.pages.every((p) => p.needsOcr)).toBe(true);
  });
});

describe('categorizePage', () => {
  it('first page -> TITLE_BLOCK', () => {
    const page = { index: 0, widthPts: 612, heightPts: 792, text: '', needsOcr: true };
    expect(categorizePage(page, 100)).toBe('TITLE_BLOCK');
  });

  it('pages 1-2 -> BID_SCHEDULE', () => {
    expect(categorizePage({ index: 1, widthPts: 0, heightPts: 0, text: '', needsOcr: true }, 100)).toBe('BID_SCHEDULE');
    expect(categorizePage({ index: 2, widthPts: 0, heightPts: 0, text: '', needsOcr: true }, 100)).toBe('BID_SCHEDULE');
  });

  it('last 30% -> SPECIFICATIONS', () => {
    expect(categorizePage({ index: 70, widthPts: 0, heightPts: 0, text: '', needsOcr: true }, 100)).toBe('SPECIFICATIONS');
    expect(categorizePage({ index: 99, widthPts: 0, heightPts: 0, text: '', needsOcr: true }, 100)).toBe('SPECIFICATIONS');
  });

  it('middle pages -> DRAWINGS', () => {
    expect(categorizePage({ index: 30, widthPts: 0, heightPts: 0, text: '', needsOcr: true }, 100)).toBe('DRAWINGS');
  });
});

describe('categorizeAll', () => {
  it('annotates each page with a category', async () => {
    const bytes = await makePdfWithPages(10);
    const result = await splitPdfPages(bytes);
    const annotated = categorizeAll(result);
    expect(annotated[0]!.category).toBe('TITLE_BLOCK');
    expect(annotated[1]!.category).toBe('BID_SCHEDULE');
    expect(annotated[9]!.category).toBe('SPECIFICATIONS');
  });
});
