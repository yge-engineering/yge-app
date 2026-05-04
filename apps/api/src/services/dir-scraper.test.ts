// Tests for the DIR rate scraper.
//
// Covers the pure parsers (parseDirIndexHtml, parseRateFromHtml,
// ruleLabelToClassification) and the orchestrator (runDirScrape) with a
// stubbed `fetch` impl. We do NOT hit the live DIR site here — those are
// flake risks + slow + the index format moves under us. The fixture HTML
// below mirrors what DIR served as of late-2025 with the rows trimmed
// to keep the test focused.

import { describe, expect, it } from 'vitest';
import {
  parseDirIndexHtml,
  parseRateFromHtml,
  ruleLabelToClassification,
  fetchDirIndex,
  fetchPwdDetermination,
  DIR_INDEX_URL,
} from './dir-scraper';

// Realistic-ish fixture matching the OPRL index page shape.
const INDEX_HTML = `
<html><body>
<table>
  <tr><th>Rule</th><th>Region</th><th>Effective</th><th>Sheet</th></tr>
  <tr>
    <td>Operating Engineers Group 1</td>
    <td>Shasta</td>
    <td>2025-08-22</td>
    <td><a href="/oprl/PWD/2025-2/oe-grp1-shasta.html">PDF</a></td>
  </tr>
  <tr>
    <td>Laborer Group 2</td>
    <td>Shasta</td>
    <td>2025-08-22</td>
    <td><a href="https://www.dir.ca.gov/oprl/PWD/2025-2/laborer-grp2-shasta.html">PDF</a></td>
  </tr>
  <tr>
    <td>Carpenter</td>
    <td>Tehama</td>
    <td>2025-07-01</td>
    <td><a href="/oprl/PWD/2025-2/carpenter-tehama.html">PDF</a></td>
  </tr>
  <!-- Garbage row that should NOT match -->
  <tr><td>not</td><td>enough</td><td>cells</td></tr>
  <!-- Date in wrong format — should be skipped -->
  <tr>
    <td>Operating Engineers Group 1</td>
    <td>Sacramento</td>
    <td>August 22, 2025</td>
    <td><a href="/oprl/PWD/sac.html">PDF</a></td>
  </tr>
</table>
</body></html>
`;

const DETERMINATION_HTML = `
<html><body>
<h1>Operating Engineer — Group 1 — Shasta County</h1>
<p>Basic Hourly Rate: $58.71</p>
<p>Health and Welfare: $11.83</p>
<p>Pension: $14.49</p>
<p>Vacation and Holiday: $5.50</p>
<p>Training: $0.84</p>
<p>Other Fringe: $0.95</p>
<p>Overtime is paid at 1.5x after 8 hours per day, 40 per week.</p>
<p>Double time after 12 hours per day.</p>
</body></html>
`;

describe('parseDirIndexHtml', () => {
  it('extracts well-formed rows', () => {
    const links = parseDirIndexHtml(INDEX_HTML);
    expect(links).toHaveLength(3);
    expect(links[0]?.ruleLabel).toBe('Operating Engineers Group 1');
    expect(links[0]?.region).toBe('Shasta');
    expect(links[0]?.effectiveDate).toBe('2025-08-22');
    expect(links[0]?.url).toBe('https://www.dir.ca.gov/oprl/PWD/2025-2/oe-grp1-shasta.html');
  });

  it('keeps absolute URLs absolute', () => {
    const links = parseDirIndexHtml(INDEX_HTML);
    expect(links[1]?.url).toBe(
      'https://www.dir.ca.gov/oprl/PWD/2025-2/laborer-grp2-shasta.html',
    );
  });

  it('skips rows without 4 cells', () => {
    const links = parseDirIndexHtml(INDEX_HTML);
    // The garbage 3-cell row must not appear
    expect(links.some((l) => l.ruleLabel === 'not')).toBe(false);
  });

  it('skips rows with malformed dates', () => {
    const links = parseDirIndexHtml(INDEX_HTML);
    // The 'August 22, 2025' row must be skipped
    expect(links.some((l) => l.region === 'Sacramento')).toBe(false);
  });

  it('returns empty array on garbage input', () => {
    expect(parseDirIndexHtml('')).toEqual([]);
    expect(parseDirIndexHtml('<html>no table here</html>')).toEqual([]);
  });
});

describe('parseRateFromHtml', () => {
  it('extracts basic + every fringe component', () => {
    const rate = parseRateFromHtml(DETERMINATION_HTML);
    expect(rate).not.toBeNull();
    expect(rate?.basicHourlyCents).toBe(5871);
    expect(rate?.healthAndWelfareCents).toBe(1183);
    expect(rate?.pensionCents).toBe(1449);
    expect(rate?.vacationHolidayCents).toBe(550);
    expect(rate?.trainingCents).toBe(84);
    expect(rate?.otherFringeCents).toBe(95);
  });

  it('captures overtime / double-time language as notes', () => {
    const rate = parseRateFromHtml(DETERMINATION_HTML);
    expect(rate?.notes).toBeTruthy();
    expect(rate?.notes).toMatch(/1\.5/);
    expect(rate?.notes?.toLowerCase()).toMatch(/double[\s-]?time/);
  });

  it('returns null when basic hourly rate is missing', () => {
    expect(parseRateFromHtml('<p>no rate here</p>')).toBeNull();
  });

  it('treats missing fringe components as zero', () => {
    const html = '<p>Basic Hourly Rate: $40.00</p>';
    const rate = parseRateFromHtml(html);
    expect(rate?.basicHourlyCents).toBe(4000);
    expect(rate?.healthAndWelfareCents).toBe(0);
    expect(rate?.pensionCents).toBe(0);
  });
});

describe('ruleLabelToClassification', () => {
  it('maps Operating Engineer groups', () => {
    expect(ruleLabelToClassification('Operating Engineers Group 1')).toBe(
      'OPERATING_ENGINEER_GROUP_1',
    );
    expect(ruleLabelToClassification('OPERATING ENGINEER GROUP 5')).toBe(
      'OPERATING_ENGINEER_GROUP_5',
    );
  });

  it('maps Teamster groups', () => {
    expect(ruleLabelToClassification('Teamster Group 2')).toBe('TEAMSTER_GROUP_2');
  });

  it('maps Laborer groups', () => {
    expect(ruleLabelToClassification('Laborer Group 3')).toBe('LABORER_GROUP_3');
  });

  it('maps single-classification crafts', () => {
    expect(ruleLabelToClassification('Carpenter')).toBe('CARPENTER');
    expect(ruleLabelToClassification('Cement Mason')).toBe('CEMENT_MASON');
    expect(ruleLabelToClassification('Ironworker')).toBe('IRONWORKER');
  });

  it('returns null for unknown labels', () => {
    expect(ruleLabelToClassification('Plumber')).toBeNull();
    expect(ruleLabelToClassification('')).toBeNull();
  });

  it('is case + whitespace insensitive', () => {
    expect(ruleLabelToClassification('  carpenter   ')).toBe('CARPENTER');
    expect(
      ruleLabelToClassification('Operating Engineers   Group 4'),
    ).toBe('OPERATING_ENGINEER_GROUP_4');
  });
});

describe('fetchDirIndex (with stubbed fetch)', () => {
  it('hits the right URL + parses the response', async () => {
    let calledUrl: string | undefined;
    const fetchStub = (async (url: RequestInfo | URL) => {
      calledUrl = String(url);
      return new Response(INDEX_HTML, { status: 200 });
    }) as typeof fetch;
    const links = await fetchDirIndex(fetchStub);
    expect(calledUrl).toBe(DIR_INDEX_URL);
    expect(links).toHaveLength(3);
  });

  it('throws on non-2xx response', async () => {
    const fetchStub = (async () =>
      new Response('Service Unavailable', { status: 503 })) as typeof fetch;
    await expect(fetchDirIndex(fetchStub)).rejects.toThrow(/HTTP 503/);
  });
});

describe('fetchPwdDetermination', () => {
  const link = {
    ruleLabel: 'Operating Engineers Group 1',
    region: 'Shasta',
    effectiveDate: '2025-08-22',
    url: 'https://www.dir.ca.gov/oprl/PWD/2025-2/oe-grp1-shasta.html',
  };

  it('fetches + parses successfully', async () => {
    const fetchStub = (async () =>
      new Response(DETERMINATION_HTML, { status: 200 })) as typeof fetch;
    const result = await fetchPwdDetermination(link, fetchStub);
    expect(result?.link).toEqual(link);
    expect(result?.rate?.basicHourlyCents).toBe(5871);
  });

  it('returns null on HTTP error', async () => {
    const fetchStub = (async () => new Response('', { status: 500 })) as typeof fetch;
    expect(await fetchPwdDetermination(link, fetchStub)).toBeNull();
  });

  it('returns null on network exception', async () => {
    const fetchStub = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;
    expect(await fetchPwdDetermination(link, fetchStub)).toBeNull();
  });
});
