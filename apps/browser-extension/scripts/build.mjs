#!/usr/bin/env node
// Build the browser extension into dist/ — ready to load unpacked
// in Chrome / Edge / Firefox / Safari.
//
// Bundles every entry point with esbuild, copies the manifest +
// the static HTML pages + the icons (when present), and writes the
// result under apps/browser-extension/dist/. Re-runnable —
// dist/ gets cleaned on every build.
//
// Usage:
//   pnpm --filter @yge/browser-extension build
//
// Output layout:
//   dist/manifest.json
//   dist/src/popup.html  (copied verbatim, refers to popup.js sibling)
//   dist/src/popup.js
//   dist/src/options.html
//   dist/src/options.js
//   dist/src/background.js
//   dist/src/content.js
//   dist/icons/*

import { build } from 'esbuild';
import { mkdir, copyFile, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

async function copyIfExists(src, dest) {
  if (!existsSync(src)) return;
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

async function copyDir(src, dest) {
  if (!existsSync(src)) return;
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const info = await stat(s);
    if (info.isDirectory()) await copyDir(s, d);
    else await copyFile(s, d);
  }
}

async function main() {
  // Clean dist.
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // Bundle entry points.
  const entryPoints = [
    'src/popup.ts',
    'src/options.ts',
    'src/background.ts',
    'src/content.ts',
  ];
  await build({
    entryPoints: entryPoints.map((p) => path.join(root, p)),
    bundle: true,
    minify: false,
    sourcemap: true,
    target: ['chrome111', 'firefox109', 'safari16.4'],
    format: 'esm',
    outdir: path.join(dist, 'src'),
    logLevel: 'info',
  });

  // Copy manifest + static HTML + icons.
  await copyFile(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'));
  await copyIfExists(path.join(root, 'src/popup.html'), path.join(dist, 'src/popup.html'));
  await copyIfExists(path.join(root, 'src/options.html'), path.join(dist, 'src/options.html'));
  await copyDir(path.join(root, 'icons'), path.join(dist, 'icons'));

  console.log(`\nBuilt extension at ${dist}`);
  console.log('Load it via chrome://extensions → Developer mode → Load unpacked.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
