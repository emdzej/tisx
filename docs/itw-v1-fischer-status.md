# ITW V1 Fischer Decoder - Status

## What We Know

### Working
- LL4 (S16): Direct byte values, range ~20-80
- L3 details (S4, S6, S8): Zigzag encoded, working

### Not Working
- L1/L2 details (S0/S1, S2/S3): Fischer probability coding

## Fischer Algorithm Analysis

From Ghidra `FUN_004bbdf0`:

```python
# Simplified pseudocode
def fischer_decode(output_size, count, range_sum, prob_table):
    output = [0] * output_size
    cumulative = 0
    remaining = range_sum
    
    for pos in range(output_size):
        if cumulative >= count:
            break
        
        # Lookup probability threshold
        threshold = prob_table[remaining_positions - 1][remaining]
        
        if count < threshold + cumulative:
            output[pos] = 0
        else:
            # Binary search for magnitude
            # Determine sign
            # Update cumulative and remaining
```

### Probability Table

9×201 cumulative probability table:
- Row 4: `P(n) = 2n² + 2n + 1` = [1, 5, 13, 25, 41, 61, ...]
- Different rows for different remaining positions

### The Problem

The table values grow quadratically:
- `P(100)` = 20201
- `P(200)` = 80401

For the algorithm to produce non-zero outputs, `count` must exceed these thresholds.

But `count` values from S0/S1 are small (2-135 per block).

### Possibilities

1. **Different interpretation**: Count/range come from elsewhere (77-byte header?)
2. **Bit stream**: S1 is read bit-by-bit, not byte-by-byte
3. **Different algorithm**: Not standard Fischer coding

## Open Questions

1. Where do (count, range) parameters come from?
2. How is S1 consumed - bytes or bits?
3. What's the relationship between S0 blocks and S1 values?

## Files

- `re.c`: Ghidra decompiled code
- `scripts/itw_decode.py`: Working LL4+L3 decoder
- `docs/itw-v1-format.md`: Format documentation
