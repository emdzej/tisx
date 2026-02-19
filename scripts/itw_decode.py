#!/usr/bin/env python3
"""
ITW V1 (0x0300) Decoder

Decodes BMW TIS wavelet-compressed images.
Currently supports LL4-only bilinear reconstruction.

Usage:
    python itw_decode.py input.itw [output.png]
"""

import sys
import zlib
import struct

def extract_streams(payload):
    """Extract zlib streams from payload"""
    streams = []
    i = 77  # Skip metadata block
    while i < len(payload) - 2:
        if payload[i] == 0x78 and payload[i+1] in [0x9c, 0xda, 0x01, 0x5e]:
            try:
                obj = zlib.decompressobj()
                dec = obj.decompress(payload[i:])
                streams.append(dec)
                i += len(payload) - i - len(obj.unused_data)
            except:
                i += 1
        else:
            i += 1
    return streams

def bilinear_scale(img, dw, dh):
    """Bilinear interpolation to target size"""
    sh, sw = len(img), len(img[0])
    result = [[0.0] * dw for _ in range(dh)]
    for y in range(dh):
        for x in range(dw):
            sx = x * (sw - 1) / (dw - 1) if dw > 1 else 0
            sy = y * (sh - 1) / (dh - 1) if dh > 1 else 0
            x0, y0 = int(sx), int(sy)
            x1, y1 = min(x0 + 1, sw - 1), min(y0 + 1, sh - 1)
            fx, fy = sx - x0, sy - y0
            result[y][x] = (img[y0][x0] * (1-fx) * (1-fy) +
                           img[y0][x1] * fx * (1-fy) +
                           img[y1][x0] * (1-fx) * fy +
                           img[y1][x1] * fx * fy)
    return result

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
    
    # Extract streams
    payload = data[18:]
    streams = extract_streams(payload)
    
    if len(streams) < 17:
        raise ValueError(f"Expected 17+ streams, got {len(streams)}")
    
    # S16 = LL4 (deepest wavelet coefficients)
    ll4 = list(streams[16])
    ll4_w = (width + 15) // 16
    ll4_h = (height + 15) // 16
    
    # Convert to 2D
    ll4_2d = [[float(ll4[y * ll4_w + x]) if y * ll4_w + x < len(ll4) else 0 
               for x in range(ll4_w)] for y in range(ll4_h)]
    
    # Bilinear upscale to full resolution
    final = bilinear_scale(ll4_2d, width, height)
    
    # Output
    if output_path is None:
        output_path = input_path.rsplit('.', 1)[0] + '.png'
    
    create_png(final, output_path)
    print(f"Decoded {width}x{height} -> {output_path}")
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    decode_itw(input_path, output_path)
