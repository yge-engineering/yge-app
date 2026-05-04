// DIR rate scraper — fetches CA DIR Office of Policy, Research and Legislation
// (OPRL) prevailing-wage determinations and turns them into staged
// DirRateProposal rows.
//
// Why this matters: live DIR rates drive bid pricing + CPRs. Letting them
// drift means we either underbid (lose money) or overbid (lose work).
// Manual update keeps Ryan + Brook chained to a website; this scraper
// puts the staged-review machinery to work so the operator only has to
// say yes/no to changes the scraper detected.
//
// Data flow:
//   1. fetchDirIndex()           → list of "current general PWD" sheet URLs
//   2. fetchPwdDetermination()   → one PDF / HTML for one (craft, county) pair
//   3. parseRateFromHtml()       → structured rate fields (matches DirRate)
//   4. runDirScrape()            → orchestrator that creates a sync run, walks
//                                  index, fetches each link, parses, stages
//                                  proposals via the existing store, and
//                                  flips the run status at the end
//
// The sync-run + proposal data structures already exist in
// `dir-rate-sync-store.ts` — this module just feeds them.
//
// IMPORTANT: this scraper does NOT write directly to the live DIR rate
// table. It only creates proposals for human review. CLAUDE.md mandates
// that — scrapes can hit transient errors or DIR can publish a typo, and
// silently flipping the live rate poisons every open bid.

import type {
  DirClassification,
  DirRate,
  DirRateProposal,
  DirRateSyncRun,
  DirRateSyncSource,
} from '@yge/shared';
import {
  createProposal,
  createSyncRun,
  updateSyncRunStatus,
} from '../lib/dir-rate-sync-store';
import { listDirRates } from '../lib/dir-rates-store';

// CA DIR public determinations index. Treat as the source of truth for the
// current general prevailing-wage determinations.
export const DIR_INDEX_URL =
  'https://www.dir.ca.gov/oprl/PWD/Determinations.htm';

// Type alias for the proposed-rate body — same shape as DirRate minus
// id/createdAt/updatedAt that get filled when accepted.
type ProposedRateBody = Omit<DirRate, 'id' | 'createdAt' | 'updatedAt'>;

/** One determination link harvested from the DIR index. */
export interface DirDeterminationLink {
  /** The classification text as DIR labels it on the index page. */
  ruleLabel: string;
  /** The county or region the determination applies to. Some are statewide. */
  region: string;
  /** Effective date of the determination (ISO yyyy-mm-dd). */
  effectiveDate: string;
  /** Absolute URL to the determination HTML or PDF. */
  url: string;
}

/** Structured rate fields parsed from a determination page. Matches the
 *  DirRate schema's fringe breakdown so the proposed rate slots in cleanly. */
export interface ParsedRate {
  basicHourlyCents: number;
  healthAndWelfareCents: number;
  pensionCents: number;
  vacationHolidayCents: number;
  trainingCents: number;
  otherFringeCents: number;
  /** Free-form notes captured from the determination — overtime
   *  multiplier text, double-time threshold, shift differential. */
  notes?: string;
}

// ---- Pure parsers --------------------------------------------------------

/** Parse the DIR index HTML and return one entry per (rule, region) pair.
 *  Exposed so unit tests can pass canned HTML and assert the structure
 *  without hitting the network. The parser is intentionally forgiving —
 *  DIR's HTML is hand-edited and the column order has shifted historically. */
export function parseDirIndexHtml(html: string): DirDeterminationLink[] {
  const links: DirDeterminationLink[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const hrefRegex = /<a[^>]*href\s*=\s*"([^"]+)"/i;
  let match: RegExpExecArray | null;
  while ((match = trRegex.exec(html))) {
    const rowHtml = match[1] ?? '';
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    const localTd = new RegExp(tdRegex.source, 'gi');
    while ((cellMatch = localTd.exec(rowHtml))) {
      cells.push((cellMatch[1] ?? '').trim());
    }
    if (cells.length < 4) continue;
    const ruleLabel = stripTags(cells[0] ?? '').trim();
    const region = stripTags(cells[1] ?? '').trim();
    const effectiveDate = stripTags(cells[2] ?? '').trim();
    const linkHtml = cells[3] ?? '';
    const hrefMatch = linkHtml.match(hrefRegex);
    if (!ruleLabel || !region || !effectiveDate || !hrefMatch) continue;
    const href = hrefMatch[1] ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) continue;
    links.push({
      ruleLabel,
      region,
      effectiveDate,
      url: absolutize(href, DIR_INDEX_URL),
    });
  }
  return links;
}

/** Pull rate fields out of a determination HTML page. Returns null if the
 *  required fields can't be found (page format changed; flag for review). */
export function parseRateFromHtml(html: string): ParsedRate | null {
  const text = stripTags(html);
  const basic = extractDollarsAfter(text, /basic\s+hourly\s+rate/i);
  if (basic == null) return null;
  return {
    basicHourlyCents: dollarsToCents(basic),
    healthAndWelfareCents: dollarsToCents(
      extractDollarsAfter(text, /health\s+(?:and|&)\s+welfare/i) ?? 0,
    ),
    pensionCents: dollarsToCents(
      extractDollarsAfter(text, /pension/i) ?? 0,
    ),
    vacationHolidayCents: dollarsToCents(
      extractDollarsAfter(text, /vacation(?:\s+(?:and|&)\s+holiday)?/i) ?? 0,
    ),
    trainingCents: dollarsToCents(
      extractDollarsAfter(text, /training/i) ?? 0,
    ),
    otherFringeCents: dollarsToCents(
      extractDollarsAfter(text, /other(?:\s+fringe)?/i) ?? 0,
    ),
    notes: extractNotes(text),
  };
}

// ---- Network helpers ----------------------------------------------------

/** Fetch the DIR index page. Wrapped so tests can stub `fetch`. */
export async function fetchDirIndex(
  fetchImpl: typeof fetch = fetch,
): Promise<DirDeterminationLink[]> {
  const res = await fetchImpl(DIR_INDEX_URL, {
    headers: { 'User-Agent': 'YGE App / DIR rate sync' },
  });
  if (!res.ok) {
    throw new Error(`DIR index fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  return parseDirIndexHtml(html);
}

/** Fetch one determination page + parse the rate. Returns null on
 *  network errors (caller treats as 'unparsed'). */
export async function fetchPwdDetermination(
  link: DirDeterminationLink,
  fetchImpl: typeof fetch = fetch,
): Promise<{ link: DirDeterminationLink; rate: ParsedRate | null } | null> {
  try {
    const res = await fetchImpl(link.url, {
      headers: { 'User-Agent': 'YGE App / DIR rate sync' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return { link, rate: parseRateFromHtml(html) };
  } catch {
    return null;
  }
}

// ---- Orchestrator -------------------------------------------------------

export interface RunDirScrapeInput {
  source: DirRateSyncSource;
  initiatedByUserId?: string;
  /** Optional list of (classification, county) pairs to focus on. */
  focus?: Array<{ classification: DirClassification; county: string }>;
  /** Override fetch — tests pass a stub. */
  fetchImpl?: typeof fetch;
}

export interface RunDirScrapeResult {
  run: DirRateSyncRun;
  proposals: DirRateProposal[];
  /** Links the scraper saw on the index but couldn't parse — surfaces in
   *  the run summary so the operator can investigate. */
  unparsed: DirDeterminationLink[];
}

/** End-to-end DIR scrape: walk the index, fetch each determination, parse
 *  rates, diff against the live DIR rate set, stage as proposals.
 *
 *  Every store mutation goes through dir-rate-sync-store helpers so the
 *  audit trail is consistent. */
export async function runDirScrape(
  input: RunDirScrapeInput,
): Promise<RunDirScrapeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;

  const run = await createSyncRun({
    source: input.source,
    initiatedByUserId: input.initiatedByUserId,
    sourceReference: DIR_INDEX_URL,
    startedAt: new Date().toISOString(),
    status: 'RUNNING',
  });

  const unparsed: DirDeterminationLink[] = [];
  const proposals: DirRateProposal[] = [];
  let parsedCount = 0;
  let allLinks: DirDeterminationLink[] = [];

  try {
    allLinks = await fetchDirIndex(fetchImpl);
  } catch (err) {
    await updateSyncRunStatus(run.id, {
      status: 'FAILED',
      finishedAt: new Date().toISOString(),
      summary: `DIR index fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      run: { ...run, status: 'FAILED' },
      proposals: [],
      unparsed: [],
    };
  }

  const links = input.focus
    ? allLinks.filter((l) => matchesFocus(l, input.focus!))
    : allLinks;

  // Snapshot the live DIR rate table once — diff each proposal against
  // existing rates without re-querying per loop.
  const liveRates = await listDirRates();
  const liveByKey = new Map<string, DirRate>();
  for (const r of liveRates) {
    liveByKey.set(`${r.classification}|${r.county}`, r);
  }

  for (const link of links) {
    const fetched = await fetchPwdDetermination(link, fetchImpl);
    if (!fetched || !fetched.rate) {
      unparsed.push(link);
      continue;
    }
    parsedCount += 1;

    const classification = ruleLabelToClassification(link.ruleLabel);
    if (!classification) {
      unparsed.push(link);
      continue;
    }
    const county = link.region;

    const existing = liveByKey.get(`${classification}|${county}`);
    const proposedRate: ProposedRateBody = {
      classification,
      county,
      effectiveDate: link.effectiveDate,
      basicHourlyCents: fetched.rate.basicHourlyCents,
      healthAndWelfareCents: fetched.rate.healthAndWelfareCents,
      pensionCents: fetched.rate.pensionCents,
      vacationHolidayCents: fetched.rate.vacationHolidayCents,
      trainingCents: fetched.rate.trainingCents,
      otherFringeCents: fetched.rate.otherFringeCents,
      ...(fetched.rate.notes ? { notes: fetched.rate.notes } : {}),
    };

    const proposal = await createProposal({
      syncRunId: run.id,
      classification,
      county,
      existingRateId: existing?.id ?? null,
      proposedRate,
      rationale: `Scraped ${link.url} (effective ${link.effectiveDate}).`,
    });
    proposals.push(proposal);
  }

  const finalStatus: DirRateSyncRun['status'] =
    parsedCount === 0
      ? 'FAILED'
      : unparsed.length === 0
        ? 'SUCCESS'
        : 'PARTIAL';
  await updateSyncRunStatus(run.id, {
    status: finalStatus,
    finishedAt: new Date().toISOString(),
    proposalsCreated: proposals.length,
    classificationsScraped: parsedCount,
    classificationsFailed: unparsed.length,
    summary: `Walked ${links.length} link${links.length === 1 ? '' : 's'}, parsed ${parsedCount}, staged ${proposals.length} proposal${proposals.length === 1 ? '' : 's'}${unparsed.length > 0 ? `, ${unparsed.length} unparsed` : ''}.`,
  });

  return { run: { ...run, status: finalStatus }, proposals, unparsed };
}

// ---- Local helpers ------------------------------------------------------

function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDollarsAfter(text: string, label: RegExp): number | null {
  const re = new RegExp(
    label.source +
      String.raw`[^\$\d]*\$?\s*([0-9]{1,4}(?:[,][0-9]{3})*(?:\.\d{2})?)`,
    'i',
  );
  const match = text.match(re);
  if (!match) return null;
  const raw = (match[1] ?? '').replace(/,/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}

function extractNotes(text: string): string | undefined {
  const out: string[] = [];
  const ot15 = text.match(
    /overtime[^.]{0,80}(?:1\.?5|time\s+and\s+a\s+half)[^.]{0,80}/i,
  );
  if (ot15) out.push(ot15[0].trim());
  const ot20 = text.match(/double[\s-]?time[^.]{0,80}/i);
  if (ot20) out.push(ot20[0].trim());
  if (out.length === 0) return undefined;
  return out.join(' · ');
}

function absolutize(href: string, base: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function matchesFocus(
  link: DirDeterminationLink,
  focus: Array<{ classification: DirClassification; county: string }>,
): boolean {
  const classification = ruleLabelToClassification(link.ruleLabel);
  if (!classification) return false;
  return focus.some(
    (f) =>
      f.classification === classification &&
      f.county.toLowerCase() === link.region.toLowerCase(),
  );
}

/** Map DIR's free-text rule label to the DirClassification enum. Conservative —
 *  returns null for labels we don't recognize so the operator sees them as
 *  'unparsed' rather than silently mis-classified. */
export function ruleLabelToClassification(
  label: string,
): DirClassification | null {
  const norm = label.toLowerCase().replace(/\s+/g, ' ').trim();
  if (norm.includes('operating engineer')) {
    if (/group\s*1\b/i.test(norm)) return 'OPERATING_ENGINEER_GROUP_1';
    if (/group\s*2\b/i.test(norm)) return 'OPERATING_ENGINEER_GROUP_2';
    if (/group\s*3\b/i.test(norm)) return 'OPERATING_ENGINEER_GROUP_3';
    if (/group\s*4\b/i.test(norm)) return 'OPERATING_ENGINEER_GROUP_4';
    if (/group\s*5\b/i.test(norm)) return 'OPERATING_ENGINEER_GROUP_5';
  }
  if (norm.includes('teamster')) {
    if (/group\s*1\b/i.test(norm)) return 'TEAMSTER_GROUP_1';
    if (/group\s*2\b/i.test(norm)) return 'TEAMSTER_GROUP_2';
  }
  if (norm.includes('laborer')) {
    if (/group\s*1\b/i.test(norm)) return 'LABORER_GROUP_1';
    if (/group\s*2\b/i.test(norm)) return 'LABORER_GROUP_2';
    if (/group\s*3\b/i.test(norm)) return 'LABORER_GROUP_3';
  }
  if (norm.includes('carpenter')) return 'CARPENTER';
  if (norm.includes('cement mason')) return 'CEMENT_MASON';
  if (norm.includes('ironworker')) return 'IRONWORKER';
  return null;
}
