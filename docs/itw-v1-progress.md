# ITW V1 Decoder Progress

## Working
- ✅ Header parsing (big-endian dimensions at offset 6-10)
- ✅ CDF 5/3 wavelet reconstruction (correct lifting order)
- ✅ LL4 extraction from S16 (direct values)
- ✅ Multi-level reconstruction produces recognizable image

## Stream Structure (316×238 test file)
```
S0:  2380 bytes = 10 blocks × 238 rows (L1 LH ranges)
S1:   996 bytes = bit stream for L1 LH selectors
S2:  2528 bytes = L1 HL ranges
S3:  1470 bytes = L1 HL selectors
S4:  1200 bytes = 40×30 (L3 size) - (value, flag) pairs?
S5:   782 bytes = L2/L3 bit stream?
...
S16:  300 bytes = 20×15 = LL4 (direct)
S17:  320 bytes = L4 detail?
S18:  300 bytes = L4 detail?
```

## Key Findings
1. **S0/S1 format** (L1, quant=8):
   - S0 = range per block (bit7=flag, bits0-6=range)
   - S1 = bit stream: 4-bit actual range if flagged, then selectors
   - Organization: 10 blocks/row × 238 rows (full height)

2. **Fischer decode** (verified):
   - prob(n,r) recursive
   - selector interpretation working

3. **Quantization table**: [8,8, 4,4,4, 2,2,2, 1,1,1]

## TODO
- [ ] Understand S4-S15 format
- [ ] Connect decoded coefficients to wavelet positions
- [ ] Full reconstruction with details
