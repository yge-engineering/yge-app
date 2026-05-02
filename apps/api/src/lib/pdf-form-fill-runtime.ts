// PDF byte rewriting runtime.
//
// Loads the source PDF for a mapping, walks the AcroForm field tree
// via pdf-lib, writes the computed fill values, optionally embeds
// the signature certificate page, flattens, and returns the bytes
// (and the SHA-256 hash for the signature finalize step).
//
// Phase-1 scope:
//   - TEXT / DATE fields: setText() onto the matching AcroForm field
//   - CHECKBOX fields: check() when the value is non-empty + truthy,
//     uncheck() otherwise
//   - SIGNATURE fields: Phase 1 writes the typed-name string into
//     the field as text (ASCII signature). DRAWN signature image
//     embedding lands when the canvas UI ships
//   - RADIO / DROPDOWN: select() with the value when it matches a
//     known option; otherwise skip + log
//
// Errors are collected per-field rather than aborted — the route
// returns the byte stream plus a list of fields that didn't write
// (e.g. PDF doesn't expose the named field; field type doesn't
// match). The operator decides whether to download as-is or fix
// the mapping first.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument, PDFCheckBox, PDFTextField, PDFDropdown, PDFRadioGroup } from 'pdf-lib';
import {
  computeFillValues,
  type ComputedFieldValue,
  type FillContext,
  type PdfFormFieldMapping,
  type PdfFormMapping,
} from '@yge/shared';

export interface FillPdfWarning {
  fieldId: string;
  pdfFieldName: string;
  reason: string;
}

export interface FillPdfResult {
  bytes: Uint8Array;
  sha256: string;
  warnings: FillPdfWarning[];
  /** Per-field computed values that were applied (or attempted). */
  applied: ComputedFieldValue[];
}

/**
 * Resolve a mapping's `pdfReference` to the bytes on disk. Phase 1
 * lives under apps/api/data/pdf-forms/<reference>; production-like
 * environments will swap to S3 / Supabase Storage once those are
 * wired.
 */
async function loadPdfBytes(reference: string): Promise<Uint8Array> {
  const baseDir =
    process.env.PDF_FORMS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'pdf-forms');
  const candidate = path.resolve(baseDir, reference.replace(/^\/+/, ''));
  // Prevent path traversal — the resolved candidate must live
  // inside baseDir.
  const baseAbs = path.resolve(baseDir);
  if (!candidate.startsWith(baseAbs + path.sep) && candidate !== baseAbs) {
    throw new Error(`Refusing to load PDF outside ${baseAbs}`);
  }
  const buf = await fs.readFile(candidate);
  return new Uint8Array(buf);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Apply one ComputedFieldValue to the matching AcroForm field. Returns
 * a FillPdfWarning when the write doesn't go through (no matching
 * field, type mismatch, etc.); null on success.
 */
function applyFieldValue(
  pdf: PDFDocument,
  field: PdfFormFieldMapping,
  value: ComputedFieldValue,
): FillPdfWarning | null {
  if (value.value === '' && field.kind !== 'CHECKBOX') {
    return null; // nothing to write — leave the field blank
  }

  const form = pdf.getForm();
  let pdfField;
  try {
    pdfField = form.getField(field.pdfFieldName);
  } catch {
    return {
      fieldId: field.id,
      pdfFieldName: field.pdfFieldName,
      reason: 'No matching AcroForm field on the PDF',
    };
  }

  try {
    if (pdfField instanceof PDFTextField) {
      pdfField.setText(value.value);
      return null;
    }
    if (pdfField instanceof PDFCheckBox) {
      const truthy = value.value !== '' && value.value !== 'false' && value.value !== '0';
      if (truthy) pdfField.check();
      else pdfField.uncheck();
      return null;
    }
    if (pdfField instanceof PDFDropdown) {
      pdfField.select(value.value);
      return null;
    }
    if (pdfField instanceof PDFRadioGroup) {
      pdfField.select(value.value);
      return null;
    }
    return {
      fieldId: field.id,
      pdfFieldName: field.pdfFieldName,
      reason: `Unsupported AcroForm field type: ${pdfField.constructor.name}`,
    };
  } catch (err) {
    return {
      fieldId: field.id,
      pdfFieldName: field.pdfFieldName,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run a fill pass against a mapping. Returns the final bytes,
 * sha256, and a list of per-field warnings.
 */
export async function fillPdf(
  mapping: PdfFormMapping,
  ctx: FillContext,
  opts?: { flatten?: boolean },
): Promise<FillPdfResult> {
  const sourceBytes = await loadPdfBytes(mapping.pdfReference);
  const pdf = await PDFDocument.load(sourceBytes);
  const values = computeFillValues(mapping, ctx);
  const warnings: FillPdfWarning[] = [];

  for (let i = 0; i < mapping.fields.length; i += 1) {
    const field = mapping.fields[i]!;
    const value = values[i]!;
    const w = applyFieldValue(pdf, field, value);
    if (w) warnings.push(w);
  }

  if (opts?.flatten ?? true) {
    try {
      pdf.getForm().flatten();
    } catch (err) {
      // Some malformed PDFs throw on flatten — log a warning + return
      // the un-flattened doc so the operator gets something useful.
      warnings.push({
        fieldId: '',
        pdfFieldName: '',
        reason: `Flatten failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const bytes = await pdf.save({ updateFieldAppearances: true });
  return {
    bytes,
    sha256: sha256Hex(bytes),
    warnings,
    applied: values,
  };
}
