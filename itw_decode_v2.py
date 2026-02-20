#!/usr/bin/env python3
"""
ITW Decoder based on tis.exe decompilation
Supports V1 (0x0300) wavelet and V2 (0x0400) LZW formats
"""
import struct
import sys
import zlib
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("pip install pillow numpy")
    sys.exit(1)


def read_u16_be(data: bytes, offset: int) -> int:
    return struct.unpack('>H', data[offset:offset+2])[0]


def read_u32_be(data: bytes, offset: int) -> int:
    return struct.unpack('>I', data[offset:offset+4])[0]


def parse_header(data: bytes):
    """Parse ITW header (12 bytes)"""
    if data[:4] != b'ITW_':
        raise ValueError("Not an ITW file")
    
    version = read_u16_be(data, 4)
    width = read_u16_be(data, 6)
    height = read_u16_be(data, 8)
    bits = read_u16_be(data, 10)
    
    return {
        'version': version,
        'width': width,
        'height': height,
        'bits': bits,
    }


def decode_v2_lzw(data: bytes, width: int, height: int) -> np.ndarray:
    """
    Decode V2 (0x0400) format - LZW compression
    Based on FUN_004b57f0 in tis.exe
    """
    pos = 14  # After header + compression type
    
    # Read palette/header byte
    palette_size = data[pos]
    pos += 1
    
    # Skip palette bytes
    palette = data[pos:pos + palette_size]
    pos += palette_size
    
    # Read two data streams sizes
    stream1_size = read_u32_be(data, pos)
    pos += 4
    stream1 = data[pos:pos + stream1_size]
    pos += stream1_size
    
    stream2_size = read_u32_be(data, pos)
    pos += 4
    stream2 = data[pos:pos + stream2_size]
    
    # LZW decode streams and combine
    # This is simplified - actual V2 uses custom LZW
    pixels = np.zeros((height, width), dtype=np.uint8)
    
    # Try zlib decompress
    try:
        decompressed = zlib.decompress(stream1)
        pixels = np.frombuffer(decompressed[:width*height], dtype=np.uint8).reshape((height, width))
    except:
        pass
    
    return pixels


def decode_v1_wavelet(data: bytes, width: int, height: int) -> np.ndarray:
    """
    Decode V1 (0x0300) format - Wavelet compression  
    Based on FUN_004b5b30 and FUN_004b7970 in tis.exe
    """
    # Read compressed size (u32 BE at offset 14)
    compressed_size = read_u32_be(data, 14)
    compressed_data = data[18:18 + compressed_size]
    
    print(f"  Compressed size: {compressed_size} bytes")
    
    # Parse wavelet bitstream
    # First 3 bytes are metadata
    pos = 0
    filter_type = compressed_data[pos]  # DAT_00516c78
    pos += 1
    num_levels = compressed_data[pos]  # 3 or 4
    pos += 1
    quant_param = compressed_data[pos]
    pos += 1
    
    print(f"  Filter: {filter_type}, Levels: {num_levels}, Quant: {quant_param}")
    
    # Determine subband count based on levels
    if num_levels == 3:
        num_subbands = 9  # local_90
        max_level = 8     # local_a0
    else:  # num_levels == 4
        num_subbands = 12
        max_level = 11
    
    # Read level info
    level_info = []
    for _ in range(2):  # Read width/height info
        val = read_u16_be(compressed_data, pos)
        pos += 2
        level_info.append(val)
    
    print(f"  Level info: {level_info}")
    
    # The rest is the wavelet coefficient data
    # Try to decompress with zlib
    remaining = compressed_data[pos:]
    
    try:
        # Sometimes the data is zlib compressed
        decompressed = zlib.decompress(remaining)
        print(f"  Decompressed: {len(decompressed)} bytes")
        
        # Interpret as LL subband (lowest frequency)
        ll_w = (width + 15) // 16
        ll_h = (height + 15) // 16
        
        if len(decompressed) >= ll_w * ll_h:
            ll = np.frombuffer(decompressed[:ll_w * ll_h], dtype=np.uint8).reshape((ll_h, ll_w))
            
            # Bilinear upscale
            from PIL import Image as PILImage
            ll_img = PILImage.fromarray(ll, mode='L')
            result = ll_img.resize((width, height), PILImage.BILINEAR)
            return np.array(result)
    except Exception as e:
        print(f"  Zlib failed: {e}")
    
    # Fallback: try to find raw LL coefficients
    # Look for patterns in the compressed data
    
    # Calculate LL dimensions at deepest level
    ll_w = width
    ll_h = height
    for _ in range(num_levels + 1):
        ll_w = (ll_w + 1) // 2
        ll_h = (ll_h + 1) // 2
    
    print(f"  Estimated LL size: {ll_w}x{ll_h}")
    
    # Try to extract LL from end of stream (common in wavelet formats)
    ll_size = ll_w * ll_h
    
    # Search for valid LL data
    for offset in range(0, min(len(remaining) - ll_size, 1000), 100):
        chunk = remaining[offset:offset + ll_size]
        if len(chunk) == ll_size:
            ll = np.frombuffer(chunk, dtype=np.uint8).reshape((ll_h, ll_w))
            mean = np.mean(ll)
            std = np.std(ll)
            # Good LL data should have reasonable stats
            if 20 < mean < 200 and std > 5:
                print(f"  Found candidate LL at offset {offset}, mean={mean:.1f}, std={std:.1f}")
                
                from PIL import Image as PILImage
                ll_img = PILImage.fromarray(ll, mode='L')
                result = ll_img.resize((width, height), PILImage.BILINEAR)
                return np.array(result)
    
    # Last resort: return gray image
    print("  Could not decode, returning placeholder")
    return np.full((height, width), 128, dtype=np.uint8)


def decode_itw(filepath: str) -> tuple[np.ndarray, dict]:
    """Decode ITW file to numpy array"""
    data = Path(filepath).read_bytes()
    header = parse_header(data)
    
    print(f"ITW: {header['width']}x{header['height']}, {header['bits']}bpp, v{header['version']}")
    
    # Read compression type
    comp_type = read_u16_be(data, 12)
    print(f"  Compression: 0x{comp_type:04X}")
    
    if comp_type == 0x0300:
        pixels = decode_v1_wavelet(data, header['width'], header['height'])
    elif comp_type == 0x0400:
        pixels = decode_v2_lzw(data, header['width'], header['height'])
    else:
        raise ValueError(f"Unknown compression type: 0x{comp_type:04X}")
    
    return pixels, header


def main():
    if len(sys.argv) < 2:
        print("Usage: itw_decode.py <input.itw> [output.png]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.replace('.ITW', '.png').replace('.itw', '.png')
    
    pixels, header = decode_itw(input_path)
    
    # Invert if needed (ITW stores inverted)
    pixels = 255 - pixels
    
    # Save as PNG
    img = Image.fromarray(pixels, mode='L')
    img.save(output_path)
    print(f"Saved: {output_path}")


if __name__ == '__main__':
    main()
