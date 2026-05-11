// Sub portal data endpoints.
//
//   GET /api/portal-sub/my-sub-bids?vendorId=... → list of §4104
//        SubBid rows in YGE estimates that mention this vendor.
//        Match by normalized contractorName OR exact cslbLicense.

import { Router } from 'express';
import { z } from 'zod';
import { listEstimates, getEstimate } from '../lib/estimates-store';
import { getVendor } from '../lib/vendors-store';

export const portalSubRouter = Router();

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

portalSubRouter.get('/my-sub-bids', async (req, res, next) => {
  try {
    const Q = z.object({ vendorId: z.string().min(1).max(120) });
    const parsed = Q.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const vendor = await getVendor(parsed.data.vendorId);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    const vendorNameNorm = normalize(vendor.legalName);
    const dbaNameNorm = vendor.dbaName ? normalize(vendor.dbaName) : null;
    const license = vendor.cslbLicense
      ? vendor.cslbLicense.trim().toLowerCase()
      : null;

    const summaries = await listEstimates();
    const matches: Array<{
      estimateId: string;
      projectName: string;
      bidDueDate: string | undefined;
      bidStatus: string | undefined;
      contractorName: string;
      portionOfWork: string;
      bidAmountCents: number;
      matchedOn: 'name' | 'license';
    }> = [];

    for (const summary of summaries) {
      const est = await getEstimate(summary.id);
      if (!est) continue;
      for (const sb of est.subBids ?? []) {
        const nameNorm = normalize(sb.contractorName);
        const lic = sb.cslbLicense?.trim().toLowerCase();
        let matchedOn: 'name' | 'license' | null = null;
        if (license && lic && license === lic) matchedOn = 'license';
        else if (
          nameNorm === vendorNameNorm ||
          (dbaNameNorm && nameNorm === dbaNameNorm)
        )
          matchedOn = 'name';
        if (!matchedOn) continue;
        matches.push({
          estimateId: est.id,
          projectName: est.projectName,
          bidDueDate: est.bidDueDate,
          bidStatus: est.bidStatus,
          contractorName: sb.contractorName,
          portionOfWork: sb.portionOfWork,
          bidAmountCents: sb.bidAmountCents,
          matchedOn,
        });
      }
    }

    matches.sort((a, b) => {
      const da = a.bidDueDate ?? '';
      const db = b.bidDueDate ?? '';
      return db.localeCompare(da);
    });

    return res.json({ matches });
  } catch (err) {
    next(err);
  }
});
