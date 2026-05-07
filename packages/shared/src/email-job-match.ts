// Score-based matcher: which job is this email likely about?
//
// Pure function — no Anthropic call here. Cheap to run on every
// triage so the UI can suggest "File to <project>" inline.

export interface EmailJobMatchInput {
  subject: string;
  fromAddress: string;
  bodyPreview: string;
}

export interface EmailJobCandidateJob {
  id: string;
  projectName: string;
  /** Optional jobNumber — Phase 1 jobs lacked this; Phase 2 derived
   *  from the id suffix. Pass when present. */
  jobNumber?: string;
  customerLegalName?: string;
  customerDbaName?: string;
  customerEmail?: string;
}

export interface EmailJobMatchResult {
  jobId: string | null;
  score: number;
  /** "high" / "medium" / "low" buckets the score so UIs can render
   *  consistent confidence pills. */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Matching signals — useful in audit + debug views. */
  reasons: string[];
}

function tokens(s: string, minLen = 3): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= minLen);
}

function classify(score: number): EmailJobMatchResult['confidence'] {
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  if (score >= 3) return 'low';
  return 'none';
}

export function matchEmailToJob(
  email: EmailJobMatchInput,
  jobs: EmailJobCandidateJob[],
): EmailJobMatchResult {
  if (jobs.length === 0) {
    return { jobId: null, score: 0, confidence: 'none', reasons: [] };
  }

  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.bodyPreview.toLowerCase();
  const fromLower = email.fromAddress.toLowerCase();
  const subjectAndBody = `${subjectLower} ${bodyLower}`;

  let best: EmailJobMatchResult = {
    jobId: null,
    score: 0,
    confidence: 'none',
    reasons: [],
  };

  for (const job of jobs) {
    let score = 0;
    const reasons: string[] = [];

    // From-address exact match against customer email.
    if (
      job.customerEmail &&
      job.customerEmail.toLowerCase() === fromLower
    ) {
      score += 6;
      reasons.push(`from matches ${job.customerEmail}`);
    }

    // Project-name token overlap with subject + body. Each unique
    // token >=4 chars in projectName found in the email adds +5
    // (capped at 3 token hits to avoid runaway scores on long
    // projectNames). Words like "the", "and" filtered by minLen.
    const projectTokens = new Set(tokens(job.projectName, 4));
    let projectHits = 0;
    for (const tok of projectTokens) {
      if (subjectAndBody.includes(tok)) projectHits += 1;
    }
    const projectScore = Math.min(projectHits, 3) * 5;
    if (projectScore > 0) {
      score += projectScore;
      reasons.push(
        `project-name token hit ×${projectHits} ("${job.projectName}")`,
      );
    }

    // Job number in subject.
    if (job.jobNumber && subjectLower.includes(job.jobNumber.toLowerCase())) {
      score += 4;
      reasons.push(`job number "${job.jobNumber}" in subject`);
    }

    // Customer legal / DBA name in subject or body. Treat as a
    // distinct token-overlap with min 4 chars.
    for (const name of [job.customerLegalName, job.customerDbaName]) {
      if (!name) continue;
      const nameTokens = new Set(tokens(name, 4));
      let nameHits = 0;
      for (const tok of nameTokens) {
        if (subjectAndBody.includes(tok)) nameHits += 1;
      }
      if (nameHits >= 1) {
        score += 3;
        reasons.push(`customer name "${name}" matched`);
        break; // Don't double-count if both legalName + dbaName hit.
      }
    }

    if (score > best.score) {
      best = {
        jobId: job.id,
        score,
        confidence: classify(score),
        reasons,
      };
    }
  }

  return best;
}
