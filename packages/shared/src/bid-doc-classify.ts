// Bid-doc filename classifier.
//
// When YGE downloads an agency's bid packet, the ZIP usually contains
// 6–12 PDFs with names like:
//
//   "03-1K2904_Project_Plans.pdf"
//   "03-1K2904_Special_Provisions.pdf"
//   "Addendum_No_2.pdf"
//   "Geotechnical_Report.pdf"
//   "Bid_Item_Schedule.xlsx"
//   "Cover_Letter.pdf"
//   "Q_and_A_Log.pdf"
//
// Plans-to-Estimate works best when each file is routed to the
// extraction pass that fits its content (the bid-schedule pass for
// a fillable bid form vs. the spec-extras pass for special
// provisions). This classifier returns the best guess per filename.

export type BidDocKind =
  | 'PLAN_SET'
  | 'SPECIFICATIONS'
  | 'BID_SCHEDULE'
  | 'ADDENDUM'
  | 'GEOTECH_REPORT'
  | 'ENGINEERS_ESTIMATE'
  | 'COVER_LETTER'
  | 'QA_LOG'
  | 'SUB_LIST'
  | 'BOND_FORMS'
  | 'CONTRACT'
  | 'OTHER';

export interface BidDocClassification {
  filename: string;
  kind: BidDocKind;
  /** Heuristic 0-1 confidence. */
  confidence: number;
  /** First matched keyword (for the tooltip). */
  matchedSignal?: string;
}

interface Pattern {
  kind: BidDocKind;
  /** Strong-match substrings. Any hit → 0.9 confidence. */
  strong: string[];
  /** Weak-match substrings. Any hit → 0.55 (when no strong match). */
  weak?: string[];
}

const PATTERNS: Pattern[] = [
  {
    kind: 'PLAN_SET',
    strong: ['plan set', 'project plans', 'construction plans', 'drawings'],
    weak: ['plans', 'drawing'],
  },
  {
    kind: 'SPECIFICATIONS',
    strong: ['special provisions', 'specifications', 'tech specs', 'project manual'],
    weak: ['spec', 'specs'],
  },
  {
    kind: 'BID_SCHEDULE',
    strong: ['bid item schedule', 'bid schedule', 'bid form', 'unit price form'],
    weak: ['itemized bid'],
  },
  {
    kind: 'ADDENDUM',
    strong: ['addendum', 'addenda'],
  },
  {
    kind: 'GEOTECH_REPORT',
    strong: ['geotechnical report', 'geotech report', 'soils report'],
    weak: ['geotech', 'soils'],
  },
  {
    kind: 'ENGINEERS_ESTIMATE',
    strong: ["engineer's estimate", 'engineers estimate', 'engineer estimate'],
  },
  {
    kind: 'COVER_LETTER',
    strong: ['cover letter', 'transmittal'],
  },
  {
    kind: 'QA_LOG',
    strong: ['q and a log', 'q&a log', 'questions and answers'],
    weak: ['q&a'],
  },
  {
    kind: 'SUB_LIST',
    strong: ['subcontractor list', 'designated subcontractor', '§4104', 'pcc 4104'],
    weak: ['sub list'],
  },
  {
    kind: 'BOND_FORMS',
    strong: ['bid bond', 'performance bond', 'payment bond', 'surety bond'],
    weak: ['bond form'],
  },
  {
    kind: 'CONTRACT',
    strong: ['agreement', 'contract document', 'execution copy'],
    weak: ['contract'],
  },
];

export function classifyBidDoc(filename: string): BidDocClassification {
  // Agencies + estimators routinely use underscores or hyphens in
  // filenames where my keyword list uses spaces. Normalize so
  // "Project_Plans.pdf" and "project-plans.pdf" both match "project
  // plans". Multiple consecutive separators collapse to one space.
  const lower = filename
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
  let best: { p: Pattern; confidence: number; signal?: string } | null = null;
  for (const p of PATTERNS) {
    const strong = p.strong.find((s) => lower.includes(s));
    if (strong) {
      if (!best || best.confidence < 0.9) {
        best = { p, confidence: 0.9, signal: strong };
      }
      continue;
    }
    const weak = (p.weak ?? []).find((s) => lower.includes(s));
    if (weak && (!best || best.confidence < 0.55)) {
      best = { p, confidence: 0.55, signal: weak };
    }
  }
  if (!best) {
    return { filename, kind: 'OTHER', confidence: 0 };
  }
  return {
    filename,
    kind: best.p.kind,
    confidence: best.confidence,
    ...(best.signal ? { matchedSignal: best.signal } : {}),
  };
}

/** Convenience: classify a list of filenames and bucket them by kind. */
export function classifyBidDocs(filenames: string[]): {
  classifications: BidDocClassification[];
  byKind: Map<BidDocKind, BidDocClassification[]>;
} {
  const classifications = filenames.map(classifyBidDoc);
  const byKind = new Map<BidDocKind, BidDocClassification[]>();
  for (const c of classifications) {
    const arr = byKind.get(c.kind) ?? [];
    arr.push(c);
    byKind.set(c.kind, arr);
  }
  return { classifications, byKind };
}
