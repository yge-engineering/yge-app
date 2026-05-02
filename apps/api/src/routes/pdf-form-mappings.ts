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
import { fillPdf } from '../lib/pdf-form-fill-runtime';

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

const FillBodySchema = z.object({
  promptAnswers: z.record(z.string()).optional(),
  bidValidityDays: z.number().int().positive().max(365).optional(),
  /** Optional: skip the AcroForm flatten so reviewers can edit the
   *  filled PDF in Acrobat before sealing. Default true (matches the
   *  agency expectation that the submitted PDF is non-editable). */
  flatten: z.boolean().optional(),
});

/**
 * Run the byte-rewriting fill and stream the resulting PDF back as
 * application/pdf. Warnings (missing fields, type mismatches) ride
 * along on response headers so a client that wants them can show
 * them inline; the body is just the PDF bytes.
 */
pdfFormMappingsRouter.post('/:id/fill', async (req, res, next) => {
  try {
    const parsed = FillBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const mapping = await getPdfFormMapping(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'Form mapping not found' });
    const profile = await getMasterProfile();
    const result = await fillPdf(
      mapping,
      {
        profile,
        promptAnswers: parsed.data.promptAnswers,
        bidValidityDays: parsed.data.bidValidityDays,
      },
      { flatten: parsed.data.flatten ?? true },
    );
    res.setHeader('Content-Type', 'application/pdf');
    const filename = (mapping.formCode ?? 'filled').replace(/[^A-Za-z0-9._-]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.setHeader('X-PDF-Sha256', result.sha256);
    res.setHeader('X-PDF-Warning-Count', String(result.warnings.length));
    return res.status(200).end(Buffer.from(result.bytes));
  } catch (err) { next(err); }
});
