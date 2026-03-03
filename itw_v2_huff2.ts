/**
 * ITW V2 - Proper Huffman tree from frequencies
 */

import * as fs from 'fs';
import sharp from 'sharp';

interface Node {
  symbol: number | null;
  freq: number;
  left: Node | null;
  right: Node | null;
}

function buildHuffmanTree(entries: Array<{ symbol: number; freq: number }>): Node {
  // Create leaf nodes
  let nodes: Node[] = entries.map(e => ({
    symbol: e.symbol,
    freq: e.freq,
    left: null,
    right: null
  }));
  
  // Sort by frequency DESCENDING (highest first)
  nodes.sort((a, b) => b.freq - a.freq);
  
  // Build tree - take from END (lowest freq)
  while (nodes.length > 1) {
    const right = nodes.pop()!;
    const left = nodes.pop()!;
    
    const parent: Node = {
      symbol: null,
      freq: left.freq + right.freq,
      left,
      right
    };
    
    // Insert maintaining descending order
    let i = 0;
    while (i < nodes.length && nodes[i].freq > parent.freq) i++;
    nodes.splice(i, 0, parent);
  }
  
  return nodes[0] || { symbol: 0, freq: 0, left: null, right: null };
}

function decodeHuffman(
  stream: Buffer,
  start: number,
  root: Node,
  maxSym: number
): number[] {
  const output: number[] = [];
  let pos = start;
  let bitPos = 0;
  let current = root;
  
  while (output.length < maxSym && pos < stream.length) {
    // Read bit
    const bit = (stream[pos] >> bitPos) & 1;
    bitPos++;
    if (bitPos === 8) { bitPos = 0; pos++; }
    
    // Traverse (try reversed: 0=right, 1=left)
    current = bit === 0 ? current.right! : current.left!;
    
    if (!current) {
      current = root;
      continue;
    }
    
    // Check if leaf
    if (current.symbol !== null) {
      output.push(current.symbol);
      current = root;
    }
  }
  
  return output;
}

function parseDict(stream: Buffer) {
  const count = stream.readUInt32LE(0);
  const entries: Array<{ symbol: number; freq: number }> = [];
  let prevCum = 0;
  
  for (let i = 0; i < count; i++) {
    const symbol = stream.readUInt32LE(4 + i * 8);
    const cumFreq = stream.readUInt32LE(4 + i * 8 + 4);
    entries.push({ symbol, freq: cumFreq - prevCum });
    prevCum = cumFreq;
  }
  
  const maxSym = stream.readUInt32LE(4 + count * 8);
  return { entries, maxSym, dataStart: 4 + count * 8 + 4 };
}

function parseV2(buf: Buffer) {
  let pos = 14;
  const paletteSize = buf[pos++];
  const palette: number[] = [];
  for (let i = 0; i < paletteSize; i++) palette.push(buf[pos++]);
  
  const s1Size = (buf.readUInt16BE(pos) << 16) | buf.readUInt16BE(pos + 2); pos += 4;
  const stream1 = buf.subarray(pos, pos + s1Size); pos += s1Size;
  
  const s2Size = (buf.readUInt16BE(pos) << 16) | buf.readUInt16BE(pos + 2); pos += 4;
  const stream2 = buf.subarray(pos, pos + s2Size);
  
  return { width: buf.readUInt16BE(6), height: buf.readUInt16BE(8), palette, stream1, stream2 };
}

async function main() {
  const inputPath = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
  const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_huff2.png`;
  
  console.log('=== ITW V2 Proper Huffman ===');
  
  const buf = fs.readFileSync(inputPath);
  const data = parseV2(buf);
  
  console.log(`Image: ${data.width}×${data.height}, palette: ${data.palette.length}`);
  
  const dict1 = parseDict(data.stream1);
  const dict2 = parseDict(data.stream2);
  
  console.log(`Dict1: ${dict1.entries.length} entries, max=${dict1.maxSym}`);
  console.log(`Dict2: ${dict2.entries.length} entries, max=${dict2.maxSym}`);
  
  // Build trees
  const tree1 = buildHuffmanTree(dict1.entries);
  const tree2 = buildHuffmanTree(dict2.entries);
  
  // Print tree depth
  function treeDepth(n: Node | null): number {
    if (!n) return 0;
    return 1 + Math.max(treeDepth(n.left), treeDepth(n.right));
  }
  console.log(`Tree1 depth: ${treeDepth(tree1)}, Tree2 depth: ${treeDepth(tree2)}`);
  
  // Decode
  console.log('\nDecoding...');
  const dec1 = decodeHuffman(data.stream1, dict1.dataStart, tree1, dict1.maxSym);
  const dec2 = decodeHuffman(data.stream2, dict2.dataStart, tree2, dict2.maxSym);
  
  console.log(`Decoded1: ${dec1.length}/${dict1.maxSym}`);
  console.log(`Decoded2: ${dec2.length}/${dict2.maxSym}`);
  
  // Symbol distribution
  const dist: Record<number, number> = {};
  for (const s of dec1.slice(0, 1000)) dist[s] = (dist[s] || 0) + 1;
  console.log('First 1000 symbols dist:', Object.entries(dist).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([k,v]) => `${k}:${v}`).join(' '));
  
  // Combine
  const totalPixels = data.width * data.height;
  const threshold = data.palette.length + 8;
  const output = Buffer.alloc(totalPixels);
  let out = 0, d1 = 0, d2 = 0;
  
  while (out < totalPixels && d1 < dec1.length) {
    const v1 = dec1[d1++];
    if (v1 < threshold && d2 < dec2.length) {
      if (out < totalPixels) output[out++] = dec2[d2++];
      if (out < totalPixels) output[out++] = v1;
    } else {
      if (out < totalPixels) output[out++] = v1;
    }
  }
  
  console.log(`Output: ${out}/${totalPixels}`);
  
  for (let i = 0; i < output.length; i++) {
    if (output[i] < data.palette.length) output[i] = data.palette[output[i]];
  }
  
  await sharp(output, { raw: { width: data.width, height: data.height, channels: 1 } })
    .png().toFile(outputPath);
  
  console.log('Saved:', outputPath);
}

main().catch(e => console.error('Error:', e.message));
