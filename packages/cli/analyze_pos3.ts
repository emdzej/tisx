// Let's understand the actual placement logic
// 
// Position stream has 2380 entries = W * ceil(H / quant) = 158 * 15 ≈ 2370
// For each entry:
//   - k = position & 0x7F = sum of absolute values for Fischer
//   - if k == 0: skip (no coefficients for this block)
//   - if k > 0: decode Fischer block (FISCHER_N=5 values), place them
//
// Placement pattern with quant=8:
// - For x in 0..W-1:
//   - For blockY in 0..ceil(H/quant)-1:
//     - position entry index = x * ceil(H/quant) + blockY
//     - if k > 0:
//       - decode 5 values via Fischer
//       - place at (x, blockY * something) with step (0, 2) maybe?

// But wait - FISCHER_N=5 decoded values, but quant=8 step?
// These 5 values need to map to 8 (or more) pixels somehow.

// From Ghidra coeff_reconstruct_quant2:
// - Two calls to placeSparseCoeffs per iteration
// - (x, baseY, 0, 2) and (x, baseY+1, 0, 2)
// - step (0, 2) means place 5 values at y, y+2, y+4, y+6, y+8 = 5 values over 10 pixels
// - Two calls = 10 values over 20 pixels? But we only decode 5 per Fischer!

// OH! I see - TWO Fischer decodes per outer iteration:
// - First Fischer → 5 values → placed at (x, baseY+0), (x, baseY+2), ... (x, baseY+8)
// - Second Fischer → 5 values → placed at (x, baseY+1), (x, baseY+3), ... (x, baseY+9)
// Together: 10 values covering baseY..baseY+9, interleaved
// Then baseY += 10

// So position stream should have ceil(H/10) * W entries per band? Not ceil(H/8)?
// Let's check: ceil(119/10) = 12, 158 * 12 = 1896 — not 2380

// Hmm, 2380 / 158 = 15.06 — so ~15 position entries per column
// 119 / 15 = 7.93 ≈ 8 — so step is 8, not 10!

// Maybe the two Fischer calls are NOT sequential (baseY, baseY+1)
// but something else?

console.log('158 * 15 =', 158 * 15, '(close to 2380)');
console.log('119 / 8 =', 119 / 8, '(~15 blocks per column)');
console.log('');
console.log('If step = quant = 8:');
console.log('  Position entries = W * ceil(H/quant) = 158 * ceil(119/8) = 158 * 15 = 2370');
console.log('  Actual: 2380 (diff 10)');
