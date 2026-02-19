/*
 * ITW Wavelet Decoder - Decompiled functions from TIS viewer
 * Cleaned from TIFF and other unrelated code
 * 
 * Key functions:
 * - fischer_decode (FUN_004bbdf0): Decompress Fischer-coded wavelet coefficients
 * - FUN_004b88a0: Calculate probability/combinations for Fischer decode
 * - FUN_004b89a0/e0/c0: Buffer read/write operations
 */

typedef unsigned int uint;
typedef unsigned char undefined1;
typedef unsigned int undefined4;


/* ============================================
 * FUN_004b88a0 - Calculate combinations/probability
 * Used by fischer_decode to determine coefficient values
 * ============================================ */
undefined4 __cdecl FUN_004b88a0(int param_1,uint param_2,uint param_3,uint param_4)

{
  int iVar1;
  
  if (((param_2 < *(uint *)(param_1 + 0xc)) && (param_3 < *(uint *)(param_1 + 0x10))) &&
     (param_4 < *(uint *)(param_1 + 0x14))) {
    iVar1 = *(int *)(*(int *)(param_1 + 0x28) + param_4 * 4);
    if (*(int *)(param_1 + 0x40) == 0) {
      return *(undefined4 *)
              (*(int *)(param_1 + 0x30) +
              (iVar1 + *(int *)(param_1 + 0x1c) * param_2 + *(int *)(param_1 + 0x20) * param_3) * 4)
      ;
    }
    return *(undefined4 *)
            (*(int *)(param_1 + 0x30) + (iVar1 + *(int *)(param_1 + 0x24) * param_3) * 4);
  }
  fprintf((FILE *)&atoi_exref,s_iArray_[%d,%d,_%d]_out_of_bounds_00516e28,param_2,param_3,param_4);
  return 0xffffffff;
}

undefined4 __cdecl
FUN_004b8920(int param_1,undefined4 param_2,uint param_3,uint param_4,uint param_5)

{
  int iVar1;
  
  if (((param_3 < *(uint *)(param_1 + 0xc)) && (param_4 < *(uint *)(param_1 + 0x10))) &&
     (param_5 < *(uint *)(param_1 + 0x14))) {
    iVar1 = *(int *)(*(int *)(param_1 + 0x28) + param_5 * 4);
    if (*(int *)(param_1 + 0x40) != 0) {
      *(undefined4 *)(*(int *)(param_1 + 0x30) + (iVar1 + *(int *)(param_1 + 0x24) * param_4) * 4) =
           param_2;
      return 0;
    }
    *(undefined4 *)
     (*(int *)(param_1 + 0x30) +
     (iVar1 + *(int *)(param_1 + 0x1c) * param_3 + *(int *)(param_1 + 0x20) * param_4) * 4) =
         param_2;
    return 0;
  }
  perror(s_iArray_out_of_bounds_00516e4c);
  return 0xffffffff;
}




/* ============================================
 * Buffer/Array operations
 * FUN_004b89a0 - Read value from output buffer
 * FUN_004b89c0 - Read coefficient
 * FUN_004b89e0 - Write value to output buffer
 * FUN_004b8a10 - Initialize/set buffer
 * ============================================ */
int __cdecl FUN_004b89c0(int param_1,int param_2)

{
  if (*(int *)(param_1 + 0x38) == 0) {
    return 0;
  }
  return *(int *)(param_1 + 0x24) * param_2 * 4 + *(int *)(param_1 + 0x30);
}


undefined4 __cdecl FUN_004b89e0(int param_1,undefined4 param_2,int param_3)

{
  if (*(int *)(param_1 + 0x38) == 0) {
    return 0xffffffff;
  }
  *(undefined4 *)(*(int *)(param_1 + 0x30) + *(int *)(param_1 + 0x24) * param_3 * 4) = param_2;
  return 0;
}


undefined4 __cdecl FUN_004b8a10(uint *param_1,undefined4 param_2)

{
  undefined4 *puVar1;
  uint uVar2;
  uint uVar3;
  
  uVar2 = 0;
  if (*param_1 != 0) {
    do {
      uVar3 = uVar2 + 1;
      puVar1 = (undefined4 *)FUN_004b89c0((int)param_1,uVar2);
      *puVar1 = param_2;
      uVar2 = uVar3;
    } while (uVar3 < *param_1);
  }
  return 0;
}


undefined4 __cdecl FUN_004b89a0(int param_1,int param_2)

{
  if (*(int *)(param_1 + 0x38) == 0) {
    return 0xffffffff;
  }
  return *(undefined4 *)(*(int *)(param_1 + 0x30) + *(int *)(param_1 + 0x24) * param_2 * 4);
}



/* ============================================
 * FUN_004bbdf0 - Fischer Decode
 * Main decompression function for wavelet coefficients
 * 
 * Parameters:
 *   param_1: Output buffer (coefficient array)
 *   param_2: Selector (encoded position in probability space)
 *   param_3: Range (sum of absolute values)
 *   param_4: Probability table parameters
 * ============================================ */
void __cdecl FUN_004bbdf0(uint *param_1,int param_2,uint param_3,uint *param_4)

{
  int iVar1;
  uint uVar2;
  uint uVar3;
  int iVar4;
  uint uVar5;
  uint local_10;
  int local_c;
  int local_8;
  
  uVar3 = *param_1;
  iVar4 = 0;
  local_c = 0;
  local_10 = param_3;
  FUN_004b8a10(param_1,0);
  if ((param_4[1] < param_3) || (*param_4 < uVar3)) {
    perror(s_***Error:_00516d18);
    perror(s_***ERROR:_fischer_decode()_***_00516e64);
    perror(s_***_00516cf4);
                    /* WARNING: Subroutine does not return */
    exit(1);
  }
  uVar5 = uVar3;
  if (param_3 == 0) {
    FUN_004b8a10(param_1,0);
    return;
  }
  do {
    if (param_2 == iVar4) {
      FUN_004b89e0((int)param_1,0,local_c);
      break;
    }
    iVar1 = FUN_004b88a0((int)param_4,uVar5 - 1,local_10,0);
    if (param_2 < iVar1 + iVar4) {
      FUN_004b89e0((int)param_1,0,local_c);
    }
    else {
      iVar1 = FUN_004b88a0((int)param_4,uVar5 - 1,local_10,0);
      local_8 = 1;
      iVar4 = iVar4 + iVar1;
      while( true ) {
        iVar1 = FUN_004b88a0((int)param_4,uVar5 - 1,local_10 - local_8,0);
        if (param_2 < iVar4 + iVar1 * 2) break;
        iVar1 = FUN_004b88a0((int)param_4,uVar5 - 1,local_10 - local_8,0);
        local_8 = local_8 + 1;
        iVar4 = iVar4 + iVar1 * 2;
      }
      if ((iVar4 <= param_2) &&
         (iVar1 = FUN_004b88a0((int)param_4,uVar5 - 1,local_10 - local_8,0), param_2 < iVar1 + iVar4
         )) {
        FUN_004b89e0((int)param_1,local_8,local_c);
      }
      iVar1 = FUN_004b88a0((int)param_4,uVar5 - 1,local_10 - local_8,0);
      if (iVar1 + iVar4 <= param_2) {
        FUN_004b89e0((int)param_1,-local_8,local_c);
        iVar1 = FUN_004b88a0((int)param_4,uVar5 - 1,local_10 - local_8,0);
        iVar4 = iVar4 + iVar1;
      }
    }
    uVar5 = uVar5 - 1;
    uVar2 = FUN_004b89a0((int)param_1,local_c);
    local_c = local_c + 1;
    local_10 = local_10 - ((uVar2 ^ (int)uVar2 >> 0x1f) - ((int)uVar2 >> 0x1f));
  } while (local_c < (int)uVar3);
  if (0 < (int)local_10) {
    iVar4 = uVar3 - 1;
    uVar3 = FUN_004b89a0((int)param_1,local_c);
    FUN_004b89e0((int)param_1,local_10 - ((uVar3 ^ (int)uVar3 >> 0x1f) - ((int)uVar3 >> 0x1f)),iVar4
                );
  }
  return;
}


float10 __cdecl FUN_004b8a40(int param_1)

{
  return ((float10)16.0 - (float10)param_1) * (float10)0.0625;
}
