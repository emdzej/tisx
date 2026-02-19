# ITW V1 Fischer Coding - Reverse Engineering Notes

## Overview

ITW V1 (type 0x0300) uses **Fischer/Combinatorial Number System** encoding for wavelet coefficients.
This is similar to techniques used in JPEG2000 but with a different implementation.

## Key Discoveries from TIS.exe Decompilation

### Function Map

| Address | Name | Purpose |
|---------|------|---------|
| `004b5780` | Dispatcher | Routes to V1 or V2 decoder based on type |
| `004b5b30` | V1 Entry | Main V1 wavelet decoder entry point |
| `004b7970` | Wavelet Decomp | Core wavelet decompression |
| `004b72b0` | Coeff Reader | Reads coefficients from streams |
| `004b7180` | Placement | Places coefficients in array |
| `004b70a0` | Level 1 Placement | Simple dequantization |
| `004b6c40` | Multi-level | Complex Fischer-based placement |
| `004bbdf0` | **Fischer Decode** | Core combinatorial decoder |
| `004bc220` | Bit Reader | Reads N bits from stream |
| `004bc1d0` | Single Bit | Reads 1 bit (LSB first) |
| `004b8a60` | Lookup Table | Builds Fischer coefficient table |
| `004b8a40` | Scale Factor | Returns `(16 - param) * 0.0625` |

### Fischer Table Structure

The lookup table is a 9×201 array where each row is the cumulative sum of the previous:

```
Row 0: [1, 1, 1, 1, 1, ...]                    (all ones)
Row 1: [1, 3, 5, 7, 9, ...]                    (odd numbers: 2n+1)
Row 2: [1, 5, 13, 25, 41, 61, ...]             (centered squares: 2n²+2n+1)
Row 3: [1, 6, 19, 44, 85, 146, ...]            (cumsum of row 2)
...
```

Formula: `table[r][n] = sum(table[r-1][0..n])`

### Value Stream Format

Based on `FUN_004b72b0`:

```
For each coefficient:
1. Read byte from value stream
2. Check bit 7 (0x80):
   - If set: read 4 more bits for sign extension
   - If clear: sign = 0
3. Use bits 0-6 as index
4. Look up bit count from table
5. Read that many bits as coefficient magnitude
```

### Dequantization

From `FUN_004b70a0` (Level 1):
```c
coeff = (raw % (quant*2 + 1) - quant) * (scale/quant) * factor + offset
```

Quantization steps per level: `[8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1]`

### Fischer Decode Algorithm (`FUN_004bbdf0`)

The Fischer decoder converts a single integer code into multiple coefficients:

```python
def fischer_decode(code, num_coeffs, table_row):
    coeffs = []
    remaining = code
    
    for i in range(num_coeffs - 1, -1, -1):
        # Find largest k where table[row][k] <= remaining
        k = binary_search(table[row], remaining)
        coeffs.append(k)
        remaining -= table[row][k]
    
    return reversed(coeffs)
```

## Stream Layout

| Stream | Content | Format |
|--------|---------|--------|
| 0 | LH1 RLE positions | RLE encoded |
| 1 | LH1 values | Fischer codes |
| 2 | HL1 RLE positions | RLE encoded |
| 3 | HL1 values | Fischer codes |
| 4 | LH2 coefficients | Direct signed bytes |
| ... | ... | ... |
| 16 | LL3 (deepest LL) | Direct unsigned bytes |

## RLE Format

```
0x00:       Place coefficient from value stream
0x01-0x7F:  Skip N positions (zeros)
0x80-0xFF:  Embedded coefficient = byte - 192 (range: -64 to +63)
```

## What Works

- LL3 direct decoding ✓
- LH2 direct decoding ✓
- RLE position parsing ✓
- RLE embedded values ✓
- CDF 7/5 inverse wavelet ✓
- Fischer table generation ✓

## What's Missing

- Complete bit reader implementation
- Fischer decode integration with bit streams
- Per-level table row selection
- Full coefficient dequantization chain

## References

- TIS.exe from BMW TIS (decompiled with Ghidra)
- CDF 7/5 biorthogonal wavelet (Cohen-Daubechies-Feauveau)
- Combinatorial Number System (Fischer coding)
