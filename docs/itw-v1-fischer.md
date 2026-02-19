# ITW V1 Fischer Coding Analysis

## Position Stream (S0) Format

The position stream uses byte pairs:

```
0, 0  → skip 1 position
0, N  → skip N positions  
M, N  → place M coefficients at consecutive positions, then skip N
```

This efficiently encodes sparse coefficient locations where most values are zero.

### Example decode:

```
[0,0,0,0,0,0...] (234 zeros) → skip 234 positions
[0,2]            → skip 2 more
[3,2]            → place 3 coefficients at pos 321,322,323, skip 2
[3,3]            → place 3 coefficients at pos 326,327,328, skip 3
...
```

### Statistics for test file (26.ITW):

- S0: 2380 bytes
- Decoded positions: 6697 (35% of L1 LH size 18802)
- Most values are zero (edge detection produces sparse results)

## Value Stream (S1) - Fischer Probability Coding

The value stream is Fischer probability coded, NOT raw bytes.

- S1: 996 bytes
- Expected values: 6697 (from positions)
- Compression ratio: ~6.7:1

### Fischer algorithm (from Ghidra):

1. Uses 9×201 cumulative probability table
2. Encodes coefficient magnitudes as range subdivisions
3. Sign encoded separately in the range
4. Triangular probability distribution: P(n) ≈ 4*(n+1)

### Probability table (first row):

```python
[1, 5, 13, 25, 41, 61, 85, 113, 145, 181, 221, 265, 313, 365, ...]
# Differences: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, ...
# Pattern: diff(n) = 4*(n+1)
```

### Key functions from Ghidra:

- `FUN_004bbdf0`: Main Fischer decode
- `FUN_004b88a0`: Probability table lookup
- `FUN_004b89e0`: Store decoded value
- `FUN_004b8a60`: Build probability table

## Implementation Status

✅ Position stream decoding
✅ Stream mapping (S0/S1 pairs)
❌ Fischer probability decoder (complex arithmetic coding)

## References

- Main RE: `re.c` lines 4156-4350
- Probability table: `re.c` lines 4250-4500
- Test file: `GRAFIK/1/03/95/26.ITW`

## Session Progress (2026-02-20)

### Stream Structure Discovery

The 19 zlib streams are organized as pairs:
- **Even streams (S0, S2, S4, ...)** = Position streams (run-length encoded)
- **Odd streams (S1, S3, S5, ...)** = Value streams (with Fischer encoding)
- **S16** = LL4 direct values (20×15 = 300 bytes) ✓ CONFIRMED
- **S17, S18** = L4 detail subbands (300 bytes each)

### Position Stream (S0) Format

\`\`\`
For position < max:
  if byte == 0:
    skip 1 position
  else:
    count = byte
    skip = next_byte
    mark 'count' positions starting at current
    advance by count + skip
\`\`\`

S0 produces 6893 positions for L1 subband (158×119).

### Value Stream (S1) Format

Each byte:
- Bit 7 = has_range flag
- Bits 0-6 = masked value (signed: 64-127 → negative)

If has_range:
- Read 4 bits from S3 bit stream → range (0-15)
- Read selector bits from S3 (bit count = ceil(log2(prob(range))))
- Fischer decode generates coefficients

Probability table: `prob(r) = 2*r² + 2*r + 1`

### Blocking

- 319 blocks from S0
- 996 S1 entries ≈ ceil(total_positions / 8)
- Each entry covers up to 8 coefficient positions

### Working Decoder

LL4-only bilinear upscale produces recognizable (blurry) wiring diagram.
Full wavelet reconstruction requires proper Fischer implementation.

### Next Steps

1. Complete Fischer decode algorithm
2. Map stream pairs to wavelet subbands (LH, HL, HH per level)
3. Implement proper CDF 5/3 or 9/7 inverse wavelet transform
