// GL posting status — which AR/AP invoices have a journal entry yet.
//
// Pairs with the post-to-GL feature: every AR invoice and AP invoice can
// generate a journal entry (source AR_INVOICE / AP_INVOICE, sourceRef =
// invoice id) that an accountant reviews and posts. This helper answers
// "what still needs a GL entry?" by joining invoices to their journal
// entries.
//
// State per invoice:
//   POSTED   — a non-voided journal entry exists and is posted
//   DRAFT    — a non-voided journal entry exists but is still a draft
//   UNPOSTED — no non-voided journal entry references this invoice
//
// Pure function over plain inputs so it stays decoupled from the full
// invoice / journal-entry schemas and is trivial to test.

export type GlPostingState = 'POSTED' | 'DRAFT' | 'UNPOSTED';

export interface GlPostingInvoiceInput {
  id: string;
  invoiceNumber: string;
  totalCents: number;
  status: string;
  /** AR invoices carry customerName; AP invoices carry vendorName. */
  customerName?: string;
  vendorName?: string;
}

export interface GlPostingJournalEntryInput {
  id: string;
  source: string;
  sourceRef?: string;
  status: string;
}

export interface GlPostingStatusRow {
  invoiceId: string;
  kind: 'AR' | 'AP';
  invoiceNumber: string;
  /** Customer (AR) or vendor (AP) display name. */
  party: string;
  totalCents: number;
  invoiceStatus: string;
  glState: GlPostingState;
  /** Matched journal entry (posted preferred over draft), if any. */
  journalEntryId?: string;
}

export interface GlPostingStatusSummary {
  rows: GlPostingStatusRow[];
  arUnposted: number;
  arDraft: number;
  arPosted: number;
  apUnposted: number;
  apDraft: number;
  apPosted: number;
  /** Sum of totalCents across all UNPOSTED rows (AR + AP). */
  unpostedTotalCents: number;
}

interface JeMatch {
  postedId?: string;
  draftId?: string;
}

const STATE_ORDER: Record<GlPostingState, number> = {
  UNPOSTED: 0,
  DRAFT: 1,
  POSTED: 2,
};

function indexJournalEntries(
  entries: GlPostingJournalEntryInput[],
): Map<string, JeMatch> {
  const index = new Map<string, JeMatch>();
  for (const je of entries) {
    if (!je.sourceRef) continue;
    if (je.status === 'VOIDED') continue;
    if (je.source !== 'AR_INVOICE' && je.source !== 'AP_INVOICE') continue;
    const key = `${je.source}:${je.sourceRef}`;
    const match = index.get(key) ?? {};
    if (je.status === 'POSTED') {
      if (!match.postedId) match.postedId = je.id;
    } else if (!match.draftId) {
      match.draftId = je.id;
    }
    index.set(key, match);
  }
  return index;
}

function resolveState(match: JeMatch | undefined): {
  glState: GlPostingState;
  journalEntryId?: string;
} {
  if (match?.postedId) return { glState: 'POSTED', journalEntryId: match.postedId };
  if (match?.draftId) return { glState: 'DRAFT', journalEntryId: match.draftId };
  return { glState: 'UNPOSTED' };
}

function buildRow(
  inv: GlPostingInvoiceInput,
  kind: 'AR' | 'AP',
  index: Map<string, JeMatch>,
): GlPostingStatusRow {
  const source = kind === 'AR' ? 'AR_INVOICE' : 'AP_INVOICE';
  const resolved = resolveState(index.get(`${source}:${inv.id}`));
  const party = (kind === 'AR' ? inv.customerName : inv.vendorName) ?? '';
  return {
    invoiceId: inv.id,
    kind,
    invoiceNumber: inv.invoiceNumber,
    party,
    totalCents: inv.totalCents,
    invoiceStatus: inv.status,
    glState: resolved.glState,
    journalEntryId: resolved.journalEntryId,
  };
}

export function buildGlPostingStatus(
  arInvoices: GlPostingInvoiceInput[],
  apInvoices: GlPostingInvoiceInput[],
  journalEntries: GlPostingJournalEntryInput[],
): GlPostingStatusSummary {
  const index = indexJournalEntries(journalEntries);
  const rows: GlPostingStatusRow[] = [
    ...arInvoices.map((inv) => buildRow(inv, 'AR', index)),
    ...apInvoices.map((inv) => buildRow(inv, 'AP', index)),
  ];

  rows.sort((a, b) => {
    const s = STATE_ORDER[a.glState] - STATE_ORDER[b.glState];
    if (s !== 0) return s;
    if (a.kind !== b.kind) return a.kind === 'AR' ? -1 : 1;
    return a.invoiceNumber.localeCompare(b.invoiceNumber);
  });

  const summary: GlPostingStatusSummary = {
    rows,
    arUnposted: 0,
    arDraft: 0,
    arPosted: 0,
    apUnposted: 0,
    apDraft: 0,
    apPosted: 0,
    unpostedTotalCents: 0,
  };

  for (const row of rows) {
    if (row.kind === 'AR') {
      if (row.glState === 'UNPOSTED') summary.arUnposted += 1;
      else if (row.glState === 'DRAFT') summary.arDraft += 1;
      else summary.arPosted += 1;
    } else {
      if (row.glState === 'UNPOSTED') summary.apUnposted += 1;
      else if (row.glState === 'DRAFT') summary.apDraft += 1;
      else summary.apPosted += 1;
    }
    if (row.glState === 'UNPOSTED') summary.unpostedTotalCents += row.totalCents;
  }

  return summary;
}
