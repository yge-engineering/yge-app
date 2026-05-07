#!/usr/bin/env node
// Package the built extension into per-store .zip files.
//
// Run AFTER `pnpm --filter @yge/browser-extension build`. Each store
// gets its own zip because each requires slightly different manifest
// quirks (Firefox needs `browser_specific_settings`, Safari needs
// the .xcodeproj wrapper, etc.). For now they share the same
// manifest; we'll fork later if/when a store rejects something.
//
// Output:
//   dist/yge-extension-chrome-vX.Y.Z.zip
//   dist/yge-extension-edge-vX.Y.Z.zip
//   dist/yge-extension-firefox-vX.Y.Z.zip

import { createWriteStream, existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

async function readManifest() {
  const raw = await readFile(path.join(root, 'manifest.json'), 'utf8');
  return JSON.parse(raw);
}

async function zipDir(target, label) {
  if (!existsSync(dist)) {
    console.error(`Build first: pnpm --filter @yge/browser-extension build`);
    process.exit(1);
  }
  // Use the system zip binary — it's universally available on macOS,
  // Linux, and the GitHub Actions runners. Avoids pulling another npm dep.
  execSync(`cd "${dist}" && zip -r "${target}" . -x "*.zip"`, {
    stdio: 'inherit',
  });
  console.log(`Packaged ${label} → ${target}`);
}

async function main() {
  const manifest = await readManifest();
  const version = manifest.version;
  for (const store of ['chrome', 'edge', 'firefox']) {
    const target = path.join(dist, `yge-extension-${store}-v${version}.zip`);
    await zipDir(target, store);
  }
  console.log('\nDone. Upload via:');
  console.log('  Chrome  → https://chrome.google.com/webstore/devconsole');
  console.log('  Edge    → https://partner.microsoft.com/en-us/dashboard/microsoftedge');
  console.log('  Firefox → https://addons.mozilla.org/en-US/developers/');
  console.log('  Safari  → see SUBMIT.md (Xcode wrapper required)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
