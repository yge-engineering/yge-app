// Gusto integration routes.
//
//   GET  /api/gusto/status      — { configured: bool, configuredFields: [...] }
//   GET  /api/gusto/employees   — Gusto employees + a "matchedLocalId"
//                                 column when the name matches a YGE
//                                 Employee record.

import { Router } from 'express';
import { listEmployees, isGustoConfigured } from '../lib/gusto';
import { listEmployees as listLocalEmployees } from '../lib/employees-store';

export const gustoRouter = Router();

gustoRouter.get('/status', (_req, res) => {
  res.json({
    configured: isGustoConfigured(),
    configuredFields: {
      hasApiKey: Boolean(process.env.GUSTO_API_KEY),
      hasCompanyUuid: Boolean(process.env.GUSTO_COMPANY_UUID),
    },
  });
});

gustoRouter.get('/employees', async (_req, res, next) => {
  try {
    if (!isGustoConfigured()) {
      return res.status(503).json({
        error:
          'Gusto not configured. Set GUSTO_API_KEY + GUSTO_COMPANY_UUID in Render env.',
      });
    }
    const [gusto, local] = await Promise.all([
      listEmployees(),
      listLocalEmployees(),
    ]);

    function normalize(s: string): string {
      return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    const localByName = new Map<string, string>();
    for (const e of local) {
      const k = normalize(`${e.firstName} ${e.lastName}`);
      if (!localByName.has(k)) localByName.set(k, e.id);
    }

    const merged = gusto.map((g) => {
      const k = normalize(`${g.first_name} ${g.last_name}`);
      return {
        gustoUuid: g.uuid,
        firstName: g.first_name,
        lastName: g.last_name,
        email: g.email,
        terminated: Boolean(g.terminated),
        title: g.jobs?.[0]?.title ?? null,
        rate: g.jobs?.[0]?.rate ?? null,
        matchedLocalEmployeeId: localByName.get(k) ?? null,
      };
    });

    return res.json({
      total: merged.length,
      matched: merged.filter((m) => m.matchedLocalEmployeeId).length,
      unmatched: merged.filter((m) => !m.matchedLocalEmployeeId).length,
      employees: merged,
    });
  } catch (err) {
    next(err);
  }
});
