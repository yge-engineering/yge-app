// Vendor routes.

import { Router } from 'express';
import {
  VendorCreateSchema,
  VendorPatchSchema,
  maskTaxId,
  vendorCoiCurrent,
  vendorKindLabel,
  vendorPaymentTermsLabel,
  vendorW9Current,
  type Vendor,
} from '@yge/shared';
import {
  createVendor,
  getVendor,
  listVendors,
  updateVendor,
} from '../lib/vendors-store';
import { maybeCsv } from '../lib/csv-response';

export const vendorsRouter = Router();

const VENDOR_CSV_COLUMNS = [
  { header: 'Legal name', get: (v: Vendor) => v.legalName },
  { header: 'DBA', get: (v: Vendor) => v.dbaName ?? '' },
  { header: 'Kind', get: (v: Vendor) => vendorKindLabel(v.kind) },
  { header: 'Tax ID (masked)', get: (v: Vendor) => maskTaxId(v.taxId) },
  { header: '1099-NEC', get: (v: Vendor) => (v.is1099Reportable ? 'Yes' : 'No') },
  { header: 'W-9 current', get: (v: Vendor) => (vendorW9Current(v) ? 'Yes' : 'No') },
  { header: 'COI current', get: (v: Vendor) => (vendorCoiCurrent(v) ? 'Yes' : 'No') },
  { header: 'COI expires', get: (v: Vendor) => v.coiExpiresOn ?? '' },
  { header: 'Payment terms', get: (v: Vendor) => vendorPaymentTermsLabel(v.paymentTerms) },
  { header: 'On hold', get: (v: Vendor) => (v.onHold ? 'Yes' : 'No') },
  { header: 'CSLB #', get: (v: Vendor) => v.cslbLicense ?? '' },
  { header: 'DIR #', get: (v: Vendor) => v.dirRegistration ?? '' },
  { header: 'Phone', get: (v: Vendor) => v.phone ?? '' },
  { header: 'Email', get: (v: Vendor) => v.email ?? '' },
  { header: 'City', get: (v: Vendor) => v.city ?? '' },
  { header: 'State', get: (v: Vendor) => v.state ?? '' },
] as const;

vendorsRouter.get('/', async (req, res, next) => {
  try {
    const vendors = await listVendors({
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
    });
    if (maybeCsv(req, res, vendors, VENDOR_CSV_COLUMNS, 'vendors')) return;
    return res.json({ vendors });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.get('/:id', async (req, res, next) => {
  try {
    const v = await getVendor(req.params.id);
    if (!v) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ vendor: v });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = VendorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const v = await createVendor(parsed.data);
    return res.status(201).json({ vendor: v });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = VendorPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateVendor(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ vendor: updated });
  } catch (err) {
    next(err);
  }
});
