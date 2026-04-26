// Daily reports routes — foreman end-of-day submissions.
//
// CRUD plus a dedicated /submit endpoint that runs CA meal-break
// enforcement. The PATCH endpoint allows draft-state edits without
// running the violation check, so the foreman can save partial work and
// hit submit when the day's complete.

import { Router } from 'express';
import {
  DailyReportCreateSchema,
  DailyReportPatchSchema,
  reportViolations,
  violationLabel,
} from '@yge/shared';
import {
  createDailyReport,
  getDailyReport,
  listDailyReports,
  updateDailyReport,
} from '../lib/daily-reports-store';

export const dailyReportsRouter = Router();

// GET /api/daily-reports — newest-first list, filterable by job + foreman.
dailyReportsRouter.get('/', async (req, res, next) => {
  try {
    const reports = await listDailyReports({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      foremanId:
        typeof req.query.foremanId === 'string' ? req.query.foremanId : undefined,
    });
    return res.json({ reports });
  } catch (err) {
    next(err);
  }
});

// GET /api/daily-reports/:id — single report.
dailyReportsRouter.get('/:id', async (req, res, next) => {
  try {
    const report = await getDailyReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Daily report not found' });
    return res.json({ report });
  } catch (err) {
    next(err);
  }
});

// POST /api/daily-reports — create a new draft. Doesn't run violation
// check; that lives on /submit so the editor can save midday without
// failing on incomplete crew rows.
dailyReportsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = DailyReportCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const report = await createDailyReport(parsed.data);
    return res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/daily-reports/:id — partial update (does not run the
// CA-violation check; submit endpoint does that).
dailyReportsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = DailyReportPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateDailyReport(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Daily report not found' });
    return res.json({ report: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/daily-reports/:id/submit — runs the CA meal-break
// enforcement check, refuses with 409 + violation list if any non-waived
// violations exist, otherwise sets submitted=true.
dailyReportsRouter.post('/:id/submit', async (req, res, next) => {
  try {
    const existing = await getDailyReport(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Daily report not found' });

    const violations = reportViolations(existing);
    if (violations.length > 0) {
      return res.status(409).json({
        error: 'Meal-break violations must be resolved before submission',
        violations: violations.map((v) => ({
          employeeId: v.row.employeeId,
          messages: v.violations.map(violationLabel),
        })),
      });
    }

    const updated = await updateDailyReport(req.params.id, { submitted: true });
    if (!updated) return res.status(404).json({ error: 'Daily report not found' });
    return res.json({ report: updated });
  } catch (err) {
    next(err);
  }
});
