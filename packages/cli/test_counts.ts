const data = [
  {w: 158, h: 119, q: 8, o: 1, c: 2380},
  {w: 158, h: 119, q: 8, o: 1, c: 2528}, // Wait, in the output, Band 1 was 158x119 quant 8. Is that right? Yes.
  {w: 79, h: 59, q: 4, o: 1, c: 1200},
  {w: 79, h: 60, q: 4, o: 1, c: 1264},
  {w: 79, h: 59, q: 4, o: 1, c: 1264},
  {w: 40, h: 30, q: 2, o: 0, c: 624},
];

for (let d of data) {
  let size;
  // If param_4 is NOT 0:
  if (d.o === 1) { // orient=1 means vertical HL. But wait, in code `param_8` is 1.
    // Ghidra: `sVar2 = calc_band_size(*param_1, param_1[1], param_3, param_6)`
    // param_1[0]=w, param_1[1]=h, param_3=quant, param_6=orient
    // calc_band_size: if param_4==0 -> ceil(param_1 / (param_3*2)); else ceil(param_2 / (param_3*2))
    
    // For orient=1, size is ceil(H / (quant * 2)) ?
    // In our decompiled calc_band_size:
    // param_1=w, param_2=h, param_3=quant, param_4=orient
    // orient!=0 => ceil((double)param_2 / (double)(param_3*2))
    let y_blocks = Math.ceil(d.h / (d.q * 2));
    
    // Wait, the result of calc_band_size is JUST ceil(H / 2Q) ??? No, it must return total!
    // But decompilation says:
    // void calc_band_size(...) { if (p4==0) { ceil(p1 / p3*2); ftol(); return; } ... }
    // Wait! x86 float return values are passed in ST(0) or EAX! `ftol` converts float in ST(0) to int in EAX.
    // So the function returns the value! But where is the multiplication by width/height?!
    // Let's look at the assembly of calc_band_size again:
    // FIMUL dword ptr [ESP + 0x14]
    
  }
}
