# ITW V1 Format (Type 0x0300) - Wavelet Compression

## Overview

ITW V1 uses **CDF 7/5 biorthogonal wavelet** compression with **Fischer/Combinatorial coding** for coefficient encoding. This is a sophisticated scheme similar to JPEG2000.

## File Structure

```
Offset  Size  Description
------  ----  -----------
0       4     Magic: "ITW_" (0x4954575F)
4       2     Type: 0x0300 (V1 wavelet)
6       2     Width (big-endian)
8       2     Height (big-endian)
10      4     Unknown
14      4     Compressed data size (big-endian)
18      N     Compressed data (multiple zlib streams)
```

## Wavelet Decomposition

4-level CDF 7/5 decomposition:

```
Level 0: Full resolution (316×238)
Level 1: 158×119 → LL1, LH1, HL1, HH1
Level 2: 79×60   → LL2, LH2, HL2, HH2  
Level 3: 40×30   → LL3, LH3, HL3, HH3
Level 4: 20×15   → LL4 (deepest)
```

## Stream Layout

The compressed data contains 19 zlib-compressed streams:

| Stream | Content | Format | Size Formula |
|--------|---------|--------|--------------|
| 0 | LH1 RLE positions | RLE | Variable |
| 1 | LH1 values | Fischer codes | Variable |
| 2 | HL1 RLE positions | RLE | Variable |
| 3 | HL1 values | Fischer codes | Variable |
| 4 | **LH2 coefficients** | Direct s8 | 79×15 = 1185 |
| 5 | HL2 RLE positions | RLE | Variable |
| 6 | HL2 values | Fischer codes | Variable |
| 7 | HH2 RLE positions | RLE | Variable |
| 8 | HH2 values | Fischer codes | Variable |
| 9-15 | Level 3 subbands | Mixed | Variable |
| 16 | **LL3 (deepest)** | Direct u8 | 40×30 = 1200* |
| 17-18 | Additional data | Unknown | Variable |

*Actual LL size depends on image dimensions

## RLE Format

Position streams use Run-Length Encoding:

```
0x00:       Place coefficient (read from value stream)
0x01-0x7F:  Skip N positions (N zeros)
0x80-0xFF:  Embedded coefficient = byte - 192 (range: -64 to +63)
```

## Fischer/Combinatorial Coding

### Concept

Fischer coding encodes multiple coefficients as a single integer using combinatorial number system. A single "code" integer is decoded into a sequence of coefficient values using a lookup table.

### Lookup Table Structure

9×201 table where each row is cumulative sum of previous:

```python
# Row 0: all ones
table[0] = [1, 1, 1, 1, ...]

# Row 1: odd numbers (2n+1)
table[1] = [1, 3, 5, 7, 9, 11, ...]

# Row 2: centered square numbers (2n²+2n+1)  
table[2] = [1, 5, 13, 25, 41, 61, 85, 113, 145, 181, 221, ...]

# Row 3+: cumulative sums
table[r][n] = sum(table[r-1][0:n+1])
```

### Value Stream Format

From decompiled `FUN_004b72b0`:

```
For level >= 2:
1. Read byte from value stream
2. has_sign_ext = (byte & 0x80) != 0
3. index = byte & 0x7F
4. If has_sign_ext: read 4 bits for sign extension
5. Use index with lookup table to get bit count
6. Read that many bits as coefficient value
```

### Fischer Decode Algorithm

From decompiled `FUN_004bbdf0`:

```python
def fischer_decode(code, num_coeffs, sign_bits, table_row):
    """
    Decode single integer into multiple coefficients.
    
    Args:
        code: Fischer-encoded integer
        num_coeffs: Number of coefficients to extract
        sign_bits: Bit flags for coefficient signs
        table_row: Which row of Fischer table to use
    """
    coeffs = []
    remaining = code
    
    for i in range(num_coeffs - 1, -1, -1):
        # Binary search for largest k where table[row][k] <= remaining
        k = 0
        for j in range(200, -1, -1):
            if FISCHER_TABLE[table_row][j] <= remaining:
                k = j
                break
        
        # Apply sign from sign_bits
        sign = -1 if (sign_bits >> i) & 1 else 1
        coeffs.append(k * sign)
        
        remaining -= FISCHER_TABLE[table_row][k]
    
    return list(reversed(coeffs))
```

## Bit Reader

From decompiled `FUN_004bc1d0` and `FUN_004bc220`:

```python
class BitReader:
    def __init__(self, data):
        self.data = data
        self.byte_pos = 0
        self.bit_pos = 0
        self.current_byte = 0
    
    def read_bit(self):
        """Read single bit (LSB first)"""
        if self.bit_pos == 0:
            self.current_byte = self.data[self.byte_pos]
        
        bit = self.current_byte & 1
        self.current_byte >>= 1
        self.bit_pos += 1
        
        if self.bit_pos == 8:
            self.bit_pos = 0
            self.byte_pos += 1
        
        return bit
    
    def read_bits(self, n):
        """Read N bits, LSB first"""
        value = 0
        for i in range(n):
            if self.read_bit():
                value |= (1 << i)
        return value
```

## Dequantization

### Level 1 (from `FUN_004b70a0`)

```python
def dequantize_level1(raw, quant, scale, offset, factor):
    return (raw % (quant * 2 + 1) - quant) * (scale / quant) * factor + offset
```

### Multi-level (from `FUN_004b6c40`)

```python
def dequantize(raw, quant, scale, offset):
    scale_factor = (16 - level_param) / 16  # from FUN_004b8a40
    return raw * (scale / scale_factor) + offset
```

### Quantization Steps per Level

```python
QUANT_STEPS = [8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1]
# Index: [LH0, HL0, HH0, LH1, HL1, HH1, LH2, HL2, HH2, LH3, HL3]
```

## CDF 7/5 Inverse Wavelet Transform

### 1D Transform

```python
def cdf75_inverse_1d(low, high, output_length):
    """
    Inverse CDF 7/5 lifting transform.
    low: Low-frequency coefficients (even positions)
    high: High-frequency coefficients (odd positions)
    """
    # Update step (modify low using high)
    for i in range(len(low)):
        left = high[i-1] if i > 0 else 0
        right = high[i] if i < len(high) else (high[-1] if high else 0)
        low[i] = low[i] - (left + right + 2) / 4
    
    # Interleave
    result = [0] * output_length
    for i in range(len(low)):
        result[2*i] = low[i]
    
    # Predict step (reconstruct high using updated low)
    for i in range(len(high)):
        left = result[2*i]
        right = result[2*i+2] if 2*i+2 < output_length else result[2*i]
        result[2*i+1] = high[i] + (left + right) / 2
    
    return result
```

### 2D Transform

Apply 1D transform first on columns (vertical), then on rows (horizontal).

## Current Implementation Status

### Working ✅
- File header parsing
- Zlib stream extraction
- LL3 direct decoding (stream 16)
- LH2 direct decoding (stream 4, signed bytes)
- RLE position parsing
- RLE embedded values (byte - 192)
- CDF 7/5 inverse transform
- Fischer table generation

### Partial 🔶
- Value stream parsing (format understood, not fully implemented)
- Fischer decoding (algorithm known, integration pending)

### Not Implemented ❌
- Complete bit reader with stream state
- Full coefficient extraction from Fischer codes
- Per-level dequantization
- HH subband decoding

## Key Functions from TIS.exe

| Address | Function | Purpose |
|---------|----------|---------|
| 004b5780 | Dispatcher | Routes V1 vs V2 |
| 004b5b30 | V1 Entry | Main decoder entry |
| 004b7970 | WaveletDecomp | Core decompression |
| 004b72b0 | CoeffReader | Read from streams |
| 004b7180 | Placement | Route to level handlers |
| 004b70a0 | Level1Place | Simple dequant |
| 004b6c40 | MultiLevel | Fischer-based placement |
| 004bbdf0 | FischerDecode | Combinatorial decoder |
| 004bc220 | ReadBits | Read N bits |
| 004bc1d0 | ReadBit | Read 1 bit (LSB first) |
| 004b8a60 | BuildTable | Create Fischer lookup |
| 004b8a40 | ScaleFactor | `(16-n)/16` |
| 004b88a0 | TableLookup | 3D array accessor |

## References

- BMW TIS (Technical Information System)
- CDF 7/5: Cohen-Daubechies-Feauveau biorthogonal wavelet
- Combinatorial Number System (Fischer coding)
- Ghidra decompilation of tis.exe

## Stream Mapping (Confirmed)

Based on analysis of 26.ITW (316×238):

| Stream | Size | Content | Dimensions |
|--------|------|---------|------------|
| 16 | 300 | **LL4 (deepest)** | 20×15 |
| 4 | 1200 | Detail band (sparse) | 40×30 |
| 0 | 2380 | LH1 RLE positions | - |
| 1 | 996 | LH1 values | - |
| 2 | 2528 | HL1 RLE positions | - |
| 3 | 1470 | HL1 values | - |

### Dimension Hierarchy

```
Level 4: 20×15   (LL4 = stream 16, 300 bytes)
Level 3: 40×30   (LL3 = 1200 pixels)
Level 2: 79×60   (LL2 = 4740 pixels)
Level 1: 158×119 (LL1 = 18802 pixels)
Level 0: 316×238 (Full image)
```

### LL Band Identification

To identify LL bands, check statistics:
- **LL bands**: Higher mean (~50), narrow range (e.g., 21-80)
- **Detail bands**: Low mean (~10), wide range, mostly zeros (sparse)

Stream 16 stats: mean=49.4, range=21-80 → **LL band confirmed**
Stream 4 stats: mean=8.8, range=0-173 → **Detail band (sparse)**

## Metadata Block (Before Zlib Streams)

The ITW V1 format has a metadata block between the header (offset 18) and the first zlib stream.

For 26.ITW (316×238):
- Metadata: 77 bytes (offsets 18-94)
- First zlib stream starts at offset 95

### Raw Metadata (hex)
```
00 04 01 fa 02 00 08 01 20 02 41 00 0c 01 20 02
be 00 2d 00 e0 05 32 00 37 00 e0 05 d6 00 0a 00
e0 03 6e 00 75 00 e0 08 70 00 7f 00 e0 0e e2 00
2b 00 e0 05 1f 00 31 00 e0 0a f0 00 4e 00 e0 0d
cb 00 15 00 e0 07 36 0d c2 14 6b 00 f4
```

### Possible Interpretation (Big Endian)
- Offset 0: 0x0004 = 4 (wavelet levels?)
- Offset 2: 0x01FA = 506 (some size/offset)
- Rest: Per-level or per-subband parameters

### TODO
- [ ] Reverse-engineer metadata format
- [ ] Map parameters to quantization tables
- [ ] Understand relationship to stream offsets

## RLE + Fischer Decoding Progress

### RLE Format (Working Hypothesis)
- `0`: Place Fischer pair (2 coefficients from value stream)
- `1-127`: Skip N positions, then place Fischer pair
- `128-255`: Place embedded coefficient (byte - 192 = -64 to +63)

### Fischer Triangular Number Decode
```python
def fischer_decode_pair(index):
    n = int((-1 + sqrt(1 + 8*index)) / 2)
    return n, index - n*(n+1)//2
```
This produces pairs (c1, c2) where c1 >= c2 >= 0.

### Coefficient Statistics
- LH1: ~1992 non-zero coefficients in 18802 positions (~10.6% density)
- HL1: ~2866 non-zero coefficients
- Coefficients concentrated at start of subband (positions 0-4357)

### Current Issues
1. Coefficient sign interpretation unclear
2. Grid pattern artifacts from CDF 7/5 upscaling without full detail bands
3. Only achieving partial reconstruction (details visible at top of image)

### Next Steps
- Need dequantization formula from decompiled code
- Verify CDF 7/5 lifting implementation
- Map all 4 levels of detail bands

## Working Decoder (LL-only)

### Stream 16 = LL4
- Dimensions: 20×15 = 300 bytes
- Range: 21-80 (needs rescaling to 0-255)
- Mean: 49.4

### Simple Decoder
For basic decoding (blurry but recognizable):
1. Extract stream 16 (LL4)
2. Rescale from [min, max] to [0, 255]
3. Bilinear upscale to target dimensions

### Confirmed Working
- LL4 extraction and visualization ✓
- Bilinear upscale produces recognizable image ✓
- Image appears to be BMW technical diagram ✓

### TODO
- Implement proper CDF 5/3 inverse wavelet
- Decode detail bands (streams 0-15)
- Apply dequantization with per-subband steps
