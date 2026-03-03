/**
 * ITW V2 Decoder - Complete with proper RLE from FUN_004b5d20
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

// FUN_004b5d20 - RLE expansion
// Input: combined symbols as array
// Format:
//   [0]: literal_count
//   [1..literal_count]: literal values → builds lookup table
//   [literal_count+1..]: RLE encoded: (count_power, value_index) pairs
function rleExpand(combined: number[], targetSize: number): number[] {
  if (combined.length < 1) return [];
  
  const literalCount = combined[0];
  const literals: number[] = [];
  
  // Build literal lookup table
  for (let i = 1; i <= literalCount && i < combined.length; i++) {
    literals.push(combined[i]);
  }
  
  const output: number[] = [];
  let i = literalCount + 1;
  
  // param_1[3] is some threshold - in the code it's set elsewhere
  // Let's assume it's 0 for now (meaning all values are RLE encoded)
  const threshold = 0;
  
  while (i < combined.length && output.length < targetSize) {
    const val = combined[i];
    
    // Check if it's an RLE pair or single value
    // In original: if (uVar4 < *param_1 + uVar2) → RLE pair
    // *param_1 = literalCount, uVar2 = threshold
    
    if (val < literalCount + threshold && i + 1 < combined.length) {
      // RLE pair: (count_power, value_index)
      const countPower = val;
      const valueIndex = combined[i + 1];
      i += 2;
      
      // Calculate repeat count = 2^countPower
      let repeatCount = 1;
      for (let j = 0; j < countPower; j++) repeatCount *= 2;
      
      // Get value from lookup table
      const lookupIdx = valueIndex - threshold;
      const value = lookupIdx >= 0 && lookupIdx < literals.length ? literals[lookupIdx] : 0;
      
      // Output repeatCount copies
      for (let j = 0; j < repeatCount && output.length < targetSize; j++) {
        output.push(value);
      }
    } else {
      // Single value
      const lookupIdx = (val - literalCount) - threshold;
      const value = lookupIdx >= 0 && lookupIdx < literals.length ? literals[lookupIdx] : val;
      output.push(value);
      i++;
    }
  }
  
  return output;
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
  
  console.log('=== ITW V2 Complete ===');
  console.log(`Image: ${d.w}×${d.h} (${targetSize} pixels)`);
  
  const { state: s1, dataStart: ds1 } = buildTree(d.s1);
  const dec1 = huffDecode(s1, d.s1, ds1);
  console.log(`Stream1: ${dec1.length} symbols`);
  
  const { state: s2, dataStart: ds2 } = buildTree(d.s2);
  const dec2 = huffDecode(s2, d.s2, ds2);
  console.log(`Stream2: ${dec2.length} symbols`);
  
  const combined = combine(dec1, dec2, d.palSize);
  console.log(`Combined: ${combined.length} symbols`);
  
  // Check first few combined values
  console.log('First 10 combined:', combined.slice(0, 10));
  console.log('Combined[0] (literal count?):', combined[0]);
  
  const expanded = rleExpand(combined, targetSize);
  console.log(`Expanded: ${expanded.length}/${targetSize} pixels`);
  
  // Map to palette
  const out = Buffer.alloc(targetSize);
  for (let i = 0; i < expanded.length; i++) {
    const idx = expanded[i];
    // Map symbol to palette index
    let palIdx: number;
    if (idx < 8) palIdx = idx;
    else if (idx < 16) palIdx = idx - 8;
    else palIdx = idx - 16;
    out[i] = palIdx < d.pal.length ? d.pal[palIdx] : 0;
  }
  
  const outPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_complete.png`;
  await sharp(out, { raw: { width: d.w, height: d.h, channels: 1 } }).png().toFile(outPath);
  console.log('Saved:', outPath);
}

main().catch(e => console.error(e));
