# ITW V1 Ghidra Analysis

## Key Functions

### Entry Point: `FUN_004b5780`
- Dispatch based on version: 0x0300 → `FUN_004b5b30`, 0x0400 → `FUN_004b57f0`

### V1 Decoder: `FUN_004b5b30`
```c
_Size = FUN_004b5750(param_1);      // Read compressed size (4 bytes BE)
_DstBuf = malloc(_Size);
fread(_DstBuf, 1, _Size, param_1);  // Read zlib payload
FUN_004b7970(puVar3, _DstBuf, &local_4);  // Main wavelet decode
// Convert float output to bytes via ftol()
```

### Wavelet Decode: `FUN_004b7970`
Main decode function with:
- **Decomposition levels**: 3 or 4 (controlled by version byte 3 or 4)
- **Quantization steps**: `{8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1}` (11 subbands)
- **Filter selection**: via `FUN_004b7720`

### Filter Coefficients: `FUN_004b7770`

#### Filter Type 0 (CDF 9/7 - JPEG 2000 lossy)
```
Analysis:  [0.0529, -0.0334, -0.0931, 0.3870, 0.3870, -0.0931, -0.0334, 0.0529]
Synthesis: [-0.0867, -0.0548, 0.4403, 0.8168, 0.4403, -0.0548, -0.0867]
```

#### Filter Type 1 (Custom 5/3 - NOT standard LeGall!)
```
Analysis:  [-0.0107, -0.0536, 0.2607, 0.6071, 0.2607, -0.0536, -0.0107]
Synthesis: [-0.05, 0.25, 0.6, 0.25, -0.05]
```
**Note**: This differs from standard LeGall 5/3 which uses:
- Synthesis: [-0.125, 0.25, 0.75, 0.25, -0.125]

### Fischer Decode: `FUN_004bbdf0`
Complex probability-based coefficient decoder using lookup tables.
- Produces signed integer coefficients
- Uses Fischer probability model
- Lookup via `FUN_004b88a0` (9×201 probability table)

### Coefficient Processing: `FUN_004b72b0`
```c
// For quantization step < 2 (LL subband):
FUN_004b70a0(...);  // Direct value extraction

// For quantization step >= 2 (detail subbands):
FUN_004b6c40(...);  // Fischer decode + dequantization
```

### Inverse Wavelet: `FUN_004bc640`
Reconstruction using synthesis filters:
- `FUN_004bc810` - Horizontal synthesis pass
- `FUN_004bcc90` - Vertical synthesis pass

## Quantization Mapping

| Index | Q Step | Subband |
|-------|--------|---------|
| 0 | 8 | LH1 |
| 1 | 8 | HL1 |
| 2 | 4 | LH2 |
| 3 | 4 | HL2 |
| 4 | 4 | HH2 |
| 5 | 2 | LH3 |
| 6 | 2 | HL3 |
| 7 | 2 | HH3 |
| 8 | 1 | LH4 |
| 9 | 1 | HL4 |
| 10 | 1 | HH4/LL4 |

## Stream Structure (V1)

The compressed payload contains:
1. 3-byte header (filter type, dimensions?)
2. Multiple bitstreams for each subband
3. LL coefficients at deepest level
4. Fischer-encoded detail coefficients

## Key Insight

The format is NOT simple RLE + values like we assumed!
It uses Fischer probability coding which is similar to arithmetic coding.
Each subband is encoded with its own bitstream using probability models.

## Next Steps

1. Implement Fischer probability tables
2. Implement bit-by-bit decoder
3. Use correct custom 5/3 synthesis filter (not LeGall)
4. Proper multi-level inverse wavelet with synthesis filters
