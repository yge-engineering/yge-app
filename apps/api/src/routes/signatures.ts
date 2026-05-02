// E-signature routes — open / sign / finalize / void.
//
// ESIGN/UETA proof bundle is built across these endpoints:
//   POST /api/signatures              create the row in DRAFT
//   GET  /api/signatures              list with filters
//   GET  /api/signatures/:id          read one
//   POST /api/signatures/:id/sign     capture consent + signature
//   POST /api/signatures/:id/finalize attach flattened-pdf hash
//   POST /api/signatures/:id/void     mark the row VOIDED
//
// The flattened-PDF generation (pdf-lib embedding + signature
// certificate page + sha256 of the byte stream) is a separate
// concern — finalize takes the hash and reference; the route
// doesn't compute them. The signing UI calls finalize after the
// server has produced the PDF.

import { Router } from 'express';
import { z } from 'zod';
import {
  SignatureCreateSchema,
  SignatureSchema,
  SignatureStatusSchema,
} from '@yge/shared';
import {
  createSignature,
  finalizeSignature,
  getSignature,
  listSignatures,
  submitSignature,
  voidSignature,
} from '../lib/signatures-store';
import {
  flattenSignedPdf,
  readFlattenedPdfBytes,
} from '../lib/pdf-signature-flatten';

export const signaturesRouter = Router();

// ---- Open + read --------------------------------------------------------

const ListQuerySchema = z.object({
  status: SignatureStatusSchema.optional(),
  documentType: z.string().min(1).max(80).optional(),
  jobId: z.string().min(1).max(120).optional(),
  signerEmail: z.string().email().max(254).optional(),
});

signaturesRouter.get('/', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const signatures = await listSignatures(parsed.data);
    signatures.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return res.json({ signatures });
  } catch (err) { next(err); }
});

signaturesRouter.get('/:id', async (req, res, next) => {
  try {
    const signature = await getSignature(req.params.id);
    if (!signature) return res.status(404).json({ error: 'Signature not found' });
    return res.json({ signature });
  } catch (err) { next(err); }
});

signaturesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = SignatureCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const signature = await createSignature(parsed.data);
    return res.status(201).json({ signature });
  } catch (err) { next(err); }
});

// ---- Sign ----------------------------------------------------------------

const SubmitSchema = z.object({
  consent: SignatureSchema.shape.consent,
  authContext: z.object({
    authMethod: z.enum(['EMAIL_OTP', 'SMS_OTP', 'MAGIC_LINK', 'PASSWORD', 'BIOMETRIC', 'SSO', 'IN_PERSON']),
    ipAddress: z.string().max(64).optional(),
    userAgent: z.string().max(500).optional(),
    deviceId: z.string().max(120).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    sessionId: z.string().max(200).optional(),
    authChallengeId: z.string().max(200).optional(),
    authenticatedAt: z.string().optional(),
  }),
  signatureImage: SignatureSchema.shape.signatureImage,
  signedAt: z.string().optional(),
});

signaturesRouter.post('/:id/sign', async (req, res, next) => {
  try {
    const parsed = SubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    // Capture IP + UA from the request edge if the body didn't supply
    // them — the signature record is the canonical attribution proof
    // and these are the most reliable values to lock in.
    const ip = req.ip ?? parsed.data.authContext.ipAddress;
    const ua = req.get('user-agent') ?? parsed.data.authContext.userAgent;
    const signature = await submitSignature(req.params.id, {
      consent: parsed.data.consent,
      authContext: {
        ...parsed.data.authContext,
        ipAddress: ip,
        userAgent: ua,
      },
      signatureImage: parsed.data.signatureImage,
      signedAt: parsed.data.signedAt,
    });
    if (!signature) return res.status(404).json({ error: 'Signature not found' });
    return res.json({ signature });
  } catch (err) { next(err); }
});

// ---- Finalize ------------------------------------------------------------

const FinalizeSchema = z.object({
  flattenedSha256: z.string().regex(/^[0-9a-f]{64}$/),
  flattenedReference: z.string().max(800).optional(),
});

signaturesRouter.post('/:id/finalize', async (req, res, next) => {
  try {
    const parsed = FinalizeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const signature = await finalizeSignature(
      req.params.id,
      parsed.data.flattenedSha256,
      parsed.data.flattenedReference,
    );
    if (!signature) return res.status(404).json({ error: 'Signature not found' });
    return res.json({ signature });
  } catch (err) { next(err); }
});

// ---- Flatten -------------------------------------------------------------
// Embeds the captured signature image into the source PDF, writes
// the flattened bytes to data/signed-flattened-pdfs/<sigId>.pdf,
// and finalizes the signature row in one shot. Returns the
// updated signature row + the flattened SHA-256.

signaturesRouter.post('/:id/flatten', async (req, res, next) => {
  try {
    const sig = await getSignature(req.params.id);
    if (!sig) return res.status(404).json({ error: 'Signature not found' });
    const result = await flattenSignedPdf(sig);
    const finalized = await finalizeSignature(req.params.id, result.sha256, result.reference);
    return res.json({
      signature: finalized,
      flattenedSha256: result.sha256,
      flattenedReference: result.reference,
      byteLength: result.bytes.byteLength,
    });
  } catch (err) {
    if (err instanceof Error && /no captured image|no document\.reference|status|outside/.test(err.message)) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

signaturesRouter.get('/:id/flattened', async (req, res, next) => {
  try {
    const sig = await getSignature(req.params.id);
    if (!sig?.flattenedReference) return res.status(404).json({ error: 'No flattened PDF' });
    const bytes = await readFlattenedPdfBytes(sig.flattenedReference);
    if (!bytes) return res.status(404).json({ error: 'Flattened PDF missing on disk' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sig.id}-${sig.document.displayName.replace(/[^a-z0-9.-]+/gi, '_').slice(0, 80)}.pdf"`,
    );
    return res.end(Buffer.from(bytes));
  } catch (err) { next(err); }
});

// ---- Void ----------------------------------------------------------------

const VoidSchema = z.object({
  voidedReason: z.string().min(1).max(2000),
  voidedByUserId: z.string().min(1).max(120).optional(),
});

signaturesRouter.post('/:id/void', async (req, res, next) => {
  try {
    const parsed = VoidSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const signature = await voidSignature(
      req.params.id,
      parsed.data.voidedReason,
      parsed.data.voidedByUserId,
    );
    if (!signature) return res.status(404).json({ error: 'Signature not found' });
    return res.json({ signature });
  } catch (err) { next(err); }
});
