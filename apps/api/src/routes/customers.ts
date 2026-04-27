// Customer master routes.

import { Router } from 'express';
import {
  CustomerCreateSchema,
  CustomerPatchSchema,
  customerKindLabel,
  type Customer,
} from '@yge/shared';
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from '../lib/customers-store';
import { maybeCsv } from '../lib/csv-response';

export const customersRouter = Router();

const CUSTOMER_CSV_COLUMNS = [
  { header: 'Legal name', get: (c: Customer) => c.legalName },
  { header: 'DBA', get: (c: Customer) => c.dbaName ?? '' },
  { header: 'Kind', get: (c: Customer) => customerKindLabel(c.kind) },
  { header: 'Contact', get: (c: Customer) => c.contactName ?? '' },
  { header: 'Phone', get: (c: Customer) => c.phone ?? '' },
  { header: 'Email', get: (c: Customer) => c.email ?? '' },
  { header: 'City', get: (c: Customer) => c.city ?? '' },
  { header: 'State', get: (c: Customer) => c.state ?? '' },
  { header: 'Payment terms', get: (c: Customer) => c.paymentTerms ?? '' },
  { header: 'Tax exempt', get: (c: Customer) => (c.taxExempt ? 'Yes' : 'No') },
  { header: 'On hold', get: (c: Customer) => (c.onHold ? 'Yes' : 'No') },
] as const;

customersRouter.get('/', async (req, res, next) => {
  try {
    const customers = await listCustomers({
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
    });
    if (maybeCsv(req, res, customers, CUSTOMER_CSV_COLUMNS, 'customers')) return;
    return res.json({ customers });
  } catch (err) {
    next(err);
  }
});

customersRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await getCustomer(req.params.id);
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    return res.json({ customer: c });
  } catch (err) {
    next(err);
  }
});

customersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CustomerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const c = await createCustomer(parsed.data);
    return res.status(201).json({ customer: c });
  } catch (err) {
    next(err);
  }
});

customersRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = CustomerPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateCustomer(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    return res.json({ customer: updated });
  } catch (err) {
    next(err);
  }
});
