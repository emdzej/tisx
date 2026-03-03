/**
 * ITW V2 - With float frequencies
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
  let nodes: Node[] = entries.map(e => ({
    symbol: e.symbol,
    freq: e.freq,
    left: null,
    right: null
  }));
  
  nodes.sort((a, b) => a.freq - b.freq);
  
  while (nodes.length > 1) {
    const left = nodes.shift()!;
    const right = nodes.shift()!;
    
    const parent: Node = {
      symbol: null,
      freq: left.freq + right.freq,
      left,
      right
    };
    
    let i = 0;
    while (i < nodes.length && nodes[i].freq < parent.freq) i++;
    nodes.splice(i, 0, parent);
  }
  
  return nodes[0] || { symbol: 0, freq: 0, left: null, right: null };
}

function decodeHuffman(stream: Buffer, start: number, root: Node, maxSym: number): number[] {
  const output: number[] = [];
  let pos = start;
  let bitPos = 0;
  let current = root;
  
  while (output.length < maxSym && pos < stream.length) {
    const bit = (stream[pos] >> bitPos) & 1;
    bitPos++;
    if (bitPos === 8) { bitPos = 0; pos++; }
    
    // Standard: 0=left, 1=right
    current = bit === 0 ? current.left! : current.right!;
    
    if (!current) { current = root; continue; }
    
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
  
  const fb = Buffer.alloc(4);
  let prevCum = 0;
  
  for (let i = 0; i < count; i++) {
    const symbol = stream.readUInt32LE(4 + i * 8);
    fb[0] = stream[4 + i * 8 + 4];
    fb[1] = stream[4 + i * 8 + 5];
    fb[2] = stream[4 + i * 8 + 6];
    fb[3] = stream[4 + i * 8 + 7];
    const cumFloat = fb.readFloatLE(0);
    const freq = cumFloat - prevCum;
    entries.push({ symbol, freq: freq > 0 ? freq : 0.0001 });
    prevCum = cumFloat;
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
  const inputPath = process.argv[2] || process.env.HOME + '/Documents/tis/GRAFIK/10/28/74.ITW';
  const outputPath = process.argv[3] || process.env.HOME + '/.openclaw/workspace/itw_v2_float.png';
  
  console.log('=== ITW V2 Float Freq Decoder ===');
  
  const buf = fs.readFileSync(inputPath);
  const data = parseV2(buf);
  
  console.log(`Image: ${data.width}×${data.height}`);
  
  const dict1 = parseDict(data.stream1);
  const dict2 = parseDict(data.stream2);
  
  console.log(`\nDict1: ${dict1.entries.length} entries`);
  dict1.entries.forEach((e, i) => console.log(`  [${i}] sym=${e.symbol.toString().padStart(2)} freq=${e.freq.toExponential(3)}`));
  
  const tree1 = buildHuffmanTree(dict1.entries);
  const tree2 = buildHuffmanTree(dict2.entries);
  
  // Show tree structure for debugging
  function showTree(n: Node | null, prefix = ''): void {
    if (!n) return;
    if (n.symbol !== null) {
      console.log(prefix + 'LEAF sym=' + n.symbol);
    } else {
      console.log(prefix + 'NODE');
      showTree(n.left, prefix + '  0:');
      showTree(n.right, prefix + '  1:');
    }
  }
  console.log('\\nTree1:');
  showTree(tree1);
  
  const dec1 = decodeHuffman(data.stream1, dict1.dataStart, tree1, dict1.maxSym);
  const dec2 = decodeHuffman(data.stream2, dict2.dataStart, tree2, dict2.maxSym);
  
  console.log(`\\nDecoded1: ${dec1.length}/${dict1.maxSym}`);
  console.log(`Decoded2: ${dec2.length}/${dict2.maxSym}`);
  console.log('First 30:', dec1.slice(0, 30).join(', '));
  
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
