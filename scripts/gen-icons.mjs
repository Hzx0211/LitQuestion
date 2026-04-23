// Generate placeholder PNG/ICO/ICNS icons for Tauri bundling.
// Pure Node, no external deps. Replace these later with a proper icon set.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "src-tauri", "icons");
mkdirSync(OUT, { recursive: true });

// Brand gradient approximation: deep indigo -> violet.
function pixel(x, y, size) {
  const t = (x + y) / (2 * size);
  const r = Math.round(60 + t * 80);
  const g = Math.round(40 + t * 30);
  const b = Math.round(150 + t * 80);
  return [r, g, b, 255];
}

function crc32(buf) {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter type none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIco(png256) {
  // ICO containing a single PNG-encoded image (valid for Vista+).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 0; // 256 width
  entry[1] = 0; // 256 height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png256.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png256]);
}

function makeIcns(png512) {
  // ICNS with a single ic09 (512x512) entry in PNG format.
  const type = Buffer.from("ic09", "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(png512.length + 8, 0);
  const inner = Buffer.concat([type, len, png512]);

  const magic = Buffer.from("icns", "ascii");
  const totalLen = Buffer.alloc(4);
  totalLen.writeUInt32BE(inner.length + 8, 0);
  return Buffer.concat([magic, totalLen, inner]);
}

const png32 = makePng(32);
const png128 = makePng(128);
const png256 = makePng(256);
const png512 = makePng(512);

writeFileSync(resolve(OUT, "32x32.png"), png32);
writeFileSync(resolve(OUT, "128x128.png"), png128);
writeFileSync(resolve(OUT, "128x128@2x.png"), png256);
writeFileSync(resolve(OUT, "icon.png"), png512);
writeFileSync(resolve(OUT, "icon.ico"), makeIco(png256));
writeFileSync(resolve(OUT, "icon.icns"), makeIcns(png512));

console.log(`Generated placeholder icons in ${OUT}`);
