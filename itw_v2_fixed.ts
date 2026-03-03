/**
 * ITW V2 Decoder - FIXED based on tis.exe decompilation
 * 
 * Correct format:
 * - Header: 14 bytes (ITW_ + version + dimensions)
 * - Palette size: 1 byte at offset 14
 * - Palette: paletteSize bytes
 * - Stream1 size: 4 bytes (2x BE u16 concatenated)
 * - Stream1 data: contains LZW/Huffman dict + compressed
 * - Stream2 size: 4 bytes
 * - Stream2 data: same format
 */

import * as fs from 'fs';
import sharp from 'sharp';

// ============= Parse streams from file =============

interface V2Data {
  width: number;
  height: number;
  palette: number[];
  stream1: Buffer;
  stream2: Buffer;
}

function parseV2File(buffer: Buffer): V2Data {
  // Header
  if (buffer.toString('ascii', 0, 4) !== 'ITW_') throw new Error('Not ITW');
  if (buffer[4] !== 2) throw new Error('Not V2');
  
  const width = buffer.readUInt16BE(6);
  const height = buffer.readUInt16BE(8);
  
  let pos = 14;
  
  // Palette
  const paletteSize = buffer[pos++];
  const palette: number[] = [];
  for (let i = 0; i < paletteSize; i++) {
    palette.push(buffer[pos++]);
  }
  
  // Stream1 size (2x BE u16 -> u32)
  const s1Hi = buffer.readUInt16BE(pos); pos += 2;
  const s1Lo = buffer.readUInt16BE(pos); pos += 2;
  const stream1Size = (s1Hi << 16) | s1Lo;
  const stream1 = buffer.subarray(pos, pos + stream1Size);
  pos += stream1Size;
  
  // Stream2 size
  const s2Hi = buffer.readUInt16BE(pos); pos += 2;
  const s2Lo = buffer.readUInt16BE(pos); pos += 2;
  const stream2Size = (s2Hi << 16) | s2Lo;
  const stream2 = buffer.subarray(pos, pos + stream2Size);
  
  return { width, height, palette, stream1, stream2 };
}

// ============= Parse Huffman dictionary =============

interface HuffEntry {
  symbol: number;
  frequency: number;
}

interface HuffDict {
  entries: HuffEntry[];
  maxSymbols: number;
  dataStart: number;
}

function parseDict(stream: Buffer): HuffDict {
  let pos = 0;
  
  // Entry count (LE u32)
  const entryCount = stream.readUInt32LE(pos); pos += 4;
  
  const entries: HuffEntry[] = [];
  for (let i = 0; i < entryCount && pos + 8 <= stream.length; i++) {
    // First 4 bytes: low 3 bytes unused, high byte = symbol? Let's check...
    // Actually from decompiled: *(char*)(*puVar2 + 2) = (char)uVar3
    // uVar3 is first byte read. So symbol at byte 0, not byte 3!
    
    // Looking at stream data: 0d 00 00 00 90 d1 a4 38
    // If symbol is byte 0: symbol=0x0d=13, freq=0x38a4d190
    // If symbol is byte 3: symbol=0x00=0, which doesn't help
    
    // Actually the entry format might be: [freq:4 LE][symbol:1][unused:3]
    // Or it could be [symbol:1][unused:3][freq:4]
    
    // Let me read more carefully from decompiled FUN_004b6340:
    // uVar3 = FUN_004b68f0(param_2, uVar8);     // byte 0
    // FUN_004b68f0(param_2, uVar8 + 1);         // byte 1 (unused)
    // FUN_004b68f0(param_2, uVar8 + 2);         // byte 2 (unused)
    // FUN_004b68f0(param_2, uVar8 + 3);         // byte 3 (unused)
    // *(char *)(*puVar2 + 2) = (char)uVar3;     // store symbol from byte 0
    // puVar7 = (uint *)(*puVar2 + 0x14);        // frequency pointer
    // uVar3 = FUN_004b68f0(param_2, uVar8 + 4); // byte 4
    // *puVar7 = uVar3 & 0xff;                   // freq byte 0
    // uVar3 = FUN_004b68f0(param_2, uVar8 + 5); // byte 5
    // *puVar7 = *puVar7 + (uVar3 & 0xff) * 0x100;  // freq byte 1
    // etc... for LE u32
    
    // So: bytes 0-3: [symbol:1][unused:3], bytes 4-7: [freq:4 LE]
    const symbol = stream[pos];
    const frequency = stream.readUInt32LE(pos + 4);
    entries.push({ symbol, frequency });
    pos += 8;
  }
  
  // Max symbols (LE u32)
  const maxSymbols = stream.readUInt32LE(pos); pos += 4;
  
  return { entries, maxSymbols, dataStart: pos };
}

// ============= Build Huffman tree =============

interface HuffNode {
  isLeaf: boolean;
  symbol: number;
  left: number;
  right: number;
}

function buildTree(entries: HuffEntry[]): { nodes: HuffNode[]; root: number } {
  if (entries.length === 0) {
    return { nodes: [{ isLeaf: true, symbol: 0, left: -1, right: -1 }], root: 0 };
  }
  
  const nodes: HuffNode[] = [];
  let queue: Array<{ idx: number; freq: number }> = [];
  
  // Create leaf nodes
  for (const { symbol, frequency } of entries) {
    const idx = nodes.length;
    nodes.push({ isLeaf: true, symbol, left: -1, right: -1 });
    queue.push({ idx, freq: frequency });
  }
  
  // Sort ascending
  queue.sort((a, b) => a.freq - b.freq);
  
  // Build tree
  while (queue.length > 1) {
    const left = queue.shift()!;
    const right = queue.shift()!;
    
    const parentIdx = nodes.length;
    nodes.push({ isLeaf: false, symbol: 0, left: left.idx, right: right.idx });
    
    const parentFreq = left.freq + right.freq;
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].freq > parentFreq) {
        queue.splice(i, 0, { idx: parentIdx, freq: parentFreq });
        inserted = true;
        break;
      }
    }
    if (!inserted) queue.push({ idx: parentIdx, freq: parentFreq });
  }
  
  return { nodes, root: queue[0]?.idx ?? 0 };
}

// ============= Huffman decode =============

function huffDecode(stream: Buffer, start: number, nodes: HuffNode[], root: number, maxSym: number): number[] {
  const out: number[] = [];
  let pos = start;
  let bit = 0;
  let cur = root;
  
  while (out.length < maxSym && pos < stream.length) {
    const byte = stream[pos];
    const direction = (byte >> bit) & 1;
    bit++;
    if (bit === 8) { bit = 0; pos++; }
    
    const node = nodes[cur];
    if (!node) break;
    
    const nextIdx = direction === 0 ? node.left : node.right;
    if (nextIdx < 0 || nextIdx >= nodes.length) {
      cur = root;
      continue;
    }
    
    const next = nodes[nextIdx];
    if (next.isLeaf) {
      out.push(next.symbol);
      cur = root;
    } else {
      cur = nextIdx;
    }
  }
  
  return out;
}

// ============= Main decoder (FUN_004b57f0) =============

async function decodeV2(inputPath: string, outputPath: string): Promise<void> {
  console.log('=== ITW V2 Decoder (Fixed) ===');
  console.log('Input:', inputPath);
  
  const buffer = fs.readFileSync(inputPath);
  const data = parseV2File(buffer);
  
  console.log(`\nImage: ${data.width}×${data.height}`);
  console.log(`Palette (${data.palette.length}):`, data.palette);
  console.log(`Stream1: ${data.stream1.length} bytes`);
  console.log(`Stream2: ${data.stream2.length} bytes`);
  
  // Parse dicts
  console.log('\nParsing dictionaries:');
  const dict1 = parseDict(data.stream1);
  const dict2 = parseDict(data.stream2);
  
  console.log(`  Dict1: ${dict1.entries.length} entries, maxSym=${dict1.maxSymbols}`);
  console.log(`  Dict2: ${dict2.entries.length} entries, maxSym=${dict2.maxSymbols}`);
  
  console.log('\nDict1 entries:');
  dict1.entries.forEach((e, i) => console.log(`  [${i}] sym=${e.symbol} freq=${e.frequency}`));
  
  // Build trees
  console.log('\nBuilding Huffman trees...');
  const tree1 = buildTree(dict1.entries);
  const tree2 = buildTree(dict2.entries);
  console.log(`  Tree1: ${tree1.nodes.length} nodes, root=${tree1.root}`);
  console.log(`  Tree2: ${tree2.nodes.length} nodes, root=${tree2.root}`);
  
  // Decode
  console.log('\nDecoding...');
  const dec1 = huffDecode(data.stream1, dict1.dataStart, tree1.nodes, tree1.root, dict1.maxSymbols);
  const dec2 = huffDecode(data.stream2, dict2.dataStart, tree2.nodes, tree2.root, dict2.maxSymbols);
  console.log(`  Decoded1: ${dec1.length}/${dict1.maxSymbols}`);
  console.log(`  Decoded2: ${dec2.length}/${dict2.maxSymbols}`);
  
  // Combine (from FUN_004b57f0)
  // threshold = paletteSize + 8
  // if val1 < threshold: output dec2 then val1
  // else: output val1 only
  
  const totalPixels = data.width * data.height;
  const threshold = data.palette.length + 8;
  console.log(`\nCombining (threshold=${threshold}, target=${totalPixels})...`);
  
  const output = Buffer.alloc(totalPixels);
  let outIdx = 0;
  let d1 = 0, d2 = 0;
  
  while (outIdx < totalPixels && d1 < dec1.length) {
    const val1 = dec1[d1++];
    
    if (val1 < threshold && d2 < dec2.length) {
      if (outIdx < totalPixels) output[outIdx++] = dec2[d2++];
      if (outIdx < totalPixels) output[outIdx++] = val1;
    } else {
      if (outIdx < totalPixels) output[outIdx++] = val1;
    }
  }
  
  console.log(`  Output: ${outIdx}/${totalPixels} pixels`);
  
  // Apply palette
  if (data.palette.length > 0) {
    for (let i = 0; i < output.length; i++) {
      const v = output[i];
      if (v < data.palette.length) {
        output[i] = data.palette[v];
      }
    }
  }
  
  // Save
  await sharp(output, { raw: { width: data.width, height: data.height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`\nSaved: ${outputPath}`);
}

// CLI
const input = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
const output = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_fixed.png`;

decodeV2(input, output).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
