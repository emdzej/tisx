/**
 * ITW V2 Decoder - WORKING VERSION
 * 
 * Format:
 * - Stream1: symbols 8-23 encode run lengths as 2^(sym-8)
 * - Stream2: symbols 1-7 encode palette indices
 * 
 * Combine logic:
 * - If sym < 16: "paired mode" - take color from stream2, run from stream1
 * - If sym >= 16: "single mode" - color = sym-16, run = 2^(sym-8)
 */

import * as fs from 'fs';
import sharp from 'sharp';

interface HuffNode {
  sym: number;
  freq: number;
  index: number;
  left: number;
  right: number;
}

function buildHuffmanTree(buf: Buffer): { nodeMap: Map<number, HuffNode>; root: number; maxT: number; dataStart: number } {
  const count = buf.readUInt32LE(0);
  const entries: HuffNode[] = [];
  let off = 4;
  
  for (let i = 0; i < count; i++) {
    const fb = Buffer.alloc(4);
    fb.writeUInt32LE(buf.readUInt32LE(off + 4));
    entries.push({ sym: buf[off], freq: fb.readFloatLE(0), index: -1, left: -1, right: -1 });
    off += 8;
  }
  
  const maxT = buf.readUInt32LE(off);
  const items = [...entries].sort((a, b) => a.freq - b.freq);
  const nodeMap = new Map<number, HuffNode>();
  let idx = 0;
  
  while (items.length > 1) {
    const l = items.shift()!;
    l.index = idx;
    nodeMap.set(idx++, l);
    
    const r = items.shift()!;
    r.index = idx;
    nodeMap.set(idx++, r);
    
    const combined: HuffNode = { sym: 0, freq: l.freq + r.freq, index: idx, left: l.index, right: r.index };
    nodeMap.set(idx++, combined);
    items.push(combined);
    items.sort((a, b) => a.freq - b.freq);
  }
  
  return { nodeMap, root: idx - 1, maxT, dataStart: off + 4 };
}

function huffmanDecode(tree: ReturnType<typeof buildHuffmanTree>, buf: Buffer, start: number): number[] {
  const { nodeMap, root, maxT } = tree;
  const out: number[] = [];
  let pos = start;
  let node = root;
  let trav = 0;
  
  while (pos < buf.length && trav < maxT) {
    let byte = buf[pos];
    for (let i = 0; i < 8 && trav < maxT; i++) {
      trav++;
      const n = nodeMap.get(node);
      if (!n) break;
      node = (byte & 1) === 0 ? n.left : n.right;
      byte >>= 1;
      const next = nodeMap.get(node);
      if (!next) break;
      if (next.left === -1) {
        out.push(next.sym);
        node = root;
      }
    }
    pos++;
  }
  
  return out;
}

function parseV2(buf: Buffer) {
  let p = 14;
  const palSize = buf[p++];
  const palette: number[] = [];
  for (let i = 0; i < palSize; i++) palette.push(buf[p++]);
  
  const s1Size = buf.readUInt32BE(p);
  p += 4;
  const stream1 = buf.subarray(p, p + s1Size);
  p += s1Size;
  
  const s2Size = buf.readUInt32BE(p);
  p += 4;
  const stream2 = buf.subarray(p, p + s2Size);
  
  return {
    width: buf.readUInt16BE(6),
    height: buf.readUInt16BE(8),
    palette,
    stream1,
    stream2
  };
}

function decodeV2(stream1Symbols: number[], stream2Symbols: number[], palette: number[], targetSize: number): Buffer {
  const pixels: number[] = [];
  let s2i = 0;
  
  for (const sym of stream1Symbols) {
    // Run length = 2^(sym - 8)
    // sym=8 → run=1, sym=15 → run=128, sym=23 → run=32768
    const run = Math.pow(2, sym - 8);
    
    let colorIndex: number;
    if (sym < 16) {
      // Paired mode: color from stream2 (values 1-7)
      colorIndex = s2i < stream2Symbols.length ? stream2Symbols[s2i++] : 7;
    } else {
      // Single mode: color from symbol itself (16→0, 23→7)
      colorIndex = sym - 16;
    }
    
    const pixelValue = palette[colorIndex] ?? 0;
    
    for (let i = 0; i < run && pixels.length < targetSize; i++) {
      pixels.push(pixelValue);
    }
    
    if (pixels.length >= targetSize) break;
  }
  
  return Buffer.from(pixels);
}

async function main() {
  const inputPath = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
  const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_decoded.png`;
  
  const buf = fs.readFileSync(inputPath);
  
  // Check magic and version
  const magic = buf.subarray(0, 4).toString();
  const version = buf.readUInt16BE(12);
  
  if (magic !== 'ITW_' || version !== 0x400) {
    console.error(`Not a V2 ITW file (magic=${magic}, version=0x${version.toString(16)})`);
    process.exit(1);
  }
  
  const data = parseV2(buf);
  console.log(`ITW V2: ${data.width}×${data.height}`);
  console.log(`Palette: [${data.palette.join(', ')}]`);
  
  // Decode Huffman streams
  const tree1 = buildHuffmanTree(data.stream1);
  const s1Symbols = huffmanDecode(tree1, data.stream1, tree1.dataStart);
  console.log(`Stream1: ${s1Symbols.length} symbols (range ${Math.min(...s1Symbols)}-${Math.max(...s1Symbols)})`);
  
  const tree2 = buildHuffmanTree(data.stream2);
  const s2Symbols = huffmanDecode(tree2, data.stream2, tree2.dataStart);
  console.log(`Stream2: ${s2Symbols.length} symbols (range ${Math.min(...s2Symbols)}-${Math.max(...s2Symbols)})`);
  
  // Decode pixels
  const targetSize = data.width * data.height;
  const pixels = decodeV2(s1Symbols, s2Symbols, data.palette, targetSize);
  console.log(`Decoded: ${pixels.length} pixels`);
  
  // Save PNG
  await sharp(pixels, { raw: { width: data.width, height: data.height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`Saved: ${outputPath}`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
