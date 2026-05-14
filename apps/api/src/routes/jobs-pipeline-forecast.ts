// GET /api/jobs/pipeline-forecast — risk-adjusted open pipeline.

import { Router } from 'express';
import { prisma } from '@yge/db';

export const jobsPipelineForecastRouter = Router();

function companyId(): string {
  return process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
}

jobsPipelineForecastRouter.get('/pipeline-forecast', async (_req, res, next) => {
  try {
    const co = companyId();
    const jobs = await prisma.job.findMany({
      where: { companyId: co, deletedAt: null },
    });
    const ies = await prisma.importedEstimate.findMany({
      where: { companyId: co, deletedAt: null },
    });
    const bidResults = await prisma.bidResult.findMany({
      where: { companyId: co, deletedAt: null },
    });

    // Per-agency historical win rate.
    interface AgencyStat { total: number; won: number }
    const ownerByJobId = new Map<string, string>();
    for (const j of jobs) {
      const d = j.data as { ownerAgency?: string; client?: string } | null;
      ownerByJobId.set(j.id, d?.ownerAgency ?? d?.client ?? '—');
    }
    const agencyStats = new Map<string, AgencyStat>();
    for (const r of bidResults) {
      const d = r.data as { jobId?: string; outcome?: string } | null;
      const agency = (d?.jobId && ownerByJobId.get(d.jobId)) || '—';
      let st = agencyStats.get(agency);
      if (!st) {
        st = { total: 0, won: 0 };
        agencyStats.set(agency, st);
      }
      st.total += 1;
      if (d?.outcome === 'WON_BY_YGE') st.won += 1;
    }
    function agencyWinRate(agency: string): number {
      const st = agencyStats.get(agency);
      if (!st || st.total < 2) return 0.3; // baseline guess when history thin
      return st.won / st.total;
    }

    // Per-agency expected revenue.
    interface AgencyForecast {
      agency: string;
      openCount: number;
      exposedCents: number;
      riskAdjustedCents: number;
      winRate: number;
    }
    const forecastMap = new Map<string, AgencyForecast>();
    let totalExposed = 0;
    let totalRiskAdjusted = 0;
    let openCount = 0;

    // bidPrice per job: prefer imported estimate; fall back to engineersEstimate.
    const bidByJobId = new Map<string, number>();
    for (const ie of ies) {
      const d = ie.data as { jobId?: string; bidPriceCents?: number } | null;
      if (!d?.jobId || !d.bidPriceCents) continue;
      // Keep highest if multiple estimates share a jobId.
      const prev = bidByJobId.get(d.jobId) ?? 0;
      if (d.bidPriceCents > prev) bidByJobId.set(d.jobId, d.bidPriceCents);
    }

    for (const j of jobs) {
      // Open pipeline: pursuing through submitted.
      if (
        j.status !== 'BIDDING' &&
        // tolerate the Zod-style enum names if they ever surface here
        // @ts-expect-error — keep the check resilient to enum-naming drift.
        j.status !== 'PURSUING' &&
        // @ts-expect-error
        j.status !== 'PROSPECT' &&
        // @ts-expect-error
        j.status !== 'SUBMITTED'
      ) {
        continue;
      }
      const jd = j.data as { engineersEstimateCents?: number; bidTotalCents?: number } | null;
      const bid = bidByJobId.get(j.id)
        ?? jd?.bidTotalCents
        ?? jd?.engineersEstimateCents
        ?? 0;
      if (!bid) continue;

      const agency = ownerByJobId.get(j.id) ?? '—';
      const wr = agencyWinRate(agency);

      let f = forecastMap.get(agency);
      if (!f) {
        f = { agency, openCount: 0, exposedCents: 0, riskAdjustedCents: 0, winRate: wr };
        forecastMap.set(agency, f);
      }
      f.openCount += 1;
      f.exposedCents += bid;
      f.riskAdjustedCents += Math.round(bid * wr);
      f.winRate = wr;

      totalExposed += bid;
      totalRiskAdjusted += Math.round(bid * wr);
      openCount += 1;
    }

    const byAgency = [...forecastMap.values()]
      .sort((a, b) => b.riskAdjustedCents - a.riskAdjustedCents)
      .slice(0, 10);

    res.json({
      openCount,
      exposedCents: totalExposed,
      riskAdjustedCents: totalRiskAdjusted,
      byAgency,
    });
  } catch (err) { next(err); }
});
