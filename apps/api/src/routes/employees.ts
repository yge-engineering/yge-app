// Employees routes — Phase 1 file-backed stand-in for the future Postgres
// `Employee` table. Same pattern as jobs: small JSON-on-disk store behind
// a function surface that maps 1:1 to a Prisma repository.

import { Router } from 'express';
import { EmployeeCreateSchema, EmployeePatchSchema } from '@yge/shared';
import {
  createEmployee,
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
