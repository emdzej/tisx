/**
 * ITW V2 Decoder - Alternative RLE interpretation
 * 
 * Hypothesis: literalCount=23 means "use symbols 1-23 as the literal table"
 * NOT "copy 23 values from combined as literals"
 */

import * as fs from 'fs';
import sharp from 'sharp';

interface Node { isLeaf: number; symbol: number; index: number; left: number; right: number; freq: number; }
interface DecoderState { nodeMap: Map<number, Node>; rootIndex: number; maxTraversals: number; }

class MinHeap {
  items: Node[] = [];
  push(n: Node) { this.items.push(n); this.items.sort((a, b) => a.freq - b.freq); }
  pop() { return this.items.shift(); }
  size() { return this.items.length; }
}

function buildTree(buf: Buffer): { state: DecoderState; dataStart: number } {
  const count = buf.readUInt32LE(0);
  const entries: Node[] = [];
  let off = 4;
  for (let i = 0; i < count; i++) {
    const fb = Buffer.alloc(4); fb.writeUInt32LE(buf.readUInt32LE(off + 4));
    entries.push({ isLeaf: 1, symbol: buf[off], index: -1, left: -1, right: -1, freq: fb.readFloatLE(0) });
    off += 8;
  }
  const maxT = buf.readUInt32LE(off);
  const queue = new MinHeap();
  for (const e of entries) queue.push({ ...e });
  const nodeMap = new Map<number, Node>();
  let idx = 0;
  while (queue.size() > 1) {
    const l = queue.pop()!; if (l.isLeaf) { l.index = idx; nodeMap.set(idx++, l); }
    const r = queue.pop()!; if (r.isLeaf) { r.index = idx; nodeMap.set(idx++, r); }
    const c: Node = { isLeaf: 0, symbol: 0, index: idx, left: l.index, right: r.index, freq: l.freq + r.freq };
    nodeMap.set(idx++, c); queue.push(c);
  }
  return { state: { nodeMap, rootIndex: idx - 1, maxTraversals: maxT }, dataStart: off + 4 };
}

function huffDecode(s: DecoderState, buf: Buffer, start: number): number[] {
  const out: number[] = [];
  let pos = start, node = s.rootIndex, trav = 0;
  while (pos < buf.length && trav < s.maxTraversals) {
    let b = buf[pos];
    for (let i = 0; i < 8 && trav < s.maxTraversals; i++) {
      trav++;
      const n = s.nodeMap.get(node); if (!n) break;
      node = (b & 1) === 0 ? n.left : n.right; b >>= 1;
      const nx = s.nodeMap.get(node); if (!nx) break;
      if (nx.isLeaf) { out.push(nx.symbol); node = s.rootIndex; }
    }
    pos++;
  }
  return out;
}

function combine(d1: number[], d2: number[], palSize: number): number[] {
  const out: number[] = [], th = palSize + 8;
  let i2 = 0;
  for (const v of d1) {
    if (v < th && i2 < d2.length) { out.push(d2[i2++]); out.push(v); }
    else out.push(v);
  }
  return out;
}

// Alternative interpretation: skip combined[0], treat rest as direct symbols
// No RLE at all - just map symbols to palette indices
function directDecode(combined: number[], palette: number[]): Buffer {
  const out = Buffer.alloc(combined.length);
  for (let i = 0; i < combined.length; i++) {
    const sym = combined[i];
    let palIdx: number;
    if (sym < 8) palIdx = sym;
    else if (sym < 16) palIdx = sym - 8;
    else palIdx = sym - 16;
    out[i] = palIdx < palette.length ? palette[palIdx] : 0;
  }
  return out;
}

function parseV2(buf: Buffer) {
  let p = 14;
  const palSize = buf[p++];
  const pal: number[] = [];
  for (let i = 0; i < palSize; i++) pal.push(buf[p++]);
  const s1Size = (buf.readUInt16BE(p) << 16) | buf.readUInt16BE(p + 2); p += 4;
  const s1 = buf.subarray(p, p + s1Size); p += s1Size;
  const s2Size = (buf.readUInt16BE(p) << 16) | buf.readUInt16BE(p + 2); p += 4;
  const s2 = buf.subarray(p, p + s2Size);
  return { w: buf.readUInt16BE(6), h: buf.readUInt16BE(8), pal, s1, s2, palSize };
}

async function main() {
  const buf = fs.readFileSync(process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`);
  const d = parseV2(buf);
  const targetSize = d.w * d.h;
  
  console.log('=== ITW V2 Direct (No RLE) ===');
  console.log(`Image: ${d.w}×${d.h} (${targetSize} pixels)`);
  console.log(`Palette: [${d.pal.join(', ')}]`);
  
  const { state: s1, dataStart: ds1 } = buildTree(d.s1);
  const dec1 = huffDecode(s1, d.s1, ds1);
  console.log(`Stream1: ${dec1.length} symbols`);
  
  const { state: s2, dataStart: ds2 } = buildTree(d.s2);
  const dec2 = huffDecode(s2, d.s2, ds2);
  console.log(`Stream2: ${dec2.length} symbols`);
  
  const combined = combine(dec1, dec2, d.palSize);
  console.log(`Combined: ${combined.length} symbols`);
  console.log(`Target: ${targetSize} pixels`);
  console.log(`Ratio needed: ${(targetSize / combined.length).toFixed(2)}x`);
  
  // Try 1: Direct decode (no RLE)
  const pixels1 = directDecode(combined, d.pal);
  await sharp(pixels1, { raw: { width: d.w, height: Math.floor(combined.length / d.w), channels: 1 } })
    .png().toFile(`${process.env.HOME}/.openclaw/workspace/itw_v2_direct.png`);
  console.log('\nSaved direct decode (no RLE):', Math.floor(combined.length / d.w), 'rows');
  
  // Try 2: Treat as simple RLE: (count, value) pairs
  const pixels2: number[] = [];
  for (let i = 0; i < combined.length - 1 && pixels2.length < targetSize; i += 2) {
    const count = combined[i];
    const sym = combined[i + 1];
    let palIdx = sym < 8 ? sym : (sym < 16 ? sym - 8 : sym - 16);
    const value = palIdx < d.pal.length ? d.pal[palIdx] : 0;
    for (let j = 0; j < count && pixels2.length < targetSize; j++) {
      pixels2.push(value);
    }
  }
  const buf2 = Buffer.from(pixels2);
  await sharp(buf2, { raw: { width: d.w, height: Math.floor(pixels2.length / d.w), channels: 1 } })
    .png().toFile(`${process.env.HOME}/.openclaw/workspace/itw_v2_rle_simple.png`);
  console.log('Saved simple RLE:', pixels2.length, 'pixels,', Math.floor(pixels2.length / d.w), 'rows');
}

main().catch(e => console.error(e));
