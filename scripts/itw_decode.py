#!/usr/bin/env python3
"""
ITW V1 (0x0300) Decoder

Based on tis.exe disassembly analysis.
Currently supports:
- LL4 extraction and CDF 5/3 wavelet reconstruction
- Produces clean but blurry output (detail coefficients pending)

Usage:
    python itw_decode.py input.itw [output.png]
"""

import sys
import zlib
import struct

def cdf53_inv_1d(low, high):
    """CDF 5/3 inverse transform 1D"""
    n_low = len(low)
    n_high = len(high) if high else n_low
    n = n_low + n_high
    
    s = [float(x) for x in low]
    d = [float(x) for x in high] if high else [0.0] * n_low
    
    # Undo update: s[n] -= (d[n-1] + d[n]) / 4
    for i in range(n_low):
        left = d[i-1] if i > 0 else d[0] if d else 0
        right = d[i] if i < n_high else d[n_high-1] if n_high > 0 else 0
        s[i] -= (left + right) / 4
    
    # Undo predict: d[n] += (s[n] + s[n+1]) / 2
    for i in range(n_high):
        left = s[i] if i < n_low else 0
        right = s[i+1] if i+1 < n_low else left
        d[i] += (left + right) / 2
    
    # Interleave
    out = [0.0] * n
    for i in range(n_low):
        out[2*i] = s[i]
    for i in range(n_high):
        out[2*i + 1] = d[i]
    return out

def idwt2d(ll, lh, hl, target_w, target_h):
    """2D inverse DWT using CDF 5/3"""
    ll_h, ll_w = len(ll), len(ll[0])
    
    # Inverse rows (add HL = vertical details)
    temp = []
    for y in range(ll_h):
        low_row = ll[y]
        high_row = [hl[y][x] if hl and y < len(hl) and x < len(hl[y]) else 0 for x in range(ll_w)]
        row = cdf53_inv_1d(low_row, high_row)
        temp.append(row[:target_w])
    
    while len(temp) < (target_h + 1) // 2:
        temp.append(temp[-1] if temp else [0] * target_w)
    
    # Inverse columns (add LH = horizontal details)
    result = [[0.0] * target_w for _ in range(target_h)]
    for x in range(target_w):
        n_low = len(temp)
        low_col = [temp[y][x] if x < len(temp[y]) else 0 for y in range(n_low)]
        high_col = [lh[y][x] if lh and y < len(lh) and x < len(lh[y]) else 0 for y in range(n_low)]
        col = cdf53_inv_1d(low_col, high_col)
        for y in range(target_h):
            result[y][x] = col[y] if y < len(col) else 0
    
    return result

def extract_streams(payload, start=77):
    """Extract zlib streams from payload"""
    streams = []
    i = start
    while i < len(payload) - 2:
        if payload[i] == 0x78 and i+1 < len(payload) and payload[i+1] in [0x9c, 0xda, 0x01, 0x5e]:
            try:
                obj = zlib.decompressobj()
                dec = obj.decompress(payload[i:])
                streams.append(bytes(dec))
                i += len(payload) - i - len(obj.unused_data)
            except:
                i += 1
        else:
            i += 1
    return streams

def create_png(img, filename):
    """Create grayscale PNG from 2D float array"""
    h, w = len(img), len(img[0])
    flat = [v for row in img for v in row]
    min_v, max_v = min(flat), max(flat)
    scale = max(1, max_v - min_v)
    
    sig = b'\x89PNG\r\n\x1a\n'
    def crc32(d): return zlib.crc32(d) & 0xffffffff
    def chunk(n, d): return struct.pack('>I', len(d)) + n + d + struct.pack('>I', crc32(n + d))
    
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0)
    raw = b''.join(
        b'\x00' + bytes(max(0, min(255, int((img[y][x] - min_v) / scale * 255))) for x in range(w)) 
        for y in range(h)
    )
    
    with open(filename, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def decode_itw(input_path, output_path=None):
    """Decode ITW file to PNG"""
    with open(input_path, 'rb') as f:
        data = f.read()
    
    # Parse header
    magic = data[0:4]
    if magic != b'ITW_':
        raise ValueError(f"Invalid magic: {magic}")
    
    width = struct.unpack('>H', data[6:8])[0]
    height = struct.unpack('>H', data[8:10])[0]
    version = struct.unpack('>H', data[12:14])[0]
    
    if version != 0x0300:
        raise ValueError(f"Unsupported version: 0x{version:04x}")
    
    # Parse metadata
    payload = data[18:]
    flag = payload[0]
    levels = payload[1]
    filter_type = payload[2]
    
    # Extract streams
    streams = extract_streams(payload, 77)
    
    if len(streams) < 17:
        raise ValueError(f"Expected 17+ streams, got {len(streams)}")
    
    # Calculate dimensions at each level
    dims = [(width, height)]
    w, h = width, height
    for _ in range(levels):
        w = (w + 1) // 2
        h = (h + 1) // 2
        dims.append((w, h))
    
    # S16 = LL at deepest level
    ll_w, ll_h = dims[levels]
    ll = [[float(streams[16][y * ll_w + x]) if y * ll_w + x < len(streams[16]) else 0 
           for x in range(ll_w)] for y in range(ll_h)]
    
    # Reconstruct through all levels with zero details
    current = ll
    for level in range(levels, 0, -1):
        target_w, target_h = dims[level - 1]
        curr_w, curr_h = len(current[0]), len(current)
        
        # Zero details for now (Fischer decode TODO)
        lh = [[0.0] * curr_w for _ in range(curr_h)]
        hl = [[0.0] * curr_w for _ in range(curr_h)]
        
        current = idwt2d(current, lh, hl, target_w, target_h)
    
    # Output
    if output_path is None:
        output_path = input_path.rsplit('.', 1)[0] + '.png'
    
    create_png(current, output_path)
    print(f"Decoded {width}x{height} (levels={levels}, filter={filter_type}) -> {output_path}")
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    decode_itw(input_path, output_path)
