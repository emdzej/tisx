// Let's accurately emulate calc_band_size assembly.
// 004b7262: CALL 0x004c2ab8 -> probably ceil
// 004b7267: FIMUL dword ptr [ESP + 0x14] -> mult by param_3 (quant)! Wait! ESP+0x14 is param_3 after SUB ESP,8. Actually ESP was shifted by 4 initially, then 8.
// Before SUB ESP,8:
// [ESP+8] = param_1
// [ESP+0xc] = param_2
// [ESP+0x10] = param_3
// [ESP+0x14] = param_4
// After SUB ESP,8:
// param_1 is at ESP+0x10
// param_2 is at ESP+0x14
// param_3 is at ESP+0x18. Wait. In asm: FIMUL [ESP+0x14].

// Let's check:
// Math.ceil(param_1 / (param_3 * 2)) * param_2 * 2?
// For band 5: W=40, H=30, quant=2. orient=0 (param_4=0).
// ceil(W / (quant*2)) = ceil(40 / 4) = 10.
// Then FIMUL [ESP+0x14] (could be param_2, which is H). So 10 * 30 = 300?
// Then FMUL double ptr [0x004ed128] ... wait, 0x004ed128 is 2.0?
// If 0x004ed128 is 2.0, then 300 * 2.0 = 600.
// But we get 624!

// Wait, what if it's ceil((double)W / (double)(quant * 2)) * ceil((double)H / (double)2) ?
// 10 * 15 = 150 * 2 = 300.
