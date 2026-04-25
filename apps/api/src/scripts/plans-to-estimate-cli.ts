// Dry-run CLI for the Plans-to-Estimate feature.
//
// Lets a YGE estimator point at a plain-text file (already-extracted RFP text,
// markdown takeoff notes, or anything readable as UTF-8) and get a draft
// estimate back without spinning up the full web app. Result is printed and
// saved as a JSON file next to the source.
//
// PDF extraction is intentionally NOT bundled here — different PDFs need
// different tools (Bluebeam export, Acrobat OCR, pdftotext, etc.) and each
// pulls in a heavy native dependency. The estimator pipes their PDF through
// whatever tool gives the cleanest text, then runs this CLI on the .txt/.md.
//
// Usage:
//   pnpm --filter @yge/api dry-run:ptoe -- <path/to/doc.txt> [--notes "..."]
//
// The "--" is required by pnpm to forward args to the script.

import 'dotenv/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runPlansToEstimate, PlansToEstimateError } from '../services/plans-to-estimate';

interface CliArgs {
  filePath: string;
  notes?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    throw new Error(
      'Missing file path.\n' +
        'Usage: pnpm --filter @yge/api dry-run:ptoe -- <path/to/doc.txt> [--notes "..."]',
    );
  }

  let filePath: string | undefined;
  let notes: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined) continue;
    if (a === '--notes' || a === '-n') {
      notes = args[++i];
    } else if (!a.startsWith('-') && !filePath) {
      filePath = a;
    }
  }

  if (!filePath) throw new Error('No file path supplied.');
  return { filePath, notes };
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    throw new Error(
      'Direct PDF input is not supported by this dry-run yet.\n' +
        'Export the PDF to text first (Bluebeam: File → Export → Text;\n' +
        'Acrobat: File → Export To → Text; or `pdftotext file.pdf file.txt`)\n' +
        'and pass the .txt path instead.',
    );
  }

  // Treat everything else as utf-8 text. Covers .txt, .md, plain spec dumps.
  const buf = await fs.readFile(filePath);
  return buf.toString('utf8');
}

function summarize(out: { projectName: string; bidItems: unknown[]; overallConfidence: string }) {
  return [
    `Project:    ${out.projectName}`,
    `Confidence: ${out.overallConfidence}`,
    `Bid items:  ${out.bidItems.length}`,
  ].join('\n');
}

async function main() {
  const { filePath, notes } = parseArgs(process.argv);
  const absPath = path.resolve(filePath);

  process.stderr.write(`Reading ${absPath}\n`);
  const documentText = await extractText(absPath);
  const charCount = documentText.length;
  process.stderr.write(`Extracted ${charCount.toLocaleString()} characters of text.\n`);

  if (charCount < 50) {
    throw new Error(
      'Extracted text is suspiciously short. ' +
        'If this is a scanned PDF, OCR is not yet implemented in the dry-run.',
    );
  }

  process.stderr.write('Calling Anthropic — this typically takes 30-90 seconds...\n');
  const start = Date.now();

  const result = await runPlansToEstimate({
    documentText,
    sessionNotes: notes,
  });

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  process.stderr.write(
    `Done in ${seconds}s. Model: ${result.modelUsed}. Prompt: ${result.promptVersion}. ` +
      `Tokens: in=${result.usage.inputTokens}, out=${result.usage.outputTokens}\n\n`,
  );

  // Pretty summary to stdout
  process.stdout.write(summarize(result.output) + '\n\n');

  // Full JSON saved next to the source doc
  const outPath = absPath.replace(/\.[^.]+$/, '') + '.draft-estimate.json';
  await fs.writeFile(outPath, JSON.stringify(result, null, 2), 'utf8');
  process.stdout.write(`Full draft saved to: ${outPath}\n`);
}

main().catch((err) => {
  if (err instanceof PlansToEstimateError) {
    process.stderr.write(`\nPlans-to-Estimate error: ${err.message}\n`);
  } else if (err instanceof Error) {
    process.stderr.write(`\nError: ${err.message}\n`);
  } else {
    process.stderr.write(`\nUnknown error: ${String(err)}\n`);
  }
  process.exit(1);
});
