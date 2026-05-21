// Score-based matcher: which vendor is this email from / about?
//
// Pure function (no Anthropic call). Companion to matchEmailToJob — used in
// inbox triage so a COI or vendor-bill email can suggest "→ <Vendor>" and
// deep-link to that vendor record.

export interface EmailVendorMatchInput {
  subject: string;
  fromAddress: string;
  fromName?: string;
  bodyPreview: string;
}

export interface EmailVendorCandidate {
  id: string;
  legalName: string;
  dbaName?: string;
  email?: string;
}

export interface EmailVendorMatchResult {
  vendorId: string | null;
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reasons: string[];
}

function tokens(s: string, minLen = 3): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= minLen);
}

function classify(score: number): EmailVendorMatchResult['confidence'] {
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  if (score >= 3) return 'low';
  return 'none';
}

function domainOf(email: string): string {
  const at = email.indexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

export function matchEmailToVendor(
  email: EmailVendorMatchInput,
  vendors: EmailVendorCandidate[],
): EmailVendorMatchResult {
  if (vendors.length === 0) {
    return { vendorId: null, score: 0, confidence: 'none', reasons: [] };
  }

  const fromLower = email.fromAddress.toLowerCase();
  const fromDomain = domainOf(fromLower);
  // Generic mailbox domains shouldn't count as a vendor signal.
  const genericDomain = /^(gmail|yahoo|hotmail|outlook|aol|icloud|live|comcast|att|me)\./.test(
    fromDomain + '.',
  );
  const hay = `${email.subject} ${email.bodyPreview} ${email.fromName ?? ''}`.toLowerCase();

  let best: EmailVendorMatchResult = { vendorId: null, score: 0, confidence: 'none', reasons: [] };

  for (const v of vendors) {
    let score = 0;
    const reasons: string[] = [];

    if (v.email) {
      const vEmail = v.email.toLowerCase();
      if (vEmail === fromLower) {
        score += 6;
        reasons.push(`from matches ${v.email}`);
      } else if (fromDomain && !genericDomain && domainOf(vEmail) === fromDomain) {
        score += 3;
        reasons.push(`same email domain (${fromDomain})`);
      }
    }

    for (const name of [v.legalName, v.dbaName]) {
      if (!name) continue;
      const nameTokens = new Set(tokens(name, 4));
      let hits = 0;
      for (const tok of nameTokens) if (hay.includes(tok)) hits += 1;
      if (hits >= 1) {
        score += Math.min(hits, 2) * 4;
        reasons.push(`vendor name "${name}" matched ×${hits}`);
        break; // don't double-count legal + DBA
      }
    }

    if (score > best.score) {
      best = { vendorId: v.id, score, confidence: classify(score), reasons };
    }
  }

  return best;
}
