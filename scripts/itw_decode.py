#!/usr/bin/env python3
"""
ITW V1 (0x0300) Decoder - Reference Implementation

Based on Ghidra reverse engineering of BMW TIS wavelet decoder.
Currently decodes LL4 + L3 details with bilinear upscaling.

Stream structure (for 316×238, 4 levels):
- S0/S1, S2/S3: L1 details (position pairs + Fischer values)
- S4: L3 LH detail (40×30, zigzag encoded)
- S6, S8: L3 HL, HH details (zigzag)
- S16: LL4 direct (20×15, raw bytes)
- S17, S18: L4 details

Limitations:
- Fischer probability decoder not implemented
- Only LL4 + L3 details used (L1/L2 require Fischer)
- Output is blurry compared to original
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
    
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 0, 0, 0, 0)
    
    raw = b''
    for y in range(height):
        raw += b'\x00'
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
            src_x = x * (src_w - 1) / max(1, dst_w - 1)
            src_y = y * (src_h - 1) / max(1, dst_h - 1)
            
            x0 = int(src_x)
            y0 = int(src_y)
            x1 = min(x0 + 1, src_w - 1)
            y1 = min(y0 + 1, src_h - 1)
            
            fx = src_x - x0
            fy = src_y - y0
            
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
    
    # Extract zlib streams (skip header bytes)
    streams = extract_zlib_streams(payload[3:])
    print(f"Found {len(streams)} streams")
    
    # Calculate dimension hierarchy
    dims = [(width, height)]
    for _ in range(levels):
        w, h = dims[-1]
        dims.append(((w + 1) // 2, (h + 1) // 2))
    
    # Get LL4 (deepest LL)
    l4_w, l4_h = dims[levels]
    ll4_idx = 16  # Standard position for 4-level decomposition
    
    if ll4_idx >= len(streams):
        raise ValueError(f"LL4 stream not found at index {ll4_idx}")
    
    ll4_stream = list(streams[ll4_idx])
    if len(ll4_stream) != l4_w * l4_h:
        print(f"Warning: LL4 size mismatch: {len(ll4_stream)} vs {l4_w * l4_h}")
    
    ll4_2d = [[float(ll4_stream[y * l4_w + x]) for x in range(l4_w)] for y in range(l4_h)]
    print(f"LL4: {l4_w}×{l4_h}, range {min(ll4_stream)}-{max(ll4_stream)}")
    
    # Get L3 LH detail (S4) if available
    l3_w, l3_h = dims[levels - 1]
    if len(streams) > 4 and len(streams[4]) == l3_w * l3_h:
        l3_lh_raw = [zigzag_decode(b) for b in streams[4]]
        l3_lh = [[l3_lh_raw[y * l3_w + x] for x in range(l3_w)] for y in range(l3_h)]
        
        # Upscale LL4 to L3 size
        ll_at_l3 = bilinear_upscale(ll4_2d, l3_w, l3_h)
        
        # Add L3 LH detail (quantization factor 2)
        quant = 2
        for y in range(l3_h):
            for x in range(l3_w):
                ll_at_l3[y][x] += l3_lh[y][x] * quant
        
        # Upscale to full resolution
        upscaled = bilinear_upscale(ll_at_l3, width, height)
        print(f"Used L3 LH detail")
    else:
        # Fallback: LL4 only
        upscaled = bilinear_upscale(ll4_2d, width, height)
        print(f"LL4 only (no L3 detail)")
    
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
        print("\nDecodes BMW TIS ITW V1 (0x0300) wavelet-compressed images.")
        print("Output is blurry without Fischer decoder (L1/L2 details).")
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
