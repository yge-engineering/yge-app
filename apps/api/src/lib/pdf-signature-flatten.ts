// Flatten a drawn signature into the source PDF.
//
// pdf-lib path: load the source PDF (the bytes whose SHA-256 the
// signature row already binds), embed the captured PNG, draw it on
// the last page near the bottom-right (Phase-1 default position;
// per-template placement comes later), flatten the form, and save.
// Returns the bytes + the flattened SHA-256 the /finalize endpoint
// expects.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import type { Signature } from '@yge/shared';

export interface FlattenSignedPdfResult {
  bytes: Uint8Array;
  sha256: string;
  /** Where the bytes were written, relative to data/signed-flattened-pdfs/. */
  reference: string;
}

function sourcePdfDir(): string {
  return (
    process.env.SIGNED_SOURCE_PDFS_DIR ??
    path.resolve(process.cwd(), 'data', 'signed-source-pdfs')
  );
}

function flattenedPdfDir(): string {
  return (
    process.env.SIGNED_FLATTENED_PDFS_DIR ??
    path.resolve(process.cwd(), 'data', 'signed-flattened-pdfs')
  );
}

async function loadSourceBytes(reference: string): Promise<Uint8Array> {
  const baseAbs = path.resolve(sourcePdfDir());
  const candidate = path.resolve(baseAbs, reference.replace(/^\/+/, ''));
  if (!candidate.startsWith(baseAbs + path.sep) && candidate !== baseAbs) {
    throw new Error(`Refusing to load PDF outside ${baseAbs}`);
  }
  const buf = await fs.readFile(candidate);
  return new Uint8Array(buf);
}

function decodePngDataUrl(dataUrl: string): Uint8Array {
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!m) throw new Error('Signature image is not a PNG data URL');
  const base64 = m[1]!;
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Flatten a SIGNED signature into its source PDF and return the
 * bytes + SHA-256 + on-disk reference. Throws when the signature
 * row has no captured image, no document.reference, or the source
 * PDF can't be read.
 */
export async function flattenSignedPdf(signature: Signature): Promise<FlattenSignedPdfResult> {
  if (signature.status !== 'SIGNED') {
    throw new Error(`Cannot flatten signature in status ${signature.status}`);
  }
  if (!signature.signatureImage) {
    throw new Error('Signature row has no captured image to flatten');
  }
  if (!signature.document.reference) {
    throw new Error('Signature row has no document.reference — source PDF location unknown');
  }

  const sourceBytes = await loadSourceBytes(signature.document.reference);
  const pdf = await PDFDocument.load(sourceBytes);

  const pngBytes = decodePngDataUrl(signature.signatureImage.dataUrl);
  const png = await pdf.embedPng(pngBytes);

  const pages = pdf.getPages();
  const lastPage = pages[pages.length - 1];
  if (!lastPage) throw new Error('PDF has no pages');

  const { width: pageW, height: pageH } = lastPage.getSize();
  const targetW = Math.min(220, pageW * 0.4);
  const aspect = signature.signatureImage.heightPx / signature.signatureImage.widthPx;
  const targetH = targetW * aspect;

  // Bottom-right with a 36pt margin. Per-template placement (e.g.
  // a specific named field rectangle) ships when the PDF form
  // mapping schema gains a signaturePlacement entry.
  const margin = 36;
  lastPage.drawImage(png, {
    x: pageW - targetW - margin,
    y: margin,
    width: targetW,
    height: targetH,
  });

  // Plain-text certification line under the image so a reader who
  // opens the flattened PDF can see who signed when. Cert details
  // live on the signature row; this is a visual marker only.
  const captionY = margin - 14;
  if (captionY > 0) {
    const caption = `Signed by ${signature.signer.name}${
      signature.signedAt ? ` · ${signature.signedAt.slice(0, 19).replace('T', ' ')}` : ''
    }`;
    lastPage.drawText(caption.slice(0, 120), {
      x: pageW - targetW - margin,
      y: captionY,
      size: 8,
    });
  }

  // Flatten any AcroForm fields so the saved PDF is non-editable.
  // Some unstructured PDFs throw on flatten — we swallow + continue.
  try { pdf.getForm().flatten(); } catch { /* no AcroForm to flatten */ }

  const bytes = await pdf.save();
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  await fs.mkdir(flattenedPdfDir(), { recursive: true });
  const outPath = path.join(flattenedPdfDir(), `${signature.id}.pdf`);
  await fs.writeFile(outPath, bytes);
  const reference = `${signature.id}.pdf`;

  return { bytes, sha256, reference };
}

/**
 * Read a previously-written flattened PDF off disk. Used by the
 * download endpoint. Returns null when the file isn't present
 * (signature wasn't flattened yet, or the file was rotated out).
 */
export async function readFlattenedPdfBytes(reference: string): Promise<Uint8Array | null> {
  const baseAbs = path.resolve(flattenedPdfDir());
  const candidate = path.resolve(baseAbs, reference.replace(/^\/+/, ''));
  if (!candidate.startsWith(baseAbs + path.sep) && candidate !== baseAbs) {
    return null;
  }
  try {
    const buf = await fs.readFile(candidate);
    return new Uint8Array(buf);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
