// Coverage for the owner-agency classifier. The point: prove the
// compliance defaults that follow each agency kind are correct, since
// downstream code consumes them as the source of truth for whether DAS-140
// applies, whether PW is required, etc.

import { describe, it, expect } from 'vitest';
import { classifyOwnerAgency } from './owner-agency';

describe('classifyOwnerAgency', () => {
  describe('CALTRANS', () => {
    it('classifies a Caltrans owner name with high confidence', () => {
      const out = classifyOwnerAgency({
        ownerName: 'California Department of Transportation',
      });
      expect(out.kind).toBe('CALTRANS');
      expect(out.confidence).toBeGreaterThan(0.9);
      expect(out.compliance.prevailingWage).toBe(true);
      expect(out.compliance.das140Required).toBe(true);
      expect(out.compliance.subListingRequired).toBe(true);
      expect(out.compliance.swpppLikely).toBe(true);
    });

    it('matches the abbreviated form too', () => {
      const out = classifyOwnerAgency({ ownerName: 'Caltrans D2' });
      expect(out.kind).toBe('CALTRANS');
    });
  });

  describe('CAL FIRE', () => {
    it('classifies CAL FIRE owners as CAL_FIRE (not Forest Service)', () => {
      const out = classifyOwnerAgency({
        ownerName: 'CAL FIRE Vegetation Management Program',
      });
      expect(out.kind).toBe('CAL_FIRE');
      expect(out.compliance.prevailingWage).toBe(true);
      expect(out.compliance.davisBacon).toBe(false);
    });

    it('catches "calfire" as one word', () => {
      const out = classifyOwnerAgency({ ownerName: 'CalFire fuel-reduction grant' });
      expect(out.kind).toBe('CAL_FIRE');
    });
  });

  describe('Forest Service / federal', () => {
    it('classifies the Shasta-Trinity NF as Forest Service with Davis-Bacon on', () => {
      const out = classifyOwnerAgency({
        ownerName: 'USDA Forest Service — Shasta-Trinity National Forest',
      });
      expect(out.kind).toBe('FEDERAL_FOREST_SERVICE');
      expect(out.compliance.davisBacon).toBe(true);
      // No CA §4104 sub listing for federal-direct contracts.
      expect(out.compliance.subListingRequired).toBe(false);
      // No DIR DAS-140 either — federal contract takes a different form.
      expect(out.compliance.das140Required).toBe(false);
    });
  });

  describe('County', () => {
    it('classifies Shasta County DPW as COUNTY', () => {
      const out = classifyOwnerAgency({
        ownerName: 'Shasta County Department of Public Works',
      });
      expect(out.kind).toBe('COUNTY');
      expect(out.compliance.subListingRequired).toBe(true);
    });
  });

  describe('Municipal utility', () => {
    it('classifies a PUD owner as MUNICIPAL_UTILITY', () => {
      const out = classifyOwnerAgency({
        ownerName: 'Anderson Public Utility District',
      });
      expect(out.kind).toBe('MUNICIPAL_UTILITY');
      expect(out.compliance.prevailingWage).toBe(true);
    });
  });

  describe('Document-text fallback', () => {
    it('uses the document text when the owner field is empty', () => {
      const docText = `INVITATION TO BID\n\nProject: HWY 36 PM 21.0 to 22.5 RHMA overlay\n` +
        `Owner: California Department of Transportation, District 2`;
      const out = classifyOwnerAgency({ documentText: docText });
      expect(out.kind).toBe('CALTRANS');
    });

    it('returns UNCLASSIFIED with zero confidence when nothing matches', () => {
      const out = classifyOwnerAgency({
        ownerName: 'Acme Widgets Inc',
        documentText: 'order for 50 widgets',
      });
      expect(out.kind).toBe('UNCLASSIFIED');
      expect(out.confidence).toBe(0);
      expect(out.matchedSignals).toEqual([]);
    });
  });

  describe('Private fallback', () => {
    it('returns PRIVATE when the language reads private and no agency matched', () => {
      const out = classifyOwnerAgency({
        ownerName: 'Foothill Acres LLC',
        documentText: 'Private owner agreement for industrial grading.',
      });
      expect(out.kind).toBe('PRIVATE');
      expect(out.compliance.prevailingWage).toBe(false);
      expect(out.compliance.das140Required).toBe(false);
      expect(out.compliance.subListingRequired).toBe(false);
    });
  });

  describe('fundingSource override', () => {
    it('forces CAL_FIRE when fundingSource is "calfire_grant"', () => {
      const out = classifyOwnerAgency({
        ownerName: 'XYZ County',
        fundingSource: 'calfire_grant',
      });
      expect(out.kind).toBe('CAL_FIRE');
      expect(out.confidence).toBe(1);
      expect(out.matchedSignals).toContain('fundingSource=calfire_grant');
    });

    it('forces FEDERAL_OTHER on FEMA funding regardless of owner', () => {
      const out = classifyOwnerAgency({
        ownerName: 'Shasta County',
        fundingSource: 'FEMA',
      });
      expect(out.kind).toBe('FEDERAL_OTHER');
      expect(out.compliance.davisBacon).toBe(true);
    });

    it('ignores an unrecognized fundingSource and falls through to heuristic', () => {
      const out = classifyOwnerAgency({
        ownerName: 'Caltrans D2',
        fundingSource: 'BIZARRO_FUND',
      });
      // Heuristic still hits Caltrans on the owner name.
      expect(out.kind).toBe('CALTRANS');
    });
  });

  describe('priority order', () => {
    it('picks CALTRANS over COUNTY when both names appear', () => {
      const out = classifyOwnerAgency({
        ownerName: 'Caltrans / Shasta County partnership project',
      });
      // Both strong matches exist; Caltrans is declared first so it wins
      // on equal-score ties.
      expect(out.kind).toBe('CALTRANS');
    });

    it('prefers a strong match over a weak match across bundles', () => {
      // 'state highway' is a WEAK Caltrans signal; 'Shasta County' is a
      // STRONG County signal — county wins by score.
      const out = classifyOwnerAgency({
        ownerName: 'Shasta County state highway repair project',
      });
      expect(out.kind).toBe('COUNTY');
    });
  });
});
