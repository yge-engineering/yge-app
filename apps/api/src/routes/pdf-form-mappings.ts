// PDF form mappings — the form library.
//
// Mappings are the recipes the filler reads to fill an agency PDF.
// This route surfaces the library list + per-form CRUD, plus a
// dry-run /preview endpoint that returns the per-field computed
// values (auto vs prompt vs sensitive vs pattern violation) so the
// UI can render the pre-fill panel without hitting pdf-lib.

import { Router } from 'express';
import { z } from 'zod';
import {
  PdfFormAgencySchema,
  PdfFormMappingSchema,
  buildFillReport,
} from '@yge/shared';
import { getMasterProfile } from '../lib/master-profile-store';
import {
  createPdfFormMapping,
  getPdfFormMapping,
  listPdfFormMappings,
  updatePdfFormMapping,
} from '../lib/pdf-form-mappings-store';

export const pdfFormMappingsRouter = Router();

const ListQuerySchema = z.object({
  agency: PdfFormAgencySchema.optional(),
  reviewed: z
    .enum(['true', 'false'])
    .transform((s) => s === 'true')
    .optional(),
  search: z.string().min(1).max(200).optional(),
});

pdfFormMappingsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const mappings = await listPdfFormMappings(parsed.data);
    mappings.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return res.json({ mappings });
  } catch (err) { next(err); }
});

pdfFormMappingsRouter.get('/:id', async (req, res, next) => {
  try {
    const mapping = await getPdfFormMapping(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'Form mapping not found' });
    return res.json({ mapping });
  } catch (err) { next(err); }
});

const CreateSchema = PdfFormMappingSchema.omit({ id: true, createdAt: true, updatedAt: true });

pdfFormMappingsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const mapping = await createPdfFormMapping(parsed.data);
    return res.status(201).json({ mapping });
  } catch (err) { next(err); }
});

const PatchSchema = PdfFormMappingSchema.partial();

pdfFormMappingsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const mapping = await updatePdfFormMapping(req.params.id, parsed.data);
    if (!mapping) return res.status(404).json({ error: 'Form mapping not found' });
    return res.json({ mapping });
  } catch (err) { next(err); }
});

const PreviewBodySchema = z.object({
  promptAnswers: z.record(z.string()).optional(),
  bidValidityDays: z.number().int().positive().max(365).optional(),
});

/**
 * Dry-run a fill. Pure-data: returns the buildFillReport summary
 * for the mapping against the current master profile + supplied
 * prompt answers. The byte-rewriting endpoint (POST /:id/fill)
 * lands with the pdf-lib runtime in a follow-up bundle.
 */
pdfFormMappingsRouter.post('/:id/preview', async (req, res, next) => {
  try {
    const parsed = PreviewBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const mapping = await getPdfFormMapping(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'Form mapping not found' });
    const profile = await getMasterProfile();
    const report = buildFillReport(mapping, {
      profile,
      promptAnswers: parsed.data.promptAnswers,
      bidValidityDays: parsed.data.bidValidityDays,
    });
    return res.json({ report });
  } catch (err) { next(err); }
});
