# ITW V1 Reconstruction - Ghidra Analysis

## Architecture Overview

### Pyramid Structure (FUN_004bc520)
- Creates `iVar22` levels (4 for our file, since version byte = 4)
- Each level has 4 subbands accessed via FUN_004bc4d0(level, index):
  - Index 0: LH (horizontal detail)
  - Index 1: HL (vertical detail) 
  - Index 2: HH (diagonal detail)
  - Index 3: LL (lowpass) - only at deepest level

### Dimension Splitting (FUN_004bc7c0)
```
Even N:  low = N/2,     high = N/2
Odd N:   low = (N+1)/2, high = (N-1)/2
```

### Band Array Layout in FUN_004b7970
```c
local_3c[11] = {8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1}  // quantization
```

Band allocation:
- piVar9[0] = level 0, subband 0 (LH at L1)
- piVar9[1] = level 0, subband 1 (HL at L1)
- piVar9[2..4] = level 1, subbands 0,1,2 (LH,HL,HH at L2)
- piVar9[5..7] = level 2, subbands 0,1,2 (LH,HL,HH at L3)
- piVar9[8..10] = level 3, subbands 0,1,2 (LH,HL,HH at L4)
- piVar9[11] = LL at deepest level (level 3)

Total: 12 bands (local_90 = 0xc = 12)

### Stream Reading Order
In the main loop (FUN_004b7970), bands 0..10 are read via FUN_004b72b0,
then LL is read via FUN_004bc130.

### FUN_004b72b0 - Band Decoder
Two paths based on quantization (param_3):
- **quant < 2**: Direct bit reading (FUN_004bc220 with iVar12 bits)
- **quant >= 2**: Sparse encoding:
  1. Read position stream (FUN_004bc0f0 bytes)
  2. Read extra bits flags (0x80 mask)
  3. Read rank values (FUN_004bc220 with computed bit length)

### Filter Coefficients (FUN_004b7770, type 1 = CDF 5/3)
**Low synthesis filter (7 taps):**
```
[-0.010714, -0.053571, 0.260714, 0.607143, 0.260714, -0.053571, -0.010714]
```

**High synthesis filter (5 taps):**
```
[-0.050000, 0.250000, 0.600000, 0.250000, -0.050000]
```

Both scaled by sqrt(2) via FUN_004bc3b0.

### Reconstruction (FUN_004bd1e0)
Iterates levels from deepest to shallowest:
1. Level 3→2: reconstruct from LL4 + L4 details
2. Level 2→1: reconstruct from L3 result + L3 details
3. Level 1→0: reconstruct from L2 result + L2 details
4. Final: reconstruct from L1 result + L1 details → output

### FUN_004bc640 - Single Level Reconstruction
Uses polyphase convolution (FUN_004bc940) with proper even/odd handling.
Applies filters in both dimensions (rows then columns or vice versa).

### Key Constants
- _DAT_004ed128: sqrt(2) factor
- _DAT_004ed190: 0.5 (scaling)
- _DAT_004ed118: 0x80 (flag mask for extra bits)
- DAT_004ed11c: sizeof(float) = 4

### LL Rescaling (in main loop)
After reading LL band, values are rescaled:
```
output = (value - 0.5) * ((range_max - range_min) / scale) + midpoint
clamped to [range_min, range_max]
```
