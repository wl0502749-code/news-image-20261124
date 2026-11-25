// news-image-20261124 entry (Node 22+, standard library only).
//
// A deterministic renderer: it draws a 1024x1024 newspaper front page
// summing up Tuesday 24 November 2026's world news, from the stories
// first reported that day, and writes it to /output/entry.png.
// No network, no fonts, no dependencies: a tiny 5x7 bitmap font and a
// hand-rolled PNG encoder (zlib, fixed level) make the output
// byte-identical on every run.
//
// The four stories (all first reported 24 Nov 2026):
//   1. Houthi missile hits the PIF tower in Riyadh - 11 hurt, second
//      strike on the landmark in under a week.
//   2. Israeli airstrikes kill Hamas internal security chief Naeem Abu
//      Nahal and six others in Gaza, despite a ceasefire.
//   3. Overnight Russian strike on flats in Zaporizhzhia: 2 dead,
//      40 wounded; NATO vows to defend space after reports of a
//      Russian nuclear-armed satellite.
//   4. A US jury convicts Huawei of trade-secret theft and bank fraud;
//      Jensen Huang returns as Nvidia CEO and shares surge.
//
// Local run: MAKEFUN_OUTPUT_DIR=out node main.ts

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 4);

function setPixel(x: number, y: number, c: number[]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: number[]): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPixel(cx + x, cy + y, c);
    }
  }
}

// ------------------------------------------------------------- bitmap font
// 5x7 glyphs, one number per row, bit 4 = leftmost pixel.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  '-': [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  '+': [0, 0x04, 0x04, 0x0e, 0x04, 0x04, 0],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  '*': [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
};

function clean(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9 .,;:'\/%+&!?="*()-]/g, ' ');
}

function textWidth(s: string, scale: number): number {
  return clean(s).length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: number[]): void {
  const t = clean(s);
  for (let ci = 0; ci < t.length; ci++) {
    const g = FONT[t[ci]] ?? FONT[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row] & (1 << (4 - col))) {
          fillRect(x + ci * 6 * scale + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: number[]): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

function wrap(s: string, maxChars: number): string[] {
  const words = clean(s).split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------ PNG out
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------ palette
const PAPER = [247, 243, 234];
const INK = [20, 20, 20];
const WHITE = [255, 255, 255];
const DARK = [17, 24, 39];
const RED = [178, 34, 34];
const GREY = [90, 90, 90];
const LIGHT = [232, 228, 218];

// ------------------------------------------------------------------ drawing
fillRect(0, 0, W, H, PAPER);

// Header band
fillRect(16, 16, 992, 134, DARK);
fillRect(16, 144, 992, 6, RED);
drawTextCentered('24 NOVEMBER 2026', 512, 38, 5, WHITE);
drawTextCentered('TUESDAY - THE WORLD IN ONE IMAGE', 512, 102, 2, [200, 200, 200]);

type Panel = {
  x: number; y: number; tag: string; accent: number[];
  headline: string; body: string; stat: string; statLabel: string; num: string;
};

const PANELS: Panel[] = [
  {
    x: 16, y: 166, tag: 'RIYADH - MIDDLE EAST', accent: [178, 34, 34],
    headline: 'MISSILE HITS RIYADH TOWER AGAIN',
    body: "A HOUTHI MISSILE HITS THE PIF TOWER IN RIYADH'S FINANCIAL DISTRICT. 11 PEOPLE ARE HURT. IT IS THE SECOND STRIKE ON THE LANDMARK IN UNDER A WEEK.",
    stat: '11', statLabel: 'PEOPLE HURT IN RIYADH', num: '01',
  },
  {
    x: 520, y: 166, tag: 'GAZA - MIDDLE EAST', accent: [14, 116, 144],
    headline: 'HAMAS SECURITY CHIEF KILLED IN GAZA STRIKE',
    body: 'ISRAELI AIRSTRIKES KILL NAEEM ABU NAHAL, THE HAMAS INTERNAL SECURITY CHIEF, AND SIX OTHERS, INCLUDING TWO POLICE OFFICERS, DESPITE A CEASEFIRE.',
    stat: '7', statLabel: 'KILLED IN THE GAZA STRIKE', num: '02',
  },
  {
    x: 16, y: 538, tag: 'ZAPORIZHZHIA - UKRAINE', accent: [29, 78, 216],
    headline: 'RUSSIAN STRIKE HITS FLATS: 2 DEAD, 40 HURT',
    body: 'AN OVERNIGHT RUSSIAN ATTACK ON AN APARTMENT BLOCK KILLS TWO AND WOUNDS 40, INCLUDING FOUR CHILDREN. NATO VOWS TO DEFEND SPACE AFTER REPORTS OF A RUSSIAN NUCLEAR SATELLITE.',
    stat: '40', statLabel: 'WOUNDED IN ZAPORIZHZHIA', num: '03',
  },
  {
    x: 520, y: 538, tag: 'TECH - MARKETS', accent: [21, 128, 61],
    headline: 'HUAWEI GUILTY, NVIDIA SOARS AS HUANG RETURNS',
    body: 'A US JURY CONVICTS HUAWEI OF TRADE SECRET THEFT AND BANK FRAUD. JENSEN HUANG IS BACK AS NVIDIA CEO AND THE SHARES SURGE.',
    stat: '2', statLabel: 'GUILTY COUNTS VS HUAWEI', num: '04',
  },
];

function motif(i: number, cx: number, cy: number): void {
  const c = WHITE;
  if (i === 0) {
    // tower: three rising bars on a base, with a spire
    fillRect(cx - 26, cy + 4, 12, 12, c);
    fillRect(cx - 6, cy - 8, 12, 24, c);
    fillRect(cx + 14, cy - 2, 12, 18, c);
    fillRect(cx - 2, cy - 16, 4, 8, c);
    fillRect(cx - 28, cy + 16, 56, 3, c);
  } else if (i === 1) {
    // burst: eight spokes
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      drawLine(cx, cy, cx + Math.round(Math.cos(a) * 15), cy + Math.round(Math.sin(a) * 15), c);
    }
    fillCircle(cx, cy, 4, c);
  } else if (i === 2) {
    // shield: triangle over a bar
    drawLine(cx - 14, cy + 10, cx, cy - 14, c);
    drawLine(cx, cy - 14, cx + 14, cy + 10, c);
    drawLine(cx - 14, cy + 10, cx + 14, cy + 10, c);
    fillRect(cx - 6, cy - 2, 12, 6, c);
  } else {
    // chip: square with pins
    fillRect(cx - 10, cy - 10, 20, 20, c);
    fillRect(cx - 4, cy - 4, 8, 8, DARK);
    for (let k = -1; k <= 1; k++) {
      fillRect(cx + k * 8 - 1, cy - 16, 3, 6, c);
      fillRect(cx + k * 8 - 1, cy + 10, 3, 6, c);
      fillRect(cx - 16, cy + k * 8 - 1, 6, 3, c);
      fillRect(cx + 10, cy + k * 8 - 1, 6, 3, c);
    }
  }
}

for (let i = 0; i < PANELS.length; i++) {
  const p = PANELS[i];
  const PW = 488;
  const PH = 356;
  // card
  fillRect(p.x, p.y, PW, PH, WHITE);
  fillRect(p.x, p.y, PW, 3, p.accent);
  fillRect(p.x, p.y + PH - 3, PW, 3, p.accent);
  fillRect(p.x, p.y, 3, PH, p.accent);
  fillRect(p.x + PW - 3, p.y, 3, PH, p.accent);
  // kicker band
  fillRect(p.x + 3, p.y + 3, PW - 6, 44, p.accent);
  drawText(p.tag, p.x + 20, p.y + 17, 2, WHITE);
  motif(i, p.x + PW - 52, p.y + 25);
  // headline (bold: drawn twice, 1px apart)
  const hl = wrap(p.headline, 25);
  hl.forEach((line, li) => {
    drawText(line, p.x + 20, p.y + 66 + li * 26, 3, INK);
    drawText(line, p.x + 21, p.y + 66 + li * 26, 3, INK);
  });
  // body
  const bl = wrap(p.body, 38);
  bl.forEach((line, li) => {
    drawText(line, p.x + 20, p.y + 132 + li * 18, 2, [45, 45, 45]);
  });
  // big stat
  drawText(p.stat, p.x + 20, p.y + 240, 6, p.accent);
  drawText(p.statLabel, p.x + 20 + textWidth(p.stat, 6) + 18, p.y + 258, 2, INK);
  // footer rule + dateline
  fillRect(p.x + 20, p.y + 312, PW - 40, 2, LIGHT);
  drawText('24 NOV 2026', p.x + 20, p.y + 326, 2, GREY);
  drawText(p.num + ' / 04', p.x + PW - 20 - textWidth(p.num + ' / 04', 2), p.y + 326, 2, GREY);
}

// Bottom ticker strip
fillRect(16, 910, 992, 98, DARK);
drawTextCentered('ALSO: NEPAL QUAKE 5.6 - TURKEY HELICOPTER CRASH KILLS 5 - HOSTAGES IN CARTAGENA', 512, 922, 2, WHITE);
drawTextCentered('HORMUZ: 4 TANKERS HIT BY MINES - 14 NATIONS BACK ICJ ROHINGYA RULING', 512, 946, 2, WHITE);
drawTextCentered('SOURCES: SCMP - JUST SECURITY - BBC - REUTERS - DAILY SUMMARY - 24 NOV 2026', 512, 970, 2, [170, 170, 170]);

// ------------------------------------------------------------------ write out
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const dest = join(outDir, 'entry.png');
mkdirSync(outDir, { recursive: true });
writeFileSync(dest, encodePNG());
chmodSync(dest, 0o644);
