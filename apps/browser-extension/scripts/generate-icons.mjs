#!/usr/bin/env node
// Generate the three solid-color PNG icons referenced by manifest.json.
//
// Plain English: Chrome's extension UI needs 16/48/128 px icons. We
// don't have brand artwork yet, so we ship solid-color YGE-blue
// squares so the extension loads cleanly without missing-asset
// warnings. Swap these for real artwork when it lands.
//
// Uses only Node built-ins: Buffer + zlib for the IDAT payload + a
// hand-written CRC32 for each chunk. Outputs to ../icons/.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'icons');

// YGE brand blue (#1e40af) as RGB.
const FILL = { r: 0x1e, g: 0x40, b: 0xaf, a: 0xff };

// CRC32 — table-driven.
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const forCrc = Buffer.concat([typeBuf, data]);
  crc.writeUInt32BE(crc32(forCrc), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr.writeUInt8(8, 8);       // bit depth
  ihdr.writeUInt8(6, 9);       // color type RGBA
  ihdr.writeUInt8(0, 10);      // compression
  ihdr.writeUInt8(0, 11);      // filter
  ihdr.writeUInt8(0, 12);      // interlace

  // IDAT — for each row: filter byte (0 = None) + RGBA bytes
  const bytesPerRow = 1 + size * 4;
  const raw = Buffer.alloc(bytesPerRow * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * bytesPerRow;
    raw[rowStart] = 0; // filter type
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 4;
      raw[p] = FILL.r;
      raw[p + 1] = FILL.g;
      raw[p + 2] = FILL.b;
      raw[p + 3] = FILL.a;
    }
  }
  const compressed = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  const png = makePng(size);
  const out = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
