// Employees routes — Phase 1 file-backed stand-in for the future Postgres
// `Employee` table. Same pattern as jobs: small JSON-on-disk store behind
// a function surface that maps 1:1 to a Prisma repository.

import { Router } from 'express';
import { prisma } from '@yge/db';
import { EmployeeCreateSchema, EmployeePatchSchema } from '@yge/shared';
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from '../lib/employees-store';

export const employeesRouter = Router();

// GET /api/employees — newest-first list of every employee.
employeesRouter.get('/', async (_req, res, next) => {
  try {
    const employees = await listEmployees();
    return res.json({ employees });
  } catch (err) {
    next(err);
  }
});

// GET /api/employees/:id — full employee record.
employeesRouter.get('/utilization', async (req, res, next) => {
  try {
    const companyId = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
    const weeks = Math.max(1, Math.min(52, Number(req.query.weeks ?? 8)));

    // ISO week-start (Monday) helper.
    function weekKey(dateStr: string): string {
      const d = new Date(dateStr);
      if (!Number.isFinite(d.getTime())) return '';
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }

    // Cutoff: weeks back from this Monday.
    const todayMon = (() => {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      const day = t.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      t.setDate(t.getDate() + diff);
      return t;
    })();
    const cutoff = new Date(todayMon);
    cutoff.setDate(todayMon.getDate() - 7 * (weeks - 1));
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const reports = await prisma.dailyReport.findMany({
      where: { companyId, deletedAt: null },
    });

    interface Row {
      employee: string;
      ytdHours: number;
      ytdCents: number;
      weeks: Map<string, { hours: number; cents: number; jobs: Set<string> }>;
    }
    const map = new Map<string, Row>();

    for (const r of reports) {
      if (r.reportDate < cutoffStr) continue;
      const wk = weekKey(r.reportDate);
      if (!wk) continue;
      const d = r.data as { lines?: Array<{ costCode?: string | null; description?: string | null; qtyHrs?: number | null; totalCostCents?: number | null; employeeVendor?: string | null; jobNumber?: string | null }> } | null;
      for (const ln of d?.lines ?? []) {
        const code = (ln.costCode ?? '').trim().toUpperCase();
        if (!code.startsWith('LAB-')) continue;
        const emp = (ln.employeeVendor ?? '').trim() || '(unassigned)';
        let row = map.get(emp);
        if (!row) {
          row = {
            employee: emp,
            ytdHours: 0,
            ytdCents: 0,
            weeks: new Map(),
          };
          map.set(emp, row);
        }
        const hrs = ln.qtyHrs ?? 0;
        const cents = ln.totalCostCents ?? 0;
        row.ytdHours += hrs;
        row.ytdCents += cents;
        let wkRow = row.weeks.get(wk);
        if (!wkRow) {
          wkRow = { hours: 0, cents: 0, jobs: new Set() };
          row.weeks.set(wk, wkRow);
        }
        wkRow.hours += hrs;
        wkRow.cents += cents;
        if (ln.jobNumber) wkRow.jobs.add(ln.jobNumber);
      }
    }

    // Build sorted week list (oldest → newest).
    const weekList: string[] = [];
    for (let i = 0; i < weeks; i++) {
      const d = new Date(cutoff);
      d.setDate(cutoff.getDate() + 7 * i);
      weekList.push(d.toISOString().slice(0, 10));
    }

    const rows = [...map.values()]
      .map((r) => ({
        employee: r.employee,
        ytdHours: r.ytdHours,
        ytdCents: r.ytdCents,
        weeks: weekList.map((wk) => {
          const w = r.weeks.get(wk);
          return {
            week: wk,
            hours: w?.hours ?? 0,
            cents: w?.cents ?? 0,
            jobs: w ? [...w.jobs] : [],
          };
        }),
      }))
      .sort((a, b) => b.ytdHours - a.ytdHours);

    res.json({ weeks: weekList, rows });
  } catch (err) { next(err); }
});

employeesRouter.get('/:id', async (req, res, next) => {
  try {
    const employee = await getEmployee(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    return res.json({ employee });
  } catch (err) {
    next(err);
  }
});

// POST /api/employees — create a new employee.
employeesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = EmployeeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const employee = await createEmployee(parsed.data);
    return res.status(201).json({ employee });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/employees/:id — partial update.
employeesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = EmployeePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateEmployee(req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    return res.json({ employee: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/employees/:id — permanently remove. The audit log keeps
// a before-snapshot for legal/HR retention even though the row is gone.
// Caller should normally prefer PATCH { status: 'TERMINATED' } so payroll
// + timecard history still resolves the employee name; delete is for
// genuine "added by mistake" rows.
employeesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteEmployee(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    return res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
