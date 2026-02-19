#!/usr/bin/env python3
"""
ITW V1 (0x0300) Decoder - Reference Implementation

Based on Ghidra reverse engineering of BMW TIS wavelet decoder.
Currently decodes LL4 (deepest low-pass subband) with bilinear upscaling.

Stream structure:
- Paired streams: even=positions (RLE), odd=values (Fischer probability)  
- Direct streams: S16=LL4 (20x15), S4=L3 detail (40x30, zigzag)
- Quantization: {8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1}
- Filter type 0=CDF 9/7, type 1=custom 5/3

TODO:
- Full wavelet reconstruction with all detail subbands
- Fischer probability decoder implementation
- Proper dequantization
"""

import zlib
import struct
import sys
from pathlib import Path


def zigzag_decode(n: int) -> int:
    """Decode zigzag-encoded signed integer."""
    return (n >> 1) ^ -(n & 1)


def extract_zlib_streams(payload: bytes) -> list[bytes]:
    """Extract all zlib-compressed streams from payload."""
    streams = []
    i = 0
    
    while i < len(payload) - 2:
        # Look for zlib header signatures
        if payload[i] == 0x78 and payload[i + 1] in [0x9c, 0xda, 0x01, 0x5e]:
            try:
                obj = zlib.decompressobj()
                dec = obj.decompress(payload[i:])
                unused_len = len(obj.unused_data)
                comp_size = len(payload) - i - unused_len
                streams.append(dec)
                i += comp_size
                continue
            except zlib.error:
                pass
        i += 1
    
    return streams


def create_png(pixels: list[int], width: int, height: int) -> bytes:
    """Create a grayscale PNG from pixel data."""
    def crc32(data: bytes) -> int:
        return zlib.crc32(data) & 0xffffffff
    
    def chunk(name: bytes, data: bytes) -> bytes:
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc32(name + data))
    
    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR: width, height, bit depth, color type, compression, filter, interlace
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 0, 0, 0, 0)
    
    # IDAT: filtered scanlines
    raw = b''
    for y in range(height):
        raw += b'\x00'  # Filter type 0 (none)
        for x in range(width):
            raw += bytes([pixels[y * width + x]])
    
    compressed = zlib.compress(raw, 9)
    
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')


def bilinear_upscale(src: list[list[float]], dst_w: int, dst_h: int) -> list[list[float]]:
    """Bilinear upscale a 2D array to target dimensions."""
    src_h = len(src)
    src_w = len(src[0]) if src_h > 0 else 0
    
    if src_h == 0 or src_w == 0:
        return [[0.0] * dst_w for _ in range(dst_h)]
    
    result = [[0.0] * dst_w for _ in range(dst_h)]
    
    for y in range(dst_h):
        for x in range(dst_w):
            # Map to source coordinates
            src_x = x * (src_w - 1) / max(1, dst_w - 1)
            src_y = y * (src_h - 1) / max(1, dst_h - 1)
            
            x0 = int(src_x)
            y0 = int(src_y)
            x1 = min(x0 + 1, src_w - 1)
            y1 = min(y0 + 1, src_h - 1)
            
            fx = src_x - x0
            fy = src_y - y0
            
            # Bilinear interpolation
            v = (src[y0][x0] * (1 - fx) * (1 - fy) +
                 src[y0][x1] * fx * (1 - fy) +
                 src[y1][x0] * (1 - fx) * fy +
                 src[y1][x1] * fx * fy)
            
            result[y][x] = v
    
    return result


def decode_itw_v1(data: bytes) -> tuple[int, int, list[int]]:
    """
    Decode ITW V1 (0x0300) format file.
    
    Returns: (width, height, pixels)
    """
    # Validate header
    magic = data[0:4]
    if magic != b'ITW_':
        raise ValueError(f"Invalid magic: {magic}")
    
    width = int.from_bytes(data[6:8], 'big')
    height = int.from_bytes(data[8:10], 'big')
    version = int.from_bytes(data[12:14], 'big')
    comp_size = int.from_bytes(data[14:18], 'big')
    
    if version != 0x0300:
        raise ValueError(f"Unsupported version: 0x{version:04x}")
    
    # Parse payload
    payload = data[18:18 + comp_size]
    filter_type = payload[0]
    levels = payload[1]
    
    print(f"ITW V1: {width}×{height}, filter={filter_type}, levels={levels}")
    
    # Extract zlib streams (skip 3-byte header)
    streams = extract_zlib_streams(payload[3:])
    print(f"Found {len(streams)} streams")
    
    # Calculate dimension hierarchy
    dims = [(width, height)]
    for _ in range(levels):
        w, h = dims[-1]
        dims.append(((w + 1) // 2, (h + 1) // 2))
    
    # Find LL4 stream (S16 for standard 4-level decomposition)
    ll4_w, ll4_h = dims[levels]
    ll4_size = ll4_w * ll4_h
    
    ll4_stream = None
    for idx, s in enumerate(streams):
        if len(s) == ll4_size:
            # Check if it looks like direct values (not sparse/RLE)
            raw = list(s)
            zero_pct = raw.count(0) / len(raw)
            mean = sum(raw) / len(raw)
            
            # LL should have low zero count and moderate mean
            if zero_pct < 0.1 and 20 < mean < 150:
                ll4_stream = s
                print(f"LL4 found at S{idx}: {len(s)} bytes, range {min(raw)}-{max(raw)}")
                break
    
    if ll4_stream is None:
        raise ValueError(f"Could not find LL4 stream (expected {ll4_size} bytes)")
    
    # Convert to 2D array
    ll4_data = list(ll4_stream)
    ll4_2d = [[float(ll4_data[y * ll4_w + x]) for x in range(ll4_w)] for y in range(ll4_h)]
    
    # Bilinear upscale to full resolution
    upscaled = bilinear_upscale(ll4_2d, width, height)
    
    # Normalize to 0-255
    flat = [upscaled[y][x] for y in range(height) for x in range(width)]
    min_v, max_v = min(flat), max(flat)
    
    pixels = []
    for y in range(height):
        for x in range(width):
            v = upscaled[y][x]
            normalized = int((v - min_v) / max(1, max_v - min_v) * 255)
            pixels.append(max(0, min(255, normalized)))
    
    return width, height, pixels


def main():
    if len(sys.argv) < 2:
        print("Usage: itw_decode.py <input.itw> [output.png]")
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else input_path.with_suffix('.png')
    
    # Read and decode
    data = input_path.read_bytes()
    width, height, pixels = decode_itw_v1(data)
    
    # Write PNG
    png_data = create_png(pixels, width, height)
    output_path.write_bytes(png_data)
    print(f"Wrote {output_path} ({width}×{height})")


if __name__ == '__main__':
    main()
