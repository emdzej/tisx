# Ghidra constants (ITW V1)

Extracted from addresses in `itw_decode_main`, `q15_to_float`, and `level_scale_factor`.

## Q15 / scale
- `DAT_004ed1f0` (q15_to_float divisor) = **32.0** (0x42000000)
- `DAT_004ed1d0` = **16.0** (double 0x4030000000000000)
- `DAT_004ed1d8` = **0.6875** (double 0x3fb0000000000000)

## LL rescale
- `DAT_004ed190` = **0.5** (double 0x3fe0000000000000)
- `DAT_004ed198` = **1/127 = 0.007874015748...** (double 0x3f80204081020408)
- `DAT_004ed1a0` = **127.0** (double 0x405fc00000000000)
