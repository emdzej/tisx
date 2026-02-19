
undefined4 __thiscall RasterImage(void *this,char *param_1,int param_2)
{
  char cVar1;
  undefined1 uVar2;
  byte bVar3;
  undefined3 extraout_var;
  undefined4 *puVar4;
  undefined1 *puVar5;
  undefined3 extraout_var_00;
  byte *pbVar6;
  int iVar7;
  byte *pbVar8;
  uint uVar9;
  uint uVar10;
  char *pcVar11;
  int local_1c;
  int local_18;
  int local_14;
  int iStack_10;
  undefined4 local_c;
  undefined4 local_8;
  undefined4 local_4;
  
  *(undefined4 *)this = 0;
  if (param_1 == (char *)0x0) {
    return 0;
  }
  iVar7 = -1;
  pcVar11 = param_1;
  do {
    if (iVar7 == 0) break;
    iVar7 = iVar7 + -1;
    cVar1 = *pcVar11;
    pcVar11 = pcVar11 + 1;
  } while (cVar1 != '\0');
  if (iVar7 == -2) {
    return 0;
  }
  uVar2 = FUN_004b5370(param_1);
  if (CONCAT31(extraout_var,uVar2) != 0) {
    puVar4 = (undefined4 *)FUN_004907a0(param_1,&DAT_00504ec0);
    if (puVar4 == (undefined4 *)0x0) {
      return 0;
    }
    iVar7 = FUN_0047b860((int)puVar4,(int)this);
    if (iVar7 == 0) {
      FUN_00490600(puVar4);
      *(undefined4 *)this = 0;
      return 0;
    }
    if (*(int *)((int)this + 0x14) < param_2) {
      *(int *)((int)this + 0x14) = param_2;
      *(int *)((int)this + 0x10) =
           (param_2 - *(int *)((int)this + 0x10) % param_2) + *(int *)((int)this + 0x10);
    }
    if (*(int *)((int)this + 0x24) != 0) {
      Ordinal_731(*(int *)((int)this + 0x24));
    }
    iVar7 = Ordinal_729(*(int *)((int)this + 8) * *(int *)((int)this + 0x10));
    *(int *)((int)this + 0x24) = iVar7;
    if (iVar7 == 0) {
      return 0;
    }
    iVar7 = 1;
    uVar9 = 0;
    if (*(int *)((int)this + 8) != 0) {
      do {
        if (iVar7 != 1) goto LAB_0047bc70;
        uVar10 = uVar9 + 1;
        iVar7 = FUN_00492280(puVar4,*(int *)((int)this + 0x10) * uVar9 + *(int *)((int)this + 0x24),
                             uVar9,0);
        uVar9 = uVar10;
      } while (uVar10 < *(uint *)((int)this + 8));
    }
    if (iVar7 != 1) {
LAB_0047bc70:
      Log(&DAT_00518788,&DAT_0057f7b8,s_RasterImage:_Error_reading_scanl_00511f40);
    }
    if (*(short *)((int)this + 0x18) == 0) {
      pbVar8 = *(byte **)((int)this + 0x24);
      pbVar6 = pbVar8 + *(int *)((int)this + 8) * *(int *)((int)this + 0x10);
      for (; pbVar8 < pbVar6; pbVar8 = pbVar8 + 1) {
        *pbVar8 = ~*pbVar8;
      }
      *(undefined2 *)((int)this + 0x18) = 1;
    }
    FUN_00490600(puVar4);
    *(undefined4 *)this = 1;
    return 1;
  }
  Log(&DAT_00518788,&DAT_0057f850,s_RasterImage:_Is_a_Wavelet_file_%_00511fd0);
  puVar4 = FUN_004b5290(param_1,&local_4);
  if (puVar4 == (undefined4 *)0x0) {
    pcVar11 = s_RasterImage:_Error_in_ITWOpen()_%_00511f68;
  }
  else {
    FUN_004b5120((int)puVar4,&local_18,&local_1c);
    FUN_004b50f0((int)puVar4,&local_c,&local_8,&local_14);
    local_1c = 1;
    if (local_14 != 8) {
      local_1c = 2;
    }
    local_18 = 4;
    if (*(int *)((int)this + 0x24) != 0) {
      Ordinal_731(*(int *)((int)this + 0x24));
    }
    FUN_004b5140((int)puVar4,local_18,local_1c);
    FUN_004b5220((int)puVar4,&iStack_10);
    puVar5 = (undefined1 *)Ordinal_729(iStack_10);
    *(undefined1 **)((int)this + 0x24) = puVar5;
    if (puVar5 == (undefined1 *)0x0) {
      Log(&DAT_00518788,&DAT_0057f818,s_RasterImage:_rasterData_==_0_00511fb0);
      FUN_004b5350(puVar4);
      return 0;
    }
    bVar3 = FUN_004b5170(puVar4,puVar5);
    if (CONCAT31(extraout_var_00,bVar3) == 0) {
      *(undefined4 *)this = 1;
      *(undefined2 *)((int)this + 0xc) = (undefined2)local_14;
      *(undefined4 *)((int)this + 4) = local_c;
      *(undefined4 *)((int)this + 8) = local_8;
      goto LAB_0047bb93;
    }
    pcVar11 = s_RasterImage:_Error_in_ITWRead()_%_00511f8c;
  }
  Log(&DAT_00518788,&DAT_0057f818,pcVar11);
LAB_0047bb93:
  FUN_004b5350(puVar4);
  return 1;
}



undefined1 __cdecl FUN_004b5370(char *param_1)

{
  FILE *_File;
  int iVar1;
  
  _File = fopen(param_1,&DAT_005115a8);
  if (_File == (FILE *)0x0) {
    return 2;
  }
  iVar1 = FUN_004b5750(_File);
  if ((_File->_flag & 0x20) != 0) {
    fclose(_File);
    return 1;
  }
  fclose(_File);
  return '\x01' - (iVar1 == 0x4954575f);
}


undefined4 __cdecl FUN_004b5750(FILE *param_1)

{
  short sVar1;
  short sVar2;
  
  sVar1 = FUN_004b56f0(param_1);
  sVar2 = FUN_004b56f0(param_1);
  return CONCAT22(sVar1,sVar2);
}


short __cdecl FUN_004b56f0(FILE *param_1)

{
  byte bVar1;
  byte bVar2;
  int iVar3;
  
  iVar3 = param_1->_cnt + -1;
  param_1->_cnt = iVar3;
  if (iVar3 < 0) {
    iVar3 = _filbuf(param_1);
    bVar1 = (byte)iVar3;
  }
  else {
    bVar1 = *param_1->_ptr;
    param_1->_ptr = param_1->_ptr + 1;
  }
  iVar3 = param_1->_cnt + -1;
  param_1->_cnt = iVar3;
  if (iVar3 < 0) {
    iVar3 = _filbuf(param_1);
    bVar2 = (byte)iVar3;
  }
  else {
    bVar2 = *param_1->_ptr;
    param_1->_ptr = param_1->_ptr + 1;
  }
  return (ushort)bVar1 * 0x100 + (ushort)bVar2;
}


int * __cdecl
FUN_004929a0(char *param_1,char *param_2,int param_3,int param_4,int param_5,int param_6,
            undefined *param_7,int param_8,int param_9,int param_10)

{
  ushort *puVar1;
  char cVar2;
  ushort uVar3;
  uint uVar4;
  int *piVar5;
  int iVar6;
  uint uVar7;
  uint uVar8;
  char *pcVar9;
  int *piVar10;
  char *pcVar11;
  
  uVar4 = FUN_00492940(param_2,"TIFFClientOpen");
  if (uVar4 != 0xffffffff) {
    uVar7 = 0xffffffff;
    pcVar11 = param_1;
    do {
      if (uVar7 == 0) break;
      uVar7 = uVar7 - 1;
      cVar2 = *pcVar11;
      pcVar11 = pcVar11 + 1;
    } while (cVar2 != '\0');
    piVar5 = (int *)FUN_00490880(~uVar7 + 0x1c8);
    if (piVar5 != (int *)0x0) {
      FUN_00490910(piVar5,0,0x1c8);
      uVar7 = 0xffffffff;
      *piVar5 = (int)(piVar5 + 0x72);
      pcVar11 = param_1;
      do {
        pcVar9 = pcVar11;
        if (uVar7 == 0) break;
        uVar7 = uVar7 - 1;
        pcVar9 = pcVar11 + 1;
        cVar2 = *pcVar11;
        pcVar11 = pcVar9;
      } while (cVar2 != '\0');
      uVar7 = ~uVar7;
      pcVar11 = pcVar9 + -uVar7;
      piVar10 = piVar5 + 0x72;
      for (uVar8 = uVar7 >> 2; uVar8 != 0; uVar8 = uVar8 - 1) {
        *piVar10 = *(undefined4 *)pcVar11;
        pcVar11 = pcVar11 + 4;
        piVar10 = (int *)((int)piVar10 + 4);
      }
      for (uVar7 = uVar7 & 3; uVar7 != 0; uVar7 = uVar7 - 1) {
        *(char *)piVar10 = *pcVar11;
        pcVar11 = pcVar11 + 1;
        piVar10 = (int *)((int)piVar10 + 1);
      }
      piVar5[2] = uVar4 & 0xfffffcff;
      *(undefined2 *)(piVar5 + 0x42) = 0xffff;
      piVar5[0x44] = 0;
      piVar5[0x43] = -1;
      piVar5[0x41] = -1;
      piVar5[0x66] = param_3;
      piVar5[0x67] = param_4;
      piVar5[0x68] = param_5;
      piVar5[0x69] = param_6;
      piVar5[0x6a] = (int)param_7;
      puVar1 = (ushort *)(piVar5 + 0x3d);
      piVar5[0x6b] = param_8;
      piVar5[100] = param_9;
      piVar5[0x65] = param_10;
      iVar6 = (*(code *)piVar5[0x67])(piVar5[0x66],puVar1,8);
      if (iVar6 == 8) {
        uVar3 = *puVar1;
        if ((uVar3 == 0x4d4d) || (uVar3 == 0x4949)) {
          FUN_00492ce0((int)piVar5,(uint)uVar3,0);
          if ((*(byte *)(piVar5 + 3) & 0x80) != 0) {
            FUN_00494f20((undefined1 *)((int)piVar5 + 0xf6));
            FUN_00494f40((undefined1 *)(piVar5 + 0x3e));
          }
          if (*(short *)((int)piVar5 + 0xf6) == 0x2a) {
            piVar5[3] = piVar5[3] | 0x200;
            piVar5[0x5e] = 0;
            piVar5[0x60] = 0;
            piVar5[0x5f] = 0;
            if (*param_2 == 'a') {
              iVar6 = FUN_00491130((int)piVar5);
              if (iVar6 != 0) {
                return piVar5;
              }
            }
            else if (*param_2 == 'r') {
              piVar5[5] = piVar5[0x3e];
              iVar6 = (*(code *)piVar5[100])(piVar5[0x66],piVar5 + 0x62,piVar5 + 99);
              if (iVar6 != 0) {
                piVar5[3] = piVar5[3] | 0x800;
              }
              iVar6 = FUN_004931c0(piVar5);
              if (iVar6 != 0) {
                piVar5[0x61] = -1;
                piVar5[3] = piVar5[3] | 0x10;
                return piVar5;
              }
            }
          }
          else {
            FUN_004905b0(param_1,s_Not_a_TIFF_file,_bad_version_num_005136d4);
          }
        }
        else {
          FUN_004905b0(param_1,s_Not_a_TIFF_file,_bad_magic_numbe_00513704);
        }
      }
      else {
        if (piVar5[2] == 0) {
          pcVar11 = s_Cannot_read_TIFF_header_0051374c;
        }
        else {
          if ((*(byte *)(piVar5 + 3) & 0x80) == 0) {
            uVar3 = 0x4949;
          }
          else {
            uVar3 = 0x4d4d;
          }
          *puVar1 = uVar3;
          *(undefined2 *)((int)piVar5 + 0xf6) = 0x2a;
          piVar5[0x3e] = 0;
          iVar6 = (*(code *)piVar5[0x68])(piVar5[0x66],puVar1,8);
          if (iVar6 == 8) {
            FUN_00492ce0((int)piVar5,(uint)*puVar1,0);
            iVar6 = FUN_00491130((int)piVar5);
            if (iVar6 != 0) {
              piVar5[4] = 0;
              return piVar5;
            }
            goto LAB_00492b14;
          }
          pcVar11 = s_Error_writing_TIFF_header_00513730;
        }
        FUN_004905b0(param_1,pcVar11);
      }
LAB_00492b14:
      piVar5[2] = 0;
      FUN_00490600(piVar5);
      return (int *)0x0;
    }
    FUN_004905b0("TIFFClientOpen",s_%s:_Out_of_memory_(TIFF_structur_00513764);
  }
  (*(code *)param_7)(param_3);
  return (int *)0x0;
}


/* WARNING: Removing unreachable block (ram,0x0047b8f2) */
/* WARNING: Removing unreachable block (ram,0x0047b939) */
/* WARNING: Removing unreachable block (ram,0x0047b949) */
/* WARNING: Removing unreachable block (ram,0x0047b94f) */

undefined4 __cdecl
FUN_004960a0(undefined4 *param_1,int param_2,int param_3,ushort *param_4,int param_5,float *param_6)

{
  undefined4 *puVar1;
  undefined4 uVar2;
  undefined4 *puVar3;
  uint uVar4;
  float local_c;
  int local_4;
  
  *param_4 = (ushort)param_3;
  param_4[1] = (ushort)param_2;
  *(int *)(param_4 + 2) = param_5;
  puVar1 = (undefined4 *)FUN_00490880(param_5 * 8);
  if (param_5 != 0) {
    local_4 = param_5;
    puVar3 = puVar1;
    do {
      local_c = *param_6;
      if (0x80000000 < (uint)local_c) {
        if (param_2 == 5) {
          FUN_00492ec0((int)param_1,param_3);
          FUN_004905e0(*param_1,s_"%s":_Information_lost_writing_v_00514150);
          local_c = 0.0;
        }
        else {
          local_c = -local_c;
        }
      }
      uVar4 = 1;
      if ((0 < (int)local_c) && ((int)local_c < 0x4d800000)) {
        do {
          if (0xfffffff < uVar4) break;
          local_c = local_c * 8.0;
          uVar4 = uVar4 << 3;
        } while (local_c < 2.6843546e+08);
      }
      param_6 = param_6 + 1;
      uVar2 = ftol();
      *puVar3 = uVar2;
      local_4 = local_4 + -1;
      puVar3[1] = uVar4;
      puVar3 = puVar3 + 2;
    } while (local_4 != 0);
  }
  uVar2 = FUN_004962c0(param_1,param_4,puVar1);
  FUN_004908a0(puVar1);
  return uVar2;
}


undefined4 __cdecl
FUN_00496060(undefined4 *param_1,ushort param_2,ushort param_3,ushort *param_4,int param_5,
            undefined4 *param_6)

{
  undefined4 uVar1;
  
  *param_4 = param_3;
  param_4[1] = param_2;
  *(int *)(param_4 + 2) = param_5;
  if (param_5 == 1) {
    *(undefined4 *)(param_4 + 4) = *param_6;
    return 1;
  }
  uVar1 = FUN_004962c0(param_1,param_4,param_6);
  return uVar1;
}

undefined4 __cdecl
FUN_004961f0(undefined4 *param_1,ushort param_2,ushort param_3,ushort *param_4,int param_5,
            undefined4 *param_6)

{
  undefined4 uVar1;
  
  *param_4 = param_3;
  param_4[1] = param_2;
  *(int *)(param_4 + 2) = param_5;
  if (param_5 == 1) {
    *(undefined4 *)(param_4 + 4) = *param_6;
    return 1;
  }
  uVar1 = FUN_004962c0(param_1,param_4,param_6);
  return uVar1;
}



undefined4 * __cdecl FUN_004b5290(char *param_1,undefined4 *param_2)

{
  FILE *pFVar1;
  uint uVar2;
  undefined4 *puVar3;
  int local_c;
  int local_8;
  int local_4;
  
  pFVar1 = fopen(param_1,&DAT_005115a8);
  if (pFVar1 == (FILE *)0x0) {
    *param_2 = 2;
    return (undefined4 *)0x0;
  }
  uVar2 = FUN_004b5680(pFVar1,&local_c,&local_8,&local_4);
  if (uVar2 != 0) {
    *param_2 = 3;
    return (undefined4 *)0x0;
  }
  puVar3 = malloc(0x20);
  if (puVar3 == (undefined4 *)0x0) {
    *param_2 = 4;
    return (undefined4 *)0x0;
  }
  *puVar3 = pFVar1;
  puVar3[1] = local_c;
  puVar3[2] = local_8;
  puVar3[3] = local_c;
  puVar3[4] = local_8;
  puVar3[5] = local_4;
  puVar3[6] = 1;
  puVar3[7] = 1;
  *param_2 = 0;
  return puVar3;
}


uint __cdecl FUN_004b5680(FILE *param_1,int *param_2,int *param_3,int *param_4)

{
  short sVar1;
  
  FUN_004b56f0(param_1);
  FUN_004b56f0(param_1);
  FUN_004b56f0(param_1);
  sVar1 = FUN_004b56f0(param_1);
  *param_2 = (int)sVar1;
  sVar1 = FUN_004b56f0(param_1);
  *param_3 = (int)sVar1;
  sVar1 = FUN_004b56f0(param_1);
  *param_4 = (int)sVar1;
  return (param_1->_flag & 0x20U) >> 5;
}


undefined4 __cdecl FUN_004b5120(int param_1,undefined4 *param_2,undefined4 *param_3)

{
  *param_2 = *(undefined4 *)(param_1 + 0x18);
  *param_3 = *(undefined4 *)(param_1 + 0x1c);
  return 0;
}

undefined4 __cdecl

FUN_004b50f0(int param_1,undefined4 *param_2,undefined4 *param_3,undefined4 *param_4)

{
  *param_2 = *(undefined4 *)(param_1 + 0xc);
  *param_3 = *(undefined4 *)(param_1 + 0x10);
  *param_4 = *(undefined4 *)(param_1 + 0x14);
  return 0;
}


byte __cdecl FUN_004b5170(undefined4 *param_1,undefined1 *param_2)

{
  uint uVar1;
  int iVar2;
  int iVar3;
  
  uVar1 = param_1[1];
  if ((uVar1 == param_1[3]) && (iVar3 = param_1[2], param_1[4] == iVar3)) {
    iVar2 = FUN_004b51f0(uVar1,param_1[6],param_1[7]);
    iVar3 = FUN_004b5780((FILE *)*param_1,param_2,uVar1,iVar3,iVar2);
    return (iVar3 == 0) - 1U & 3;
  }
  iVar3 = FUN_004b53d0(param_1,param_2,param_1[4],param_1[3]);
  return (iVar3 == 0) - 1U & 3;
}


int __cdecl FUN_004b51f0(uint param_1,uint param_2,int param_3)

{
  uint uVar1;
  
  uVar1 = FUN_004b5260(param_1,param_3);
  if (uVar1 % param_2 == 0) {
    return 0;
  }
  return param_2 - uVar1 % param_2;
}


uint __cdecl FUN_004b5260(uint param_1,int param_2)

{
  uint uVar1;
  
  if (param_2 == 2) {
    uVar1 = (int)param_1 >> 0x1f;
    return (((param_1 ^ uVar1) - uVar1 & 1 ^ uVar1) - uVar1) + (int)param_1 / 2;
  }
  return param_1;
}



undefined4 __cdecl
FUN_004b5780(FILE *param_1,undefined1 *param_2,int param_3,int param_4,int param_5)

{
  short sVar1;
  undefined4 uVar2;
  
  sVar1 = FUN_004b56f0(param_1);
  if (sVar1 == 0x300) {
    uVar2 = FUN_004b5b30(param_1,param_2,param_3,param_4,param_5);
    return uVar2;
  }
  if (sVar1 != 0x400) {
    return 1;
  }
  uVar2 = FUN_004b57f0(param_1,param_2,(ushort)param_3,(ushort)param_4,param_5);
  return uVar2;
}


undefined4 __cdecl
FUN_004b5b30(FILE *param_1,undefined1 *param_2,int param_3,int param_4,int param_5)

{
  int iVar1;
  undefined1 uVar2;
  size_t _Size;
  void *_DstBuf;
  uint *puVar3;
  int local_8;
  int local_4;
  
  _Size = FUN_004b5750(param_1);
  _DstBuf = malloc(_Size);
  fread(_DstBuf,1,_Size,param_1);
  fclose(param_1);
  puVar3 = (uint *)FUN_004b8130((int *)0x0,param_3,param_4,1);
  FUN_004b7970(puVar3,(int)_DstBuf,&local_4);
  free(_DstBuf);
  if (param_4 != 0) {
    local_8 = param_4;
    iVar1 = param_3;
    do {
      for (; iVar1 != 0; iVar1 = iVar1 + -1) {
        uVar2 = ftol();
        *param_2 = uVar2;
        param_2 = param_2 + 1;
      }
      if (param_5 != 0) {
        param_2 = param_2 + param_5;
      }
      local_8 = local_8 + -1;
      iVar1 = param_3;
    } while (local_8 != 0);
  }
  return 0;
}




int * __cdecl FUN_004b8130(int *param_1,int param_2,int param_3,int param_4)

{
  int iVar1;
  void *pvVar2;
  int iVar3;
  int iVar4;
  int iVar5;
  
  if (param_1 == (int *)0x0) {
    param_1 = (int *)FUN_004b8110();
  }
  if (param_1[0xd] != 0x1e240) {
    return (int *)0x0;
  }
  if ((void *)param_1[0xc] != (void *)0x0) {
    free((void *)param_1[0xc]);
  }
  iVar1 = param_4 * param_3 * param_2;
  pvVar2 = malloc(iVar1 * 4);
  param_1[0xc] = (int)pvVar2;
  param_1[0xb] = 0;
  if (param_1[0xc] == 0) {
    perror(s_Cannot_allocate_memory_for_fArra_00516da4);
    return (int *)0x0;
  }
  if ((void *)param_1[10] != (void *)0x0) {
    free((void *)param_1[10]);
  }
  iVar5 = 0;
  pvVar2 = malloc(param_4 << 2);
  param_1[10] = (int)pvVar2;
  if (0 < param_4) {
    iVar4 = 0;
    iVar3 = param_4;
    do {
      iVar4 = iVar4 + 4;
      *(int *)(param_1[10] + -4 + iVar4) = iVar5;
      iVar5 = iVar5 + param_3 * param_2;
      iVar3 = iVar3 + -1;
    } while (iVar3 != 0);
  }
  param_1[3] = param_2;
  param_1[4] = param_3;
  param_1[5] = param_4;
  *param_1 = param_2;
  param_1[1] = param_3;
  param_1[2] = param_4;
  param_1[6] = iVar1;
  param_1[7] = 1;
  param_1[8] = param_2;
  if (param_2 == 1) {
    param_1[7] = 1;
    param_1[8] = 1;
    param_1[0xe] = 1;
    param_1[0x10] = 1;
  }
  else {
    if (param_3 != 1) {
      param_1[0xe] = 0;
      param_1[0x10] = 0;
    }
    else {
      param_1[7] = 1;
      param_1[8] = param_2;
      param_1[0xe] = 1;
    }
    param_1[0xf] = (uint)(param_3 == 1);
  }
  param_1[9] = param_1[7];
  return param_1;
}

void FUN_004b8110(void)

{
  void *pvVar1;
  
  pvVar1 = calloc(1,0x44);
  *(undefined4 *)((int)pvVar1 + 0x34) = 0x1e240;
  return;
}



undefined4 __cdecl
FUN_004b57f0(FILE *param_1,undefined1 *param_2,ushort param_3,ushort param_4,int param_5)

{
  int iVar1;
  int *piVar2;
  int *piVar3;
  uint *puVar4;
  uint *puVar5;
  uint *puVar6;
  uint *puVar7;
  uint uVar8;
  int iVar9;
  undefined1 *puVar10;
  int iVar11;
  int iVar12;
  uint uVar13;
  
  iVar11 = 0;
  DAT_00580020 = FUN_004b6940((uint *)0x0,0,0x1000);
  DAT_0058001c = FUN_004b67d0((uint *)0x0,0,0x1000);
  DAT_00580014 = FUN_004b67d0((uint *)0x0,0,0x1000);
  FUN_004b5a40(param_1);
  piVar2 = (int *)FUN_004b61d0(0);
  piVar3 = (int *)FUN_004b61d0(0);
  puVar4 = FUN_004b67d0((uint *)0x0,0,0x400);
  puVar5 = FUN_004b67d0((uint *)0x0,0,0x400);
  FUN_004b6250(piVar2,DAT_00580014,(int *)puVar4);
  iVar12 = 0;
  FUN_004b6250(piVar3,DAT_0058001c,(int *)puVar5);
  for (iVar9 = *puVar5 + *puVar4; 0 < iVar9; iVar9 = iVar9 + iVar1) {
    if ((uint)*(byte *)(puVar4[3] + iVar11) < DAT_00580018 + 8U) {
      iVar1 = -2;
      iVar12 = iVar12 + 1;
      FUN_004b6a10((int *)DAT_00580020,(uint)*(byte *)((puVar5[3] - 1) + iVar12));
      FUN_004b6a10((int *)DAT_00580020,(uint)*(byte *)(puVar4[3] + iVar11));
    }
    else {
      iVar1 = -1;
      FUN_004b6a10((int *)DAT_00580020,(uint)*(byte *)(puVar4[3] + iVar11));
    }
    iVar11 = iVar11 + 1;
  }
  puVar6 = FUN_004b67d0((uint *)0x0,0,0x400);
  puVar7 = (uint *)FUN_004b5c40(0,999);
  FUN_004b5d20(puVar7,DAT_00580020,(int *)puVar6);
  iVar11 = 0;
  if (param_4 != 0) {
    uVar8 = (uint)param_4;
    do {
      if (param_3 != 0) {
        uVar13 = (uint)param_3;
        puVar10 = param_2;
        do {
          iVar11 = iVar11 + 1;
          param_2 = puVar10 + 1;
          uVar13 = uVar13 - 1;
          *puVar10 = *(undefined1 *)((puVar6[3] - 1) + iVar11);
          puVar10 = param_2;
        } while (uVar13 != 0);
      }
      if (param_5 != 0) {
        param_2 = param_2 + param_5;
      }
      uVar8 = uVar8 - 1;
    } while (uVar8 != 0);
  }
  FUN_004b69d0(DAT_00580020);
  FUN_004b6850(puVar4);
  FUN_004b6850(puVar5);
  FUN_004b6850(puVar6);
  FUN_004b6850(DAT_00580014);
  FUN_004b6850(DAT_0058001c);
  FUN_004b6210(piVar2);
  FUN_004b6210(piVar3);
  FUN_004b5cd0(puVar7);
  return 0;
}


uint * __cdecl FUN_004b6940(uint *param_1,uint param_2,uint param_3)

{
  void *pvVar1;
  uint uVar2;
  
  if (param_1 == (uint *)0x0) {
    param_1 = (uint *)FUN_004b6920();
  }
  if (param_1[4] != 0x1e240) {
    return (uint *)0x0;
  }
  uVar2 = (param_2 / param_3 + 1) * param_3;
  if ((void *)param_1[3] != (void *)0x0) {
    free((void *)param_1[3]);
  }
  pvVar1 = malloc(uVar2 * 4);
  param_1[3] = (uint)pvVar1;
  if (pvVar1 == (void *)0x0) {
    perror(s_Cannot_allocate_memory_for_Stack_00516c80);
    return (uint *)0x0;
  }
  *param_1 = param_2;
  param_1[1] = param_3;
  param_1[2] = uVar2;
  return param_1;
}


void FUN_004b6920(void)

{
  void *pvVar1;
  
  pvVar1 = calloc(1,0x14);
  *(undefined4 *)((int)pvVar1 + 0x10) = 0x1e240;
  return;
}


uint * __cdecl FUN_004b67d0(uint *param_1,uint param_2,uint param_3)

{
  void *pvVar1;
  size_t _Size;
  
  if (param_1 == (uint *)0x0) {
    param_1 = (uint *)FUN_004b67b0();
  }
  if (param_1[4] != 0x1e240) {
    return (uint *)0x0;
  }
  _Size = (param_2 / param_3 + 1) * param_3;
  if ((void *)param_1[3] != (void *)0x0) {
    free((void *)param_1[3]);
  }
  pvVar1 = malloc(_Size);
  param_1[3] = (uint)pvVar1;
  if (pvVar1 == (void *)0x0) {
    perror(s_Cannot_allocate_memory_for_Stack_00516c80);
    return (uint *)0x0;
  }
  *param_1 = param_2;
  param_1[1] = param_3;
  param_1[2] = _Size;
  return param_1;
}


void FUN_004b67b0(void)

{
  void *pvVar1;
  
  pvVar1 = calloc(1,0x14);
  *(undefined4 *)((int)pvVar1 + 0x10) = 0x1e240;
  return;
}


int __cdecl FUN_004b61d0(int param_1)

{
  uint *puVar1;
  undefined4 uVar2;
  
  if (param_1 == 0) {
    param_1 = FUN_004b61b0();
  }
  puVar1 = FUN_004b67d0((uint *)0x0,0,0x400);
  *(uint **)(param_1 + 0x18) = puVar1;
  uVar2 = FUN_004b5f30();
  *(undefined4 *)(param_1 + 0x1c) = uVar2;
  uVar2 = FUN_004b5f30();
  *(undefined4 *)(param_1 + 0x20) = uVar2;
  return param_1;
}


void FUN_004b61b0(void)

{
  undefined4 *puVar1;
  
  puVar1 = calloc(1,0x24);
  *puVar1 = 0x1e240;
  return;
}

void FUN_004b5f30(void)

{
  void *pvVar1;
  
  pvVar1 = calloc(1,0x10);
  *(undefined4 *)((int)pvVar1 + 0xc) = 0x1e240;
  return;
}





undefined4 __cdecl FUN_004b6250(int *param_1,uint *param_2,int *param_3)

{
  int iVar1;
  uint uVar2;
  int *piVar3;
  undefined4 *puVar4;
  int iVar5;
  uint local_8;
  int local_4;
  
  local_8 = FUN_004b6340((int)param_1,param_2);
  FUN_004b6570(param_1);
  iVar5 = param_1[2];
  local_4 = 0;
  if (local_8 < *param_2) {
    do {
      param_1[3] = 8;
      uVar2 = FUN_004b68f0(param_2,local_8);
      iVar1 = param_1[3];
      uVar2 = uVar2 & 0xff;
      while (iVar1 != 0) {
        param_1[3] = param_1[3] + -1;
        if (param_1[4] <= local_4) break;
        local_4 = local_4 + 1;
        piVar3 = (int *)FUN_004b6080((int *)param_1[8],iVar5);
        if ((uVar2 & 1) == 0) {
          iVar5 = *(int *)(*piVar3 + 8);
        }
        else {
          iVar5 = *(int *)(*piVar3 + 0xc);
        }
        puVar4 = (undefined4 *)FUN_004b6080((int *)param_1[8],iVar5);
        if (*(short *)*puVar4 != 0) {
          FUN_004b6890(param_3,(char)((short *)*puVar4)[1]);
          iVar5 = param_1[2];
        }
        uVar2 = (int)uVar2 >> 1;
        iVar1 = param_1[3];
      }
      local_8 = local_8 + 1;
    } while (local_8 < *param_2);
  }
  return 0;
}



undefined4 __cdecl FUN_004b6a10(int *param_1,undefined4 param_2)

{
  void *pvVar1;
  int iVar2;
  
  if (*param_1 == param_1[2]) {
    iVar2 = param_1[1] + param_1[2];
    pvVar1 = realloc((void *)param_1[3],iVar2 * 4);
    if (pvVar1 == (void *)0x0) {
      perror(s_Cannot_re-allocate_memory_for_St_00516ca4);
      return 0xffffffff;
    }
    param_1[3] = (int)pvVar1;
    param_1[2] = iVar2;
  }
  *(undefined4 *)(param_1[3] + *param_1 * 4) = param_2;
  *param_1 = *param_1 + 1;
  return 0;
}


uint * __cdecl FUN_004b67d0(uint *param_1,uint param_2,uint param_3)

{
  void *pvVar1;
  size_t _Size;
  
  if (param_1 == (uint *)0x0) {
    param_1 = (uint *)FUN_004b67b0();
  }
  if (param_1[4] != 0x1e240) {
    return (uint *)0x0;
  }
  _Size = (param_2 / param_3 + 1) * param_3;
  if ((void *)param_1[3] != (void *)0x0) {
    free((void *)param_1[3]);
  }
  pvVar1 = malloc(_Size);
  param_1[3] = (uint)pvVar1;
  if (pvVar1 == (void *)0x0) {
    perror(s_Cannot_allocate_memory_for_Stack_00516c80);
    return (uint *)0x0;
  }
  *param_1 = param_2;
  param_1[1] = param_3;
  param_1[2] = _Size;
  return param_1;
}


undefined4 __cdecl FUN_004b5d20(uint *param_1,uint *param_2,int *param_3)

{
  uint *puVar1;
  uint uVar2;
  undefined4 uVar3;
  uint uVar4;
  int iVar5;
  uint *puVar6;
  
  uVar2 = *(uint *)param_2[3];
  puVar6 = (uint *)param_2[3] + 1;
  uVar4 = 0;
  *param_1 = uVar2;
  if (uVar2 != 0) {
    do {
      uVar2 = *puVar6;
      puVar6 = puVar6 + 1;
      uVar4 = uVar4 + 1;
      FUN_004b6a10((int *)param_1[1],uVar2);
    } while (uVar4 < *param_1);
  }
  if ((uint)((int)((int)puVar6 - param_2[3]) >> 2) < *param_2) {
    do {
      uVar2 = param_1[3];
      uVar4 = *puVar6;
      if (uVar4 < *param_1 + uVar2) {
        iVar5 = 1;
        for (; uVar4 != 0; uVar4 = uVar4 - 1) {
          iVar5 = iVar5 * 2;
        }
        puVar1 = puVar6 + 1;
        puVar6 = puVar6 + 2;
        uVar3 = *(undefined4 *)(*(int *)(param_1[1] + 0xc) + (*puVar1 - uVar2) * 4);
        for (; iVar5 != 0; iVar5 = iVar5 + -1) {
          FUN_004b6890(param_3,(char)uVar3);
        }
      }
      else {
        puVar6 = puVar6 + 1;
        FUN_004b6890(param_3,(char)*(undefined4 *)
                                    (*(int *)(param_1[1] + 0xc) + ((uVar4 - *param_1) - uVar2) * 4))
        ;
      }
    } while ((uint)((int)((int)puVar6 - param_2[3]) >> 2) < *param_2);
  }
  return 0;
}


undefined4 __cdecl FUN_004b6890(int *param_1,undefined1 param_2)

{
  void *pvVar1;
  size_t _NewSize;
  
  if (*param_1 == param_1[2]) {
    _NewSize = param_1[1] + param_1[2];
    pvVar1 = realloc((void *)param_1[3],_NewSize);
    if (pvVar1 == (void *)0x0) {
      perror(s_Cannot_re-allocate_memory_for_St_00516ca4);
      return 0xffffffff;
    }
    param_1[3] = (int)pvVar1;
    param_1[2] = _NewSize;
  }
  *(undefined1 *)(param_1[3] + *param_1) = param_2;
  *param_1 = *param_1 + 1;
  return 0;
}


undefined4 __cdecl FUN_004b69d0(void *param_1)

{
  if (*(int *)((int)param_1 + 0x10) != 0x1e240) {
    return 0xffffffff;
  }
  if (*(void **)((int)param_1 + 0xc) != (void *)0x0) {
    free(*(void **)((int)param_1 + 0xc));
  }
  free(param_1);
  return 0;
}


void __cdecl FUN_004b7970(uint *param_1,int param_2,int *param_3)

{
  void *pvVar1;
  float fVar2;
  undefined1 uVar3;
  undefined3 extraout_var;
  undefined3 extraout_var_00;
  undefined3 extraout_var_01;
  uint *puVar4;
  uint *puVar5;
  int *piVar6;
  int *piVar7;
  uint *puVar8;
  int *piVar9;
  int *piVar10;
  int *piVar11;
  int *piVar12;
  int *piVar13;
  uint uVar14;
  float *pfVar15;
  uint uVar16;
  int *piVar17;
  uint uVar18;
  int iVar19;
  int iVar20;
  int iVar21;
  float10 fVar22;
  float fVar23;
  undefined4 uVar24;
  float fVar25;
  uint *puVar26;
  int *piVar27;
  int *piVar28;
  int local_a0;
  double local_98;
  int local_90;
  int local_6c;
  int local_68;
  uint local_64;
  uint *local_60;
  uint *local_5c;
  uint *local_58;
  int *local_54;
  int *local_50;
  double local_4c;
  float local_44;
  int *local_40;
  uint local_3c [11];
  double local_10;
  double local_8;
  
  local_90 = 0xc;
  local_a0 = 0xb;
  local_58 = (uint *)FUN_004baa70();
  local_54 = FUN_004b8a60();
  local_50 = FUN_004bab40();
  local_3c[2] = 4;
  local_3c[3] = 4;
  local_3c[0] = 8;
  local_3c[1] = 8;
  local_3c[4] = 4;
  local_3c[5] = 2;
  local_3c[6] = 2;
  local_3c[7] = 2;
  local_3c[8] = 1;
  local_3c[9] = 1;
  local_3c[10] = 1;
  *param_3 = param_2;
  uVar3 = FUN_004bc0f0(param_3);
  DAT_00516c78 = CONCAT31(extraout_var,uVar3);
  uVar3 = FUN_004bc0f0(param_3);
  iVar20 = CONCAT31(extraout_var_00,uVar3);
  uVar3 = FUN_004bc0f0(param_3);
  if (iVar20 == 3) {
    local_90 = 9;
    local_a0 = 8;
  }
  else if (iVar20 != 4) {
    perror(s_***ERROR:_this_version_allows_on_00516d68);
                    /* WARNING: Subroutine does not return */
    exit(1);
  }
  FUN_004b7720(CONCAT31(extraout_var_01,uVar3),&local_68,&local_6c);
  local_60 = (uint *)FUN_004bc270((int *)0x0,local_68,0);
  puVar4 = (uint *)FUN_004bc270((int *)0x0,local_6c,0);
  local_5c = (uint *)FUN_004bc270((int *)0x0,local_6c,-1);
  puVar5 = (uint *)FUN_004bc270((int *)0x0,local_68,1);
  FUN_004b7770(CONCAT31(extraout_var_01,uVar3),local_60,local_5c,puVar4,puVar5);
  piVar6 = FUN_004bc520((int *)0x0,iVar20);
  FUN_004bd0d0(param_1,piVar6);
  piVar7 = (int *)FUN_004bc610(piVar6,0);
  uVar18 = 0;
  puVar8 = (uint *)FUN_004bc4d0(piVar7,2);
  if (puVar8[1] != 0) {
    do {
      uVar14 = 0;
      if (*puVar8 != 0) {
        do {
          uVar16 = uVar14 + 1;
          FUN_004b83f0((int)puVar8,0,uVar14,uVar18,0);
          uVar14 = uVar16;
        } while (uVar16 < *puVar8);
      }
      uVar18 = uVar18 + 1;
    } while (uVar18 < puVar8[1]);
  }
  FUN_004b6ad0();
  piVar7 = malloc(local_90 << 2);
  piVar9 = (int *)FUN_004bc610(piVar6,0);
  piVar10 = (int *)FUN_004bc4d0(piVar9,0);
  piVar10 = FUN_004b8500((int *)0x0,(int)piVar10,0,0,*piVar10,piVar10[1],0);
  *piVar7 = (int)piVar10;
  piVar9 = (int *)FUN_004bc4d0(piVar9,1);
  piVar9 = FUN_004b8500((int *)0x0,(int)piVar9,0,0,*piVar9,piVar9[1],0);
  piVar7[1] = (int)piVar9;
  if (1 < iVar20) {
    piVar9 = piVar7 + 2;
    iVar21 = 1;
    do {
      iVar19 = iVar21 + 1;
      piVar10 = (int *)FUN_004bc610(piVar6,iVar21);
      piVar11 = (int *)FUN_004bc4d0(piVar10,0);
      piVar11 = FUN_004b8500((int *)0x0,(int)piVar11,0,0,*piVar11,piVar11[1],0);
      *piVar9 = (int)piVar11;
      piVar11 = (int *)FUN_004bc4d0(piVar10,1);
      piVar11 = FUN_004b8500((int *)0x0,(int)piVar11,0,0,*piVar11,piVar11[1],0);
      piVar9[1] = (int)piVar11;
      piVar10 = (int *)FUN_004bc4d0(piVar10,2);
      piVar10 = FUN_004b8500((int *)0x0,(int)piVar10,0,0,*piVar10,piVar10[1],0);
      piVar9[2] = (int)piVar10;
      piVar9 = piVar9 + 3;
      iVar21 = iVar19;
    } while (iVar19 < iVar20);
  }
  piVar9 = (int *)FUN_004bc610(piVar6,iVar20 + -1);
  piVar10 = (int *)FUN_004bc4d0(piVar9,3);
  piVar9 = piVar7 + local_a0;
  piVar10 = FUN_004b8500((int *)0x0,(int)piVar10,0,0,*piVar10,piVar10[1],0);
  *piVar9 = (int)piVar10;
  piVar10 = piVar7;
  iVar20 = local_90;
  while( true ) {
    if (iVar20 == 0) {
      piVar10 = FUN_004b8710((int *)0x0,local_a0,1,1);
      local_40 = FUN_004b8710((int *)0x0,local_a0,1,1);
      piVar11 = FUN_004b8130((int *)0x0,local_a0,1,1);
      piVar12 = FUN_004b8130((int *)0x0,local_a0,1,1);
      piVar13 = FUN_004b8710((int *)0x0,local_a0,1,1);
      local_64 = 0;
      if (param_1[5] != 0) {
        do {
          FUN_004bc190(*param_3);
          iVar20 = 0;
          if (local_a0 != 0) {
            do {
              iVar21 = iVar20 + 1;
              uVar18 = FUN_004bc220(1);
              FUN_004b89e0((int)piVar10,uVar18,iVar20);
              iVar20 = iVar21;
            } while (iVar21 < local_a0);
          }
          iVar20 = FUN_004bc1b0();
          *param_3 = iVar20;
          iVar20 = 0;
          if (local_a0 != 0) {
            do {
              iVar21 = iVar20;
              uVar18 = FUN_004bc100(param_3,2);
              FUN_004b89e0((int)piVar13,uVar18,iVar21);
              iVar21 = iVar20;
              uVar18 = FUN_004bc100(param_3,2);
              fVar22 = FUN_004bc0d0((short)uVar18);
              FUN_004b84b0((int)piVar12,(float)fVar22,iVar21);
              iVar21 = iVar20 + 1;
              uVar18 = FUN_004bc100(param_3,2);
              fVar22 = FUN_004bc0d0((short)uVar18);
              FUN_004b84b0((int)piVar11,(float)fVar22,iVar20);
              iVar20 = iVar21;
            } while (iVar21 < local_a0);
          }
          uVar18 = FUN_004bc100(param_3,2);
          uVar14 = FUN_004bc100(param_3,2);
          fVar2 = (float)(int)(uVar14 - uVar18);
          local_4c = (double)(int)(uVar14 - uVar18);
          local_8 = (double)(int)uVar18;
          local_44 = (fVar2 + (float)(int)uVar18) * 0.5;
          if (local_a0 != 0) {
            piVar17 = piVar7;
            puVar8 = local_3c;
            iVar20 = 0;
            do {
              puVar26 = local_58;
              piVar27 = local_54;
              piVar28 = local_50;
              fVar22 = FUN_004b8470((int)piVar11,iVar20);
              fVar25 = (float)fVar22;
              uVar24 = 0;
              iVar21 = FUN_004b89a0((int)piVar10,iVar20);
              fVar22 = FUN_004b8470((int)piVar12,iVar20);
              fVar23 = (float)fVar22;
              iVar19 = iVar20 + 1;
              uVar14 = FUN_004b89a0((int)piVar13,iVar20);
              FUN_004b72b0(*(int **)(*piVar17 + 4),param_3,*puVar8,uVar14,fVar23,iVar21,uVar24,
                           fVar25,puVar26,(int)piVar27,(int)piVar28);
              piVar17 = piVar17 + 1;
              puVar8 = puVar8 + 1;
              iVar20 = iVar19;
            } while (iVar19 < local_a0);
          }
          FUN_004bc130(param_3,*(uint **)(*piVar9 + 4));
          pfVar15 = (float *)FUN_004b8370(*(int *)(*piVar9 + 4),0,0,0);
          iVar21 = (*(int **)(*piVar9 + 4))[1] * **(int **)(*piVar9 + 4);
          piVar17 = piVar7;
          iVar20 = local_90;
          if (0 < iVar21) {
            local_10 = (double)(((float)(int)uVar18 - fVar2) * 0.5 * 0.007874016);
            do {
              local_98 = ((double)*pfVar15 - 127.0) * local_10 + (double)local_44;
              if (local_98 <= local_4c) {
                local_98 = local_4c;
              }
              else if (local_8 <= local_98) {
                local_98 = local_8;
              }
              iVar21 = iVar21 + -1;
              *pfVar15 = (float)local_98;
              pfVar15 = pfVar15 + 1;
            } while (iVar21 != 0);
          }
          for (; iVar20 != 0; iVar20 = iVar20 + -1) {
            FUN_004b8680((int *)*piVar17);
            piVar17 = piVar17 + 1;
          }
          local_64 = local_64 + 1;
        } while (local_64 < param_1[5]);
      }
      FUN_004b6ad0();
      FUN_004bd1e0((int)puVar4,(int)puVar5,piVar6,param_1);
      piVar9 = piVar7;
      for (; local_90 != 0; local_90 = local_90 + -1) {
        pvVar1 = (void *)*piVar9;
        piVar9 = piVar9 + 1;
        FUN_004b8650(pvVar1);
      }
      free(piVar7);
      FUN_004bc300(local_60);
      FUN_004bc300(puVar4);
      FUN_004bc300(local_5c);
      FUN_004bc300(puVar5);
      FUN_004bc5d0(piVar6);
      FUN_004b8270(piVar12);
      FUN_004b8850(piVar10);
      FUN_004b8850(local_40);
      FUN_004b8270(piVar11);
      FUN_004b8850(piVar13);
      FUN_004b8850(local_58);
      FUN_004b8850(local_54);
      FUN_004b8850(local_50);
      return;
    }
    if (*piVar10 == 0) break;
    piVar10 = piVar10 + 1;
    iVar20 = iVar20 + -1;
  }
  perror(s_***Error:_00516d18);
  perror(s_***ERROR:_out_of_memory***_00516d4c);
  perror(s_***_00516cf4);
                    /* WARNING: Subroutine does not return */
  exit(1);
}


int * FUN_004baa70(void)

{
  int *piVar1;
  int *piVar2;
  int iVar3;
  int iVar4;
  uint uVar5;
  uint uVar6;
  uint uVar7;
  uint uVar8;
  uint uVar9;
  uint uVar10;
  
  uVar6 = 1;
  piVar1 = FUN_004b8a60();
  piVar2 = FUN_004b8710((int *)0x0,9,0xc9,1);
  piVar2[7] = piVar2[1];
  piVar2[8] = 1;
  do {
    uVar7 = 1;
    do {
      uVar10 = 0;
      uVar5 = uVar7 + 1;
      uVar8 = uVar6;
      uVar9 = uVar7;
      iVar3 = FUN_004b88a0((int)piVar1,uVar6,uVar7,0);
      iVar4 = FUN_004b88a0((int)piVar1,uVar6,uVar7 - 1,0);
      FUN_004b8920((int)piVar2,iVar3 - iVar4,uVar8,uVar9,uVar10);
      uVar7 = uVar5;
    } while ((int)uVar5 < 0xc9);
    uVar6 = uVar6 + 1;
  } while ((int)uVar6 < 9);
  uVar6 = 0;
  do {
    uVar7 = uVar6 + 1;
    FUN_004b8920((int)piVar2,1,uVar6,0,0);
    uVar6 = uVar7;
  } while ((int)uVar7 < 9);
  uVar6 = 1;
  do {
    uVar7 = uVar6 + 1;
    FUN_004b8920((int)piVar2,0,0,uVar6,0);
    uVar6 = uVar7;
  } while ((int)uVar7 < 0xc9);
  FUN_004b8850(piVar1);
  return piVar2;
}


int * FUN_004b8a60(void)

{
  int *piVar1;
  uint uVar2;
  uint uVar3;
  undefined **local_b5c [483];
  char *local_3d0;
  undefined *local_3cc;
  undefined *local_3c8;
  undefined *local_3c4;
  undefined *local_3c0;
  undefined4 local_3bc;
  undefined4 local_3b8;
  undefined4 local_3b4;
  undefined4 local_3b0;
  undefined4 local_3ac;
  undefined4 local_3a8;
  undefined4 local_3a4;
  undefined4 local_3a0;
  undefined4 local_39c;
  undefined4 local_398;
  undefined4 local_394;
  undefined4 local_390;
  undefined4 local_38c;
  undefined4 local_388;
  undefined4 local_384;
  undefined4 local_380;
  undefined4 local_37c;
  undefined4 local_378;
  undefined4 local_374;
  undefined4 local_370;
  undefined4 local_36c;
  undefined4 local_368;
  undefined4 local_364;
  undefined4 local_360;
  undefined4 local_35c;
  undefined4 local_358;
  undefined4 local_354;
  undefined4 local_350;
  undefined4 local_34c;
  undefined4 local_348;
  undefined4 local_344;
  undefined4 local_340;
  undefined4 local_33c;
  undefined4 local_338;
  undefined4 local_334;
  undefined4 local_330;
  undefined4 local_32c;
  undefined4 local_328;
  undefined4 local_324;
  undefined **local_320 [200];
  
  local_b5c[0x7e] = (undefined **)0xd;
  local_b5c[0x7c] = (undefined **)0x1;
  local_b5c[0x7f] = (undefined **)0x19;
  local_b5c[0x80] = (undefined **)0x29;
  local_b5c[0x81] = (undefined **)0x3d;
  local_b5c[0x7d] = (undefined **)0x5;
  local_b5c[0x82] = (undefined **)0x55;
  local_b5c[0x83] = (undefined **)0x71;
  local_b5c[0x84] = (undefined **)0x91;
  local_b5c[0x85] = (undefined **)0xb5;
  local_b5c[0x86] = (undefined **)0xdd;
  local_b5c[0x87] = (undefined **)0x109;
  local_b5c[0x88] = (undefined **)0x139;
  local_b5c[0x89] = (undefined **)0x16d;
  local_b5c[0x8a] = (undefined **)0x1a5;
  local_b5c[0x8b] = (undefined **)0x1e1;
  local_b5c[0x8c] = (undefined **)0x221;
  local_b5c[0x8d] = (undefined **)0x265;
  local_b5c[0x8e] = (undefined **)0x2ad;
  local_b5c[0x8f] = (undefined **)0x2f9;
  local_b5c[0x90] = (undefined **)0x349;
  local_b5c[0x91] = (undefined **)0x39d;
  local_b5c[0x92] = (undefined **)0x3f5;
  local_b5c[0x93] = (undefined **)0x451;
  local_b5c[0x94] = (undefined **)0x4b1;
  local_b5c[0x95] = (undefined **)0x515;
  local_b5c[0x96] = (undefined **)0x57d;
  local_b5c[0x97] = (undefined **)0x5e9;
  local_b5c[0x98] = (undefined **)0x659;
  local_b5c[0x99] = (undefined **)0x6cd;
  local_b5c[0x9a] = (undefined **)0x745;
  local_b5c[0x9b] = (undefined **)0x7c1;
  local_b5c[0x9c] = (undefined **)0x841;
  local_b5c[0x9d] = (undefined **)0x8c5;
  local_b5c[0x9e] = (undefined **)0x94d;
  local_b5c[0x9f] = (undefined **)0x9d9;
  local_b5c[0xa0] = (undefined **)0xa69;
  local_b5c[0xa1] = (undefined **)0xafd;
  local_b5c[0xa2] = (undefined **)0xb95;
  local_b5c[0xa3] = (undefined **)0xc31;
  local_b5c[0xa4] = (undefined **)0xcd1;
  local_b5c[0xa5] = (undefined **)0xd75;
  local_b5c[0xa6] = (undefined **)0xe1d;
  local_b5c[0xa7] = (undefined **)0xec9;
  local_b5c[0xa8] = (undefined **)0xf79;
  local_b5c[0xa9] = (undefined **)0x102d;
  local_b5c[0xaa] = (undefined **)0x10e5;
  local_b5c[0xab] = (undefined **)0x11a1;
  local_b5c[0xac] = (undefined **)0x1261;
  local_b5c[0xad] = (undefined **)0x1325;
  local_b5c[0xae] = (undefined **)0x13ed;
  local_b5c[0xaf] = (undefined **)0x14b9;
  local_b5c[0xb0] = (undefined **)0x1589;
  local_b5c[0xb1] = (undefined **)0x165d;
  local_b5c[0xb2] = (undefined **)0x1735;
  local_b5c[0xb3] = (undefined **)0x1811;
  local_b5c[0xb4] = (undefined **)0x18f1;
  local_b5c[0xb5] = (undefined **)0x19d5;
  local_b5c[0xb6] = (undefined **)0x1abd;
  local_b5c[0xb7] = (undefined **)0x1ba9;
  local_b5c[0xb8] = (undefined **)0x1c99;
  local_b5c[0xb9] = (undefined **)0x1d8d;
  local_b5c[0xba] = (undefined **)0x1e85;
  local_b5c[0xbb] = (undefined **)0x1f81;
  local_b5c[0xbc] = (undefined **)0x2081;
  local_b5c[0xbd] = (undefined **)0x2185;
  local_b5c[0xbe] = (undefined **)0x228d;
  local_b5c[0xbf] = (undefined **)0x2399;
  local_b5c[0xc0] = (undefined **)0x24a9;
  local_b5c[0xc1] = (undefined **)0x25bd;
  local_b5c[0xc2] = (undefined **)0x26d5;
  local_b5c[0xc3] = (undefined **)0x27f1;
  local_b5c[0xc4] = (undefined **)0x2911;
  local_b5c[0xc5] = (undefined **)0x2a35;
  local_b5c[0xc6] = (undefined **)0x2b5d;
  local_b5c[199] = (undefined **)0x2c89;
  local_b5c[200] = (undefined **)0x2db9;
  local_b5c[0xc9] = (undefined **)0x2eed;
  local_b5c[0xca] = (undefined **)0x3025;
  local_b5c[0xcb] = (undefined **)0x3161;
  local_b5c[0xcc] = (undefined **)0x32a1;
  local_b5c[0xcd] = (undefined **)0x33e5;
  local_b5c[0xce] = (undefined **)0x352d;
  local_b5c[0xcf] = (undefined **)0x3679;
  local_b5c[0xd0] = (undefined **)0x37c9;
  local_b5c[0xd1] = (undefined **)0x391d;
  local_b5c[0xd2] = (undefined **)0x3a75;
  local_b5c[0xd3] = (undefined **)0x3bd1;
  local_b5c[0xd4] = (undefined **)0x3d31;
  local_b5c[0xd5] = (undefined **)0x3e95;
  local_b5c[0xd6] = (undefined **)0x3ffd;
  local_b5c[0xd7] = (undefined **)0x4169;
  local_b5c[0xd8] = (undefined **)0x42d9;
  local_b5c[0xd9] = (undefined **)0x444d;
  local_b5c[0xda] = (undefined **)0x45c5;
  local_b5c[0xdb] = (undefined **)0x4741;
  local_b5c[0xdc] = (undefined **)0x48c1;
  local_b5c[0xdd] = (undefined **)0x4a45;
  local_b5c[0xde] = (undefined **)0x4bcd;
  local_b5c[0xdf] = (undefined **)0x4d59;
  local_b5c[0xe0] = (undefined **)0x4ee9;
  local_b5c[0xe1] = (undefined **)0x507d;
  local_b5c[0xe2] = (undefined **)0x5215;
  local_b5c[0xe3] = (undefined **)0x53b1;
  local_b5c[0xe4] = (undefined **)0x5551;
  local_b5c[0xe5] = (undefined **)0x56f5;
  local_b5c[0xe6] = (undefined **)0x589d;
  local_b5c[0xe7] = (undefined **)0x5a49;
  local_b5c[0xe8] = (undefined **)0x5bf9;
  local_b5c[0xe9] = (undefined **)0x5dad;
  local_b5c[0xea] = (undefined **)0x5f65;
  local_b5c[0xeb] = (undefined **)0x6121;
  local_b5c[0xec] = (undefined **)0x62e1;
  local_b5c[0xed] = (undefined **)0x64a5;
  local_b5c[0xee] = (undefined **)0x666d;
  local_b5c[0xef] = (undefined **)0x6839;
  local_b5c[0xf0] = (undefined **)0x6a09;
  local_b5c[0xf1] = (undefined **)0x6bdd;
  local_b5c[0xf2] = (undefined **)0x6db5;
  local_b5c[0xf3] = (undefined **)0x6f91;
  local_b5c[0xf4] = (undefined **)0x7171;
  local_b5c[0xf5] = (undefined **)0x7355;
  local_b5c[0xf6] = (undefined **)0x753d;
  local_b5c[0xf7] = (undefined **)0x7729;
  local_b5c[0xf8] = (undefined **)0x7919;
  local_b5c[0xf9] = (undefined **)0x7b0d;
  local_b5c[0xfa] = (undefined **)0x7d05;
  local_b5c[0xfb] = (undefined **)0x7f01;
  local_b5c[0xfc] = (undefined **)0x8101;
  local_b5c[0xfd] = (undefined **)0x8305;
  local_b5c[0xfe] = (undefined **)0x850d;
  local_b5c[0xff] = (undefined **)0x8719;
  local_b5c[0x100] = (undefined **)0x8929;
  local_b5c[0x101] = (undefined **)0x8b3d;
  local_b5c[0x102] = (undefined **)0x8d55;
  local_b5c[0x103] = (undefined **)0x8f71;
  local_b5c[0x104] = (undefined **)0x9191;
  local_b5c[0x105] = (undefined **)0x93b5;
  local_b5c[0x106] = (undefined **)0x95dd;
  local_b5c[0x107] = (undefined **)0x9809;
  local_b5c[0x108] = (undefined **)0x9a39;
  local_b5c[0x109] = (undefined **)0x9c6d;
  local_b5c[0x10a] = (undefined **)0x9ea5;
  local_b5c[0x10b] = (undefined **)0xa0e1;
  local_b5c[0x10c] = (undefined **)0xa321;
  local_b5c[0x10d] = (undefined **)0xa565;
  local_b5c[0x10e] = (undefined **)0xa7ad;
  local_b5c[0x10f] = (undefined **)0xa9f9;
  local_b5c[0x110] = (undefined **)0xac49;
  local_b5c[0x111] = (undefined **)0xae9d;
  local_b5c[0x112] = (undefined **)0xb0f5;
  local_b5c[0x113] = (undefined **)0xb351;
  local_b5c[0x114] = (undefined **)0xb5b1;
  local_b5c[0x115] = (undefined **)0xb815;
  local_b5c[0x116] = (undefined **)0xba7d;
  local_b5c[0x117] = (undefined **)0xbce9;
  local_b5c[0x118] = (undefined **)0xbf59;
  local_b5c[0x119] = (undefined **)0xc1cd;
  local_b5c[0x11a] = (undefined **)0xc445;
  local_b5c[0x11b] = (undefined **)0xc6c1;
  local_b5c[0x11c] = (undefined **)0xc941;
  local_b5c[0x11d] = (undefined **)0xcbc5;
  local_b5c[0x11e] = (undefined **)0xce4d;
  local_b5c[0x11f] = (undefined **)0xd0d9;
  local_b5c[0x120] = (undefined **)0xd369;
  local_b5c[0x121] = (undefined **)0xd5fd;
  local_b5c[0x122] = (undefined **)0xd895;
  local_b5c[0x123] = (undefined **)0xdb31;
  local_b5c[0x124] = (undefined **)0xddd1;
  local_b5c[0x125] = (undefined **)0xe075;
  local_b5c[0x126] = (undefined **)0xe31d;
  local_b5c[0x127] = (undefined **)0xe5c9;
  local_b5c[0x128] = (undefined **)0xe879;
  local_b5c[0x129] = (undefined **)0xeb2d;
  local_b5c[0x12a] = (undefined **)0xede5;
  local_b5c[299] = (undefined **)0xf0a1;
  local_b5c[300] = (undefined **)0xf361;
  local_b5c[0x12d] = (undefined **)0xf625;
  local_b5c[0x12e] = (undefined **)0xf8ed;
  local_b5c[0x12f] = (undefined **)0xfbb9;
  local_b5c[0x130] = (undefined **)0xfe89;
  local_b5c[0x131] = (undefined **)0x1015d;
  local_b5c[0x132] = (undefined **)0x10435;
  local_b5c[0x133] = (undefined **)0x10711;
  local_b5c[0x134] = (undefined **)0x109f1;
  local_b5c[0x135] = (undefined **)0x10cd5;
  local_b5c[0x136] = (undefined **)0x10fbd;
  local_b5c[0x137] = (undefined **)0x112a9;
  local_b5c[0x138] = (undefined **)0x11599;
  local_b5c[0x139] = (undefined **)0x1188d;
  local_b5c[0x13a] = (undefined **)0x11b85;
  local_b5c[0x13b] = (undefined **)0x11e81;
  local_b5c[0x13c] = (undefined **)0x12181;
  local_b5c[0x13d] = (undefined **)0x12485;
  local_b5c[0x13e] = (undefined **)0x1278d;
  local_b5c[0x13f] = (undefined **)0x12a99;
  local_b5c[0x140] = (undefined **)0x12da9;
  local_b5c[0x145] = (undefined **)0x1;
  local_b5c[0x141] = (undefined **)0x130bd;
  local_b5c[0x142] = (undefined **)0x133d5;
  local_b5c[0x143] = (undefined **)0x136f1;
  local_b5c[0x144] = (undefined **)0x0;
  local_b5c[0x147] = (undefined **)0x19;
  local_b5c[0x146] = (undefined **)0x7;
  local_b5c[0x148] = (undefined **)0x3f;
  local_b5c[0x14a] = (undefined **)0xe7;
  local_b5c[0x14b] = (undefined **)0x179;
  local_b5c[0x14c] = (undefined **)0x23f;
  local_b5c[0x14d] = (undefined **)0x341;
  local_b5c[0x14e] = (undefined **)0x487;
  local_b5c[0x14f] = (undefined **)0x619;
  local_b5c[0x150] = (undefined **)0x7ff;
  local_b5c[0x151] = (undefined **)0xa41;
  local_b5c[0x152] = (undefined **)0xce7;
  local_b5c[0x153] = (undefined **)0xff9;
  local_b5c[0x154] = (undefined **)0x137f;
  local_b5c[0x155] = (undefined **)0x1781;
  local_b5c[0x156] = (undefined **)0x1c07;
  local_b5c[0x157] = (undefined **)0x2119;
  local_b5c[0x158] = (undefined **)0x26bf;
  local_b5c[0x159] = (undefined **)0x2d01;
  local_b5c[0x15a] = (undefined **)0x33e7;
  local_b5c[0x15b] = (undefined **)0x3b79;
  local_b5c[0x15c] = (undefined **)0x43bf;
  local_b5c[0x15d] = (undefined **)0x4cc1;
  local_b5c[0x15e] = (undefined **)0x5687;
  local_b5c[0x15f] = (undefined **)0x6119;
  local_b5c[0x160] = (undefined **)0x6c7f;
  local_b5c[0x161] = (undefined **)0x78c1;
  local_b5c[0x162] = (undefined **)0x85e7;
  local_b5c[0x163] = (undefined **)0x93f9;
  local_b5c[0x149] = (undefined **)0x81;
  local_b5c[0x164] = (undefined **)0xa2ff;
  local_b5c[0x165] = (undefined **)0xb301;
  local_b5c[0x166] = (undefined **)0xc407;
  local_b5c[0x167] = (undefined **)0xd619;
  local_b5c[0x168] = (undefined **)0xe93f;
  local_b5c[0x169] = (undefined **)0xfd81;
  local_b5c[0x16a] = (undefined **)0x112e7;
  local_b5c[0x16b] = (undefined **)0x12979;
  local_b5c[0x16c] = (undefined **)0x1413f;
  local_b5c[0x16d] = (undefined **)0x15a41;
  local_b5c[0x16e] = (undefined **)0x17487;
  local_b5c[0x16f] = (undefined **)0x19019;
  local_b5c[0x170] = (undefined **)0x1acff;
  local_b5c[0x171] = (undefined **)0x1cb41;
  local_b5c[0x172] = (undefined **)0x1eae7;
  local_b5c[0x173] = (undefined **)0x20bf9;
  local_b5c[0x174] = (undefined **)0x22e7f;
  local_b5c[0x175] = (undefined **)0x25281;
  local_b5c[0x176] = (undefined **)0x27807;
  local_b5c[0x177] = (undefined **)0x29f19;
  local_b5c[0x178] = (undefined **)0x2c7bf;
  local_b5c[0x179] = (undefined **)0x2f201;
  local_b5c[0x17a] = (undefined **)0x31de7;
  local_b5c[0x17b] = (undefined **)0x34b79;
  local_b5c[0x17c] = (undefined **)0x37abf;
  local_b5c[0x17d] = (undefined **)0x3abc1;
  local_b5c[0x17e] = (undefined **)0x3de87;
  local_b5c[0x17f] = (undefined **)0x41319;
  local_b5c[0x180] = (undefined **)0x4497f;
  local_b5c[0x181] = (undefined **)0x481c1;
  local_b5c[0x182] = (undefined **)0x4bbe7;
  local_b5c[0x183] = (undefined **)0x4f7f9;
  local_b5c[0x184] = (undefined **)0x535ff;
  local_b5c[0x185] = (undefined **)0x57601;
  local_b5c[0x186] = (undefined **)0x5b807;
  local_b5c[0x187] = (undefined **)0x5fc19;
  local_b5c[0x188] = (undefined **)0x6423f;
  local_b5c[0x189] = (undefined **)0x68a81;
  local_b5c[0x18a] = (undefined **)0x6d4e7;
  local_b5c[0x18b] = (undefined **)0x72179;
  local_b5c[0x18c] = (undefined **)0x7703f;
  local_b5c[0x18d] = (undefined **)0x7c141;
  local_b5c[0x18e] = (undefined **)0x81487;
  local_b5c[399] = (undefined **)0x86a19;
  local_b5c[400] = (undefined **)0x8c1ff;
  local_b5c[0x191] = (undefined **)0x91c41;
  local_b5c[0x192] = (undefined **)0x978e7;
  local_b5c[0x193] = (undefined **)0x9d7f9;
  local_b5c[0x194] = (undefined **)0xa397f;
  local_b5c[0x195] = (undefined **)0xa9d81;
  local_b5c[0x196] = (undefined **)0xb0407;
  local_b5c[0x197] = (undefined **)0xb6d19;
  local_b5c[0x198] = (undefined **)0xbd8bf;
  local_b5c[0x199] = (undefined **)0xc4701;
  local_b5c[0x19a] = (undefined **)0xcb7e7;
  local_b5c[0x19b] = (undefined **)0xd2b79;
  local_b5c[0x19c] = (undefined **)0xda1bf;
  local_b5c[0x19d] = (undefined **)0xe1ac1;
  local_b5c[0x19e] = (undefined **)0xe9687;
  local_b5c[0x19f] = (undefined **)0xf1519;
  local_b5c[0x1a0] = (undefined **)0xf967f;
  local_b5c[0x1a1] = (undefined **)0x101ac1;
  local_b5c[0x1a2] = (undefined **)0x10a1e7;
  local_b5c[0x1a3] = (undefined **)0x112bf9;
  local_b5c[0x1a4] = (undefined **)0x11b8ff;
  local_b5c[0x1a5] = (undefined **)0x124901;
  local_b5c[0x1a6] = (undefined **)0x12dc07;
  local_b5c[0x1a7] = (undefined **)0x137219;
  local_b5c[0x1a8] = (undefined **)0x140b3f;
  local_b5c[0x1a9] = (undefined **)0x14a781;
  local_b5c[0x1aa] = (undefined **)0x1546e7;
  local_b5c[0x1ab] = (undefined **)0x15e979;
  local_b5c[0x1ac] = (undefined **)0x168f3f;
  local_b5c[0x1ad] = (undefined **)0x173841;
  local_b5c[0x1ae] = (undefined **)0x17e487;
  local_b5c[0x1af] = (undefined **)0x189419;
  local_b5c[0x1b0] = (undefined **)0x1946ff;
  local_b5c[0x1b1] = (undefined **)0x19fd41;
  local_b5c[0x1b2] = (undefined **)0x1ab6e7;
  local_b5c[0x1b3] = (undefined **)0x1b73f9;
  local_b5c[0x1b4] = (undefined **)0x1c347f;
  local_b5c[0x1b5] = (undefined **)0x1cf881;
  local_b5c[0x1b6] = (undefined **)0x1dc007;
  local_b5c[0x1b7] = (undefined **)0x1e8b19;
  local_b5c[0x1b8] = (undefined **)0x1f59bf;
  local_b5c[0x1b9] = (undefined **)0x202c01;
  local_b5c[0x1ba] = (undefined **)0x2101e7;
  local_b5c[0x1bb] = (undefined **)0x21db79;
  local_b5c[0x1bc] = (undefined **)0x22b8bf;
  local_b5c[0x1bd] = (undefined **)0x2399c1;
  local_b5c[0x1be] = (undefined **)0x247e87;
  local_b5c[0x1bf] = (undefined **)0x256719;
  local_b5c[0x1c0] = (undefined **)0x26537f;
  local_b5c[0x1c1] = (undefined **)0x2743c1;
  local_b5c[0x1c2] = (undefined **)0x2837e7;
  local_b5c[0x1c3] = (undefined **)0x292ff9;
  local_b5c[0x1c4] = (undefined **)0x2a2bff;
  local_b5c[0x1c5] = (undefined **)0x2b2c01;
  local_b5c[0x1c6] = (undefined **)0x2c3007;
  local_b5c[0x1c7] = (undefined **)0x2d3819;
  local_b5c[0x1c8] = (undefined **)0x2e443f;
  local_b5c[0x1c9] = (undefined **)0x2f5481;
  local_b5c[0x1ca] = (undefined **)0x3068e7;
  local_b5c[0x1cb] = (undefined **)0x318179;
  local_b5c[0x1cc] = (undefined **)0x329e3f;
  local_b5c[0x1cd] = (undefined **)0x33bf41;
  local_b5c[0x1ce] = (undefined **)0x34e487;
  local_b5c[0x1cf] = (undefined **)0x360e19;
  local_b5c[0x1d0] = (undefined **)0x373bff;
  local_b5c[0x1d1] = (undefined **)0x386e41;
  local_b5c[0x1d2] = (undefined **)0x39a4e7;
  local_b5c[0x1d3] = (undefined **)0x3adff9;
  local_b5c[0x1d4] = (undefined **)0x3c1f7f;
  local_b5c[0x1d5] = (undefined **)0x3d6381;
  local_b5c[0x1d6] = (undefined **)0x3eac07;
  local_b5c[0x1d7] = (undefined **)0x3ff919;
  local_b5c[0x1d8] = (undefined **)0x414abf;
  local_b5c[0x1d9] = (undefined **)&LAB_0042a101;
  local_b5c[0x1da] = (undefined **)0x43fbe7;
  local_b5c[0x1db] = (undefined **)&LAB_00455b79;
  local_b5c[0x1dc] = (undefined **)&DAT_0046bfbf;
  local_b5c[0x1dd] = (undefined **)0x4828c1;
  local_b5c[0x1de] = (undefined **)&LAB_00499687;
  local_b5c[0x1df] = (undefined **)&LAB_004b0919;
  local_b5c[0x1e0] = (undefined **)&DAT_004c807f;
  local_b5c[0x1e1] = (undefined **)&DAT_004dfcc1;
  local_b5c[0x1e2] = (undefined **)&DAT_004f7de7;
  local_3d0 = s_#(@)_$Header:_P:/bmw95/src/tis95_005103d8 + 0x21;
  local_3cc = &DAT_00528eff;
  local_3c8 = &DAT_00541f01;
  local_3c4 = &DAT_0055b407;
  local_3c0 = &DAT_00574e19;
  local_3bc = 0x58ed3f;
  local_3b8 = 0x5a9181;
  local_3b4 = 0x5c3ae7;
  local_3b0 = 0x5de979;
  local_3ac = 0x5f9d3f;
  local_3a8 = 0x615641;
  local_3a4 = 0x631487;
  local_3a0 = 0x64d819;
  local_39c = 0x66a0ff;
  local_398 = 0x686f41;
  local_394 = 0x6a42e7;
  local_390 = 0x6c1bf9;
  local_38c = 0x6dfa7f;
  local_388 = 0x6fde81;
  local_384 = 0x71c807;
  local_380 = 0x73b719;
  local_37c = 0x75abbf;
  local_378 = 0x77a601;
  local_374 = 0x79a5e7;
  local_370 = 0x7bab79;
  local_36c = 0x7db6bf;
  local_368 = 0x7fc7c1;
  local_364 = 0x81de87;
  local_360 = 0x83fb19;
  local_35c = 0x861d7f;
  local_358 = 0x8845c1;
  local_354 = 0x8a73e7;
  local_350 = 0x8ca7f9;
  local_34c = 0x8ee1ff;
  local_348 = 0x912201;
  local_344 = 0x936807;
  local_340 = 0x95b419;
  local_33c = 0x98063f;
  local_338 = 0x9a5e81;
  local_334 = 0x9cbce7;
  local_324 = 1;
  local_320[1] = (undefined **)0x29;
  local_330 = 0x9f2179;
  local_320[2] = (undefined **)0x81;
  local_320[4] = (undefined **)0x2a9;
  local_32c = 0xa18c3f;
  local_328 = 0;
  local_320[5] = (undefined **)0x509;
  local_320[0] = (undefined **)0x9;
  local_320[3] = (undefined **)0x141;
  local_320[6] = (undefined **)0x8c1;
  local_320[7] = (undefined **)0xe41;
  local_320[8] = (undefined **)0x1609;
  local_320[9] = (undefined **)0x20a9;
  local_320[10] = (undefined **)0x2ec1;
  local_320[0xb] = (undefined **)0x4101;
  local_320[0xc] = (undefined **)0x5829;
  local_320[0xd] = (undefined **)0x7509;
  local_320[0xe] = (undefined **)0x9881;
  local_320[0xf] = (undefined **)0xc381;
  local_320[0x10] = (undefined **)0xf709;
  local_320[0x11] = (undefined **)0x13429;
  local_320[0x12] = (undefined **)0x17c01;
  local_320[0x13] = (undefined **)0x1cfc1;
  local_320[0x14] = (undefined **)0x230a9;
  local_320[0x15] = (undefined **)0x2a009;
  local_320[0x16] = (undefined **)0x31f41;
  local_320[0x17] = (undefined **)0x3afc1;
  local_320[0x18] = (undefined **)0x45309;
  local_320[0x19] = (undefined **)0x50aa9;
  local_320[0x1a] = (undefined **)0x5d841;
  local_320[0x1b] = (undefined **)0x6bd81;
  local_320[0x1c] = (undefined **)0x7bc29;
  local_320[0x1d] = (undefined **)0x8d609;
  local_320[0x1e] = (undefined **)0xa0d01;
  local_320[0x1f] = (undefined **)0xb6301;
  local_320[0x20] = (undefined **)0xcda09;
  local_320[0x21] = (undefined **)0xe7429;
  local_320[0x22] = (undefined **)0x103381;
  local_320[0x23] = (undefined **)0x121a41;
  local_320[0x24] = (undefined **)0x142aa9;
  local_320[0x25] = (undefined **)0x166709;
  local_320[0x26] = (undefined **)0x18d1c1;
  local_320[0x27] = (undefined **)0x1b6d41;
  local_320[0x28] = (undefined **)0x1e3c09;
  local_320[0x29] = (undefined **)0x2140a9;
  local_320[0x2a] = (undefined **)0x247dc1;
  local_320[0x2b] = (undefined **)0x27f601;
  local_320[0x2c] = (undefined **)0x2bac29;
  local_320[0x2d] = (undefined **)0x2fa309;
  local_320[0x2e] = (undefined **)0x33dd81;
  local_320[0x2f] = (undefined **)0x385e81;
  local_320[0x30] = (undefined **)0x3d2909;
  local_320[0x31] = (undefined **)0x424029;
  local_320[0x32] = (undefined **)0x47a701;
  local_320[0x33] = (undefined **)&DAT_004d60c1;
  local_320[0x34] = (undefined **)&DAT_005370a9;
  local_320[0x35] = (undefined **)&DAT_0059da09;
  local_320[0x36] = (undefined **)0x60a041;
  local_320[0x37] = (undefined **)0x67c6c1;
  local_320[0x38] = (undefined **)0x6f5109;
  local_320[0x39] = (undefined **)0x7742a9;
  local_320[0x3a] = (undefined **)0x7f9f41;
  local_320[0x3b] = (undefined **)0x886a81;
  local_320[0x3c] = (undefined **)0x91a829;
  local_320[0x3d] = (undefined **)0x9b5c09;
  local_320[0x3e] = (undefined **)0xa58a01;
  local_320[0x3f] = (undefined **)0xb03601;
  local_320[0x40] = (undefined **)0xbb6409;
  local_320[0x41] = (undefined **)0xc71829;
  local_320[0x42] = (undefined **)0xd35681;
  local_320[0x43] = (undefined **)0xe02341;
  local_320[0x44] = (undefined **)0xed82a9;
  local_320[0x45] = (undefined **)0xfb7909;
  local_320[0x46] = (undefined **)0x10a0ac1;
  local_320[0x47] = (undefined **)0x1193c41;
  local_320[0x48] = (undefined **)0x1291209;
  local_320[0x49] = (undefined **)0x13990a9;
  local_320[0x4a] = (undefined **)0x14abcc1;
  local_320[0x4b] = (undefined **)0x15c9b01;
  local_320[0x4c] = (undefined **)0x16f3029;
  local_320[0x4d] = (undefined **)0x1828109;
  local_320[0x4e] = (undefined **)0x1969281;
  local_320[0x4f] = (undefined **)0x1ab6981;
  local_320[0x50] = (undefined **)0x1c10b09;
  local_320[0x51] = (undefined **)0x1d77c29;
  local_320[0x52] = (undefined **)0x1eec201;
  local_320[0x53] = (undefined **)0x206e1c1;
  local_320[0x54] = (undefined **)0x21fe0a9;
  local_320[0x55] = (undefined **)0x239c409;
  local_320[0x56] = (undefined **)0x2549141;
  local_320[0x57] = (undefined **)0x2704dc1;
  local_320[0x58] = (undefined **)0x28cff09;
  local_320[0x59] = (undefined **)0x2aaaaa9;
  local_320[0x5a] = (undefined **)0x2c95641;
  local_320[0x5b] = (undefined **)0x2e90781;
  local_320[0x5c] = (undefined **)0x309c429;
  local_320[0x5d] = (undefined **)0x32b9209;
  local_320[0x5e] = (undefined **)0x34e7701;
  local_320[0x5f] = (undefined **)0x3727901;
  local_320[0x60] = (undefined **)0x3979e09;
  local_320[0x61] = (undefined **)0x3bdec29;
  local_320[0x62] = (undefined **)0x3e56981;
  local_320[99] = (undefined **)0x40e1c41;
  local_320[100] = (undefined **)0x4380aa9;
  local_320[0x65] = (undefined **)0x4633b09;
  local_320[0x66] = (undefined **)0x48fb3c1;
  local_320[0x67] = (undefined **)0x4bd7b41;
  local_320[0x68] = (undefined **)0x4ec9809;
  local_320[0x69] = (undefined **)0x51d10a9;
  local_320[0x6a] = (undefined **)0x54eebc1;
  local_320[0x6b] = (undefined **)0x5823001;
  local_320[0x6c] = (undefined **)0x5b6e429;
  local_320[0x6d] = (undefined **)0x5ed0f09;
  local_320[0x6e] = (undefined **)0x624b781;
  local_320[0x6f] = (undefined **)0x65de481;
  local_320[0x70] = (undefined **)0x6989d09;
  local_320[0x71] = (undefined **)0x6d4e829;
  local_320[0x72] = (undefined **)0x712cd01;
  local_320[0x73] = (undefined **)0x75252c1;
  local_320[0x74] = (undefined **)0x79380a9;
  local_320[0x75] = (undefined **)0x7d65e09;
  local_320[0x76] = (undefined **)0x81af241;
  local_320[0x77] = (undefined **)0x86144c1;
  local_320[0x78] = (undefined **)0x8a95d09;
  local_320[0x79] = (undefined **)0x8f342a9;
  local_320[0x7a] = (undefined **)0x93efd41;
  local_320[0x7b] = (undefined **)0x98c9481;
  local_320[0x7c] = (undefined **)0x9dc1029;
  local_320[0x7d] = (undefined **)0xa2d7809;
  local_320[0x7e] = (undefined **)0xa80d401;
  local_320[0x7f] = (undefined **)0xad62c01;
  local_320[0x80] = (undefined **)0xb2d8809;
  local_320[0x81] = (undefined **)0xb86f029;
  local_320[0x82] = (undefined **)0xbe26c81;
  local_320[0x83] = (undefined **)0xc400541;
  local_320[0x84] = (undefined **)0xc9fc2a9;
  local_320[0x85] = (undefined **)0xd01ad09;
  local_320[0x86] = (undefined **)0xd65ccc1;
  local_320[0x87] = (undefined **)0xdcc2a41;
  local_320[0x88] = (undefined **)0xe34ce09;
  local_320[0x89] = (undefined **)0xe9fc0a9;
  local_320[0x8a] = (undefined **)0xf0d0ac1;
  local_320[0x8b] = (undefined **)0xf7cb501;
  local_320[0x8c] = (undefined **)0xfeec829;
  local_320[0x8d] = (undefined **)0x10634d09;
  local_320[0x8e] = (undefined **)0x10da4c81;
  local_320[0x8f] = (undefined **)0x1153cf81;
  local_320[0x90] = (undefined **)0x11cfdf09;
  local_320[0x91] = (undefined **)0x124e8429;
  local_320[0x92] = (undefined **)0x12cfc801;
  local_320[0x93] = (undefined **)0x1353b3c1;
  local_320[0x94] = (undefined **)0x13da50a9;
  local_320[0x95] = (undefined **)0x1463a809;
  local_320[0x96] = (undefined **)0x14efc341;
  local_320[0x97] = (undefined **)0x157eabc1;
  local_320[0x98] = (undefined **)0x16106b09;
  local_320[0x99] = (undefined **)0x16a50aa9;
  local_320[0x9a] = (undefined **)0x173c9441;
  local_320[0x9b] = (undefined **)0x17d71181;
  local_320[0x9c] = (undefined **)0x18748c29;
  local_320[0x9d] = (undefined **)0x19150e09;
  local_320[0x9e] = (undefined **)0x19b8a101;
  local_320[0x9f] = (undefined **)0x1a5f4f01;
  local_320[0xa0] = (undefined **)0x1b092209;
  local_320[0xa1] = (undefined **)0x1bb62429;
  local_320[0xa2] = (undefined **)0x1c665f81;
  local_320[0xa3] = (undefined **)0x1d19de41;
  local_320[0xa4] = (undefined **)0x1dd0aaa9;
  local_320[0xa5] = (undefined **)0x1e8acf09;
  local_320[0xa6] = (undefined **)0x1f4855c1;
  local_320[0xa7] = (undefined **)0x20094941;
  local_320[0xa8] = (undefined **)0x20cdb409;
  local_320[0xa9] = (undefined **)0x2195a0a9;
  local_320[0xaa] = (undefined **)0x226119c1;
  local_320[0xab] = (undefined **)0x23302a01;
  local_320[0xac] = (undefined **)0x2402dc29;
  local_320[0xad] = (undefined **)0x24d93b09;
  local_320[0xae] = (undefined **)0x25b35181;
  local_320[0xaf] = (undefined **)0x26912a81;
  local_320[0xb0] = (undefined **)0x2772d109;
  local_320[0xb1] = (undefined **)0x28585029;
  local_320[0xb2] = (undefined **)0x2941b301;
  local_320[0xb3] = (undefined **)0x2a2f04c1;
  local_320[0xb4] = (undefined **)0x2b2050a9;
  local_320[0xb5] = (undefined **)0x2c15a209;
  local_320[0xb6] = (undefined **)0x2d0f0441;
  local_320[0xb7] = (undefined **)0x2e0c82c1;
  local_320[0xb8] = (undefined **)0x2f0e2909;
  local_320[0xb9] = (undefined **)0x301402a9;
  local_320[0xba] = (undefined **)0x311e1b41;
  local_320[0xbb] = (undefined **)0x322c7e81;
  local_320[0xbc] = (undefined **)0x333f3829;
  local_320[0xbd] = (undefined **)0x34565409;
  local_320[0xbe] = (undefined **)0x3571de01;
  local_320[0xbf] = (undefined **)0x3691e201;
  local_320[0xc0] = (undefined **)0x37b66c09;
  local_320[0xc1] = (undefined **)0x38df8829;
  local_320[0xc2] = (undefined **)0x3a0d4281;
  local_320[0xc3] = (undefined **)0x3b3fa741;
  local_320[0xc4] = (undefined **)0x3c76c2a9;
  local_b5c[0] = (undefined **)0x1;
  local_b5c[2] = (undefined **)0x3d;
  local_320[0xc5] = (undefined **)0x3db2a109;
  local_320[0xc6] = (undefined **)0x3ef34ec1;
  local_320[199] = (undefined **)0x0;
  local_b5c[4] = (undefined **)0x2a9;
  local_b5c[1] = (undefined **)0xb;
  local_b5c[7] = (undefined **)0x1c0f;
  local_b5c[8] = (undefined **)0x3311;
  local_b5c[3] = (undefined **)0xe7;
  local_b5c[5] = (undefined **)0x693;
  local_b5c[6] = (undefined **)0xe45;
  local_b5c[9] = (undefined **)0x575b;
  local_b5c[10] = (undefined **)0x8e0d;
  local_b5c[0xb] = (undefined **)0xdd77;
  local_b5c[0xc] = (undefined **)0x14d39;
  local_b5c[0xd] = (undefined **)0x1e663;
  local_b5c[0xe] = (undefined **)0x2b395;
  local_b5c[0xf] = (undefined **)0x3c11f;
  local_b5c[0x10] = (undefined **)0x51d21;
  local_b5c[0x11] = (undefined **)0x6d7ab;
  local_b5c[0x12] = (undefined **)0x902dd;
  local_b5c[0x13] = (undefined **)0xbb307;
  local_b5c[0x14] = (undefined **)0xefec9;
  local_b5c[0x15] = (undefined **)0x12ff33;
  local_b5c[0x16] = (undefined **)0x17cfe5;
  local_b5c[0x17] = (undefined **)0x1d8f2f;
  local_b5c[0x18] = (undefined **)0x245e31;
  local_b5c[0x19] = (undefined **)0x2c60fb;
  local_b5c[0x1a] = (undefined **)0x35bead;
  local_b5c[0x1f] = (undefined **)0x1;
  local_b5c[0x20] = (undefined **)0xd;
  local_b5c[0x1b] = &PTR_DAT_0040a197;
  local_b5c[0x1c] = (undefined **)&DAT_004d3759;
  local_b5c[0x1d] = (undefined **)0x5bb103;
  local_b5c[0x1e] = (undefined **)0x0;
  local_b5c[0x23] = (undefined **)0x509;
  local_b5c[0x21] = (undefined **)0x55;
  local_b5c[0x26] = (undefined **)0x4d71;
  local_b5c[0x27] = (undefined **)0x9c91;
  local_b5c[0x22] = (undefined **)0x179;
  local_b5c[0x24] = (undefined **)0xe45;
  local_b5c[0x25] = (undefined **)0x231d;
  local_b5c[0x28] = (undefined **)0x126fd;
  local_b5c[0x29] = (undefined **)0x20c65;
  local_b5c[0x2a] = (undefined **)0x377e9;
  local_b5c[0x2b] = (undefined **)0x5a299;
  local_b5c[0x2c] = (undefined **)0x8d635;
  local_b5c[0x2d] = (undefined **)0xd702d;
  local_b5c[0x2e] = (undefined **)0x13e4e1;
  local_b5c[0x2f] = (undefined **)0x1cc321;
  local_b5c[0x30] = (undefined **)0x28b7ed;
  local_b5c[0x31] = (undefined **)0x389275;
  local_b5c[0x32] = (undefined **)&DAT_004d4859;
  local_b5c[0x33] = (undefined **)0x67fa29;
  local_b5c[0x34] = (undefined **)0x89f825;
  local_b5c[0x35] = (undefined **)0xb4c73d;
  local_b5c[0x36] = (undefined **)0xea2651;
  local_b5c[0x37] = (undefined **)0x12c13b1;
  local_b5c[0x38] = (undefined **)0x17cd2dd;
  local_b5c[0x39] = (undefined **)0x1def285;
  local_b5c[0x3a] = (undefined **)0x25552c9;
  local_b5c[0x3b] = (undefined **)0x2e32bb9;
  local_b5c[0x3c] = (undefined **)0x38c1415;
  local_b5c[0x3d] = (undefined **)0x0;
  local_b5c[0x3e] = (undefined **)0x1;
  local_b5c[0x3f] = (undefined **)0xf;
  local_b5c[0x43] = (undefined **)0x1c0f;
  local_b5c[0x44] = (undefined **)0x4d71;
  local_b5c[0x40] = (undefined **)0x71;
  local_b5c[0x41] = (undefined **)0x23f;
  local_b5c[0x42] = (undefined **)0x8c1;
  local_b5c[0x45] = (undefined **)0xbdff;
  local_b5c[0x47] = (undefined **)0x36b8f;
  local_b5c[0x48] = (undefined **)0x69ef1;
  local_b5c[0x49] = (undefined **)0xc233f;
  local_b5c[0x4a] = (undefined **)0x153dc1;
  local_b5c[0x4b] = (undefined **)0x23b68f;
  local_b5c[0x4c] = (undefined **)0x39fcf1;
  local_b5c[0x4d] = (undefined **)0x5b51ff;
  local_b5c[0x4e] = (undefined **)0x8bfa01;
  local_b5c[0x4f] = (undefined **)0xd1750f;
  local_b5c[0x50] = (undefined **)0x132bf71;
  local_b5c[0x51] = (undefined **)0x1b89a3f;
  local_b5c[0x52] = (undefined **)0x26ddcc1;
  local_b5c[0x53] = (undefined **)0x35fcf0f;
  local_b5c[0x54] = (undefined **)0x49e8e71;
  local_b5c[0x55] = (undefined **)0x63d7bff;
  local_b5c[0x56] = (undefined **)0x853b601;
  local_b5c[0x57] = (undefined **)0xafc9c8f;
  local_b5c[0x58] = (undefined **)0xe5861f1;
  local_b5c[0x5d] = (undefined **)0x1;
  local_b5c[0x59] = (undefined **)0x128ca73f;
  local_b5c[0x5a] = (undefined **)0x17c525c1;
  local_b5c[0x5b] = (undefined **)0x1e34658f;
  local_b5c[0x5e] = (undefined **)0x11;
  local_b5c[0x46] = (undefined **)0x1a801;
  local_b5c[0x62] = (undefined **)0x3311;
  local_b5c[0x5c] = (undefined **)0x0;
  local_b5c[99] = (undefined **)0x9c91;
  local_b5c[0x5f] = (undefined **)0x91;
  local_b5c[0x60] = (undefined **)0x341;
  local_b5c[0x61] = (undefined **)0xe41;
  local_b5c[0x65] = (undefined **)0x40e01;
  local_b5c[0x66] = (undefined **)0x92191;
  local_b5c[0x67] = (undefined **)0x132c11;
  local_b5c[0x68] = (undefined **)0x25ee41;
  local_b5c[0x69] = (undefined **)0x474f41;
  local_b5c[0x6a] = (undefined **)0x804391;
  local_b5c[0x6b] = (undefined **)0xddf711;
  local_b5c[0x6c] = (undefined **)0x1734601;
  local_b5c[0x6d] = (undefined **)0x25a9201;
  local_b5c[100] = (undefined **)0x1a801;
  local_b5c[0x6e] = (undefined **)0x3b80111;
  local_b5c[0x6f] = (undefined **)0x5bc3591;
  local_b5c[0x70] = (undefined **)0x8a78f41;
  local_b5c[0x71] = (undefined **)0xcce0641;
  local_b5c[0x72] = (undefined **)0x129bb211;
  local_b5c[0x73] = (undefined **)0x1a9a0f91;
  local_b5c[0x74] = (undefined **)0x25761a01;
  local_b5c[0x75] = (undefined **)0x34074c01;
  local_b5c[0x76] = (undefined **)0x47579e91;
  local_b5c[0x77] = (undefined **)0x60ac9d11;
  local_b5c[0x78] = (undefined **)0x8191a641;
  local_b5c[0x79] = (undefined **)0xabe37341;
  local_b5c[0x7a] = (undefined **)0xe1dcfe91;
  local_b5c[0x7b] = (undefined **)0x0;
  piVar1 = FUN_004b8710((int *)0x0,9,0xc9,1);
  piVar1[7] = piVar1[1];
  piVar1[8] = 1;
  uVar2 = 0;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,1,uVar2,0,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,1,0,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,uVar2 * 2 + 1,1,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x7c],2,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x145],3,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x20e],4,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2],5,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x1f],6,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x3e],7,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x5d],8,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  return piVar1;
}


int * __cdecl FUN_004b8710(int *param_1,int param_2,int param_3,int param_4)

{
  int iVar1;
  void *pvVar2;
  int iVar3;
  int iVar4;
  int iVar5;
  
  if (param_1 == (int *)0x0) {
    param_1 = (int *)FUN_004b86f0();
  }
  if (param_1[0xd] != 0x1e240) {
    return (int *)0x0;
  }
  if ((void *)param_1[0xc] != (void *)0x0) {
    free((void *)param_1[0xc]);
  }
  iVar1 = param_4 * param_3 * param_2;
  pvVar2 = malloc(iVar1 * 4);
  param_1[0xc] = (int)pvVar2;
  param_1[0xb] = 0;
  if (param_1[0xc] == 0) {
    perror(s_Cannot_allocate_memory_for_iArra_00516e04);
    return (int *)0x0;
  }
  if ((void *)param_1[10] != (void *)0x0) {
    free((void *)param_1[10]);
  }
  iVar5 = 0;
  pvVar2 = malloc(param_4 << 2);
  param_1[10] = (int)pvVar2;
  if (0 < param_4) {
    iVar4 = 0;
    iVar3 = param_4;
    do {
      iVar4 = iVar4 + 4;
      *(int *)(param_1[10] + -4 + iVar4) = iVar5;
      iVar5 = iVar5 + param_3 * param_2;
      iVar3 = iVar3 + -1;
    } while (iVar3 != 0);
  }
  param_1[3] = param_2;
  param_1[4] = param_3;
  param_1[5] = param_4;
  *param_1 = param_2;
  param_1[1] = param_3;
  param_1[2] = param_4;
  param_1[6] = iVar1;
  param_1[7] = 1;
  param_1[8] = param_2;
  if (param_2 == 1) {
    param_1[7] = 1;
    param_1[8] = 1;
    param_1[0xe] = 1;
    param_1[0x10] = 1;
  }
  else {
    if (param_3 != 1) {
      param_1[0xe] = 0;
      param_1[0x10] = 0;
    }
    else {
      param_1[7] = 1;
      param_1[8] = param_2;
      param_1[0xe] = 1;
    }
    param_1[0xf] = (uint)(param_3 == 1);
  }
  param_1[9] = param_1[7];
  return param_1;
}


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



undefined4 __cdecl FUN_004b8850(void *param_1)

{
  if (*(int *)((int)param_1 + 0x34) != 0x1e240) {
    return 0xffffffff;
  }
  if (*(void **)((int)param_1 + 0x30) != (void *)0x0) {
    free(*(void **)((int)param_1 + 0x30));
  }
  if (*(void **)((int)param_1 + 0x28) != (void *)0x0) {
    free(*(void **)((int)param_1 + 0x28));
  }
  free(param_1);
  return 0;
}


undefined1 __cdecl FUN_004bc0f0(undefined4 *param_1)

{
  undefined1 uVar1;
  
  uVar1 = *(undefined1 *)*param_1;
  *param_1 = (undefined1 *)*param_1 + 1;
  return uVar1;
}


void __cdecl FUN_004b7720(int param_1,undefined4 *param_2,undefined4 *param_3)

{
  if (param_1 == 0) {
    *param_2 = 9;
    *param_3 = 7;
    return;
  }
  if (param_1 != 1) {
    perror(s_***ERROR:_unsupported_filter_typ_00516d24);
                    /* WARNING: Subroutine does not return */
    exit(1);
  }
  *param_2 = 7;
  *param_3 = 5;
  return;
}


int * __cdecl FUN_004bc270(int *param_1,int param_2,int param_3)

{
  void *pvVar1;
  int iVar2;
  
  if (param_1 == (int *)0x0) {
    param_1 = (int *)FUN_004bc250();
  }
  if (param_1[6] != 0x1e240) {
    return (int *)0x0;
  }
  if ((void *)param_1[1] != (void *)0x0) {
    free((void *)param_1[1]);
  }
  pvVar1 = malloc(param_2 * 4);
  param_1[1] = (int)pvVar1;
  if (pvVar1 == (void *)0x0) {
    perror(s_Cannot_allocate_memory_for_Kerne_00516e8c);
    return (int *)0x0;
  }
  *param_1 = param_2;
  iVar2 = (param_2 + -1) / 2;
  param_1[3] = iVar2;
  param_1[4] = iVar2 + param_3;
  param_1[5] = -param_3;
  param_1[2] = 1;
  return param_1;
}


void __cdecl FUN_004b7770(int param_1,uint *param_2,uint *param_3,uint *param_4,uint *param_5)

{
  undefined4 local_70;
  undefined4 local_6c;
  undefined4 local_68;
  undefined4 local_64;
  undefined4 local_60;
  undefined4 local_5c;
  undefined4 local_58;
  undefined4 local_54;
  undefined4 local_50;
  undefined4 local_4c;
  undefined4 local_48;
  undefined4 local_44;
  undefined4 local_40;
  undefined4 local_3c;
  undefined4 local_38;
  undefined4 local_34;
  undefined4 local_30;
  undefined4 local_2c;
  undefined4 local_28;
  undefined4 local_24;
  undefined4 local_20;
  undefined4 local_1c;
  undefined4 local_18;
  undefined4 local_14;
  undefined4 local_10;
  undefined4 local_c;
  undefined4 local_8;
  undefined4 local_4;
  
  local_24 = 0x3d5889c7;
  local_20 = 0xbd08e1cf;
  local_1c = 0xbdbe9b19;
  local_18 = 0x3ec6212d;
  local_10 = 0x3ec6212d;
  local_c = 0xbdbe9b19;
  local_8 = 0xbd08e1cf;
  local_4 = 0x3d5889c7;
  local_58 = 0xbd609caf;
  local_54 = 0x3ee16f3a;
  local_5c = 0xbdb1a91a;
  local_4c = 0x3ee16f3a;
  local_48 = 0xbd609caf;
  local_44 = 0xbdb1a91a;
  local_40 = 0xbc2f8af9;
  local_3c = 0xbd5b6db7;
  local_38 = 0x3e857c58;
  local_30 = 0x3e857c58;
  local_2c = 0xbd5b6db7;
  local_28 = 0xbc2f8af9;
  local_6c = 0x3e800000;
  local_14 = 0x3f499a81;
  local_70 = 0xbd4ccccd;
  local_64 = 0x3e800000;
  local_50 = 0x3f511889;
  local_34 = 0x3f1b6db7;
  local_68 = 0x3f19999a;
  local_60 = 0xbd4ccccd;
  if (param_1 == 0) {
    FUN_004b7660((int)&local_24,param_2);
    FUN_004b7690(param_2[3],param_2,param_5);
    FUN_004b7660((int)&local_5c,param_4);
    FUN_004b7690(param_4[3],param_4,param_3);
    return;
  }
  if (param_1 != 1) {
    perror(s_***ERROR:_unsupported_filter_typ_00516d24);
                    /* WARNING: Subroutine does not return */
    exit(1);
  }
  FUN_004b7660((int)&local_40,param_2);
  FUN_004b7690(param_2[3],param_2,param_5);
  FUN_004b7660((int)&local_70,param_4);
  FUN_004b7690(param_4[3],param_4,param_3);
  FUN_004bc3b0(param_2,1.4142135);
  FUN_004bc3b0(param_3,1.4142135);
  FUN_004bc3b0(param_4,1.4142135);
  FUN_004bc3b0(param_5,1.4142135);
  return;
}


int * __cdecl
FUN_004b8500(int *param_1,int param_2,int param_3,int param_4,int param_5,int param_6,uint param_7)

{
  int iVar1;
  
  if (param_2 == 0) {
    return (int *)0x0;
  }
  if (*(uint *)(param_2 + 0x14) <= param_7) {
    return (int *)0x0;
  }
  if (*(uint *)(param_2 + 0xc) < (uint)(param_5 + param_3)) {
    return (int *)0x0;
  }
  if (*(uint *)(param_2 + 0x10) < (uint)(param_3 + param_6)) {
    return (int *)0x0;
  }
  if (param_1 == (int *)0x0) {
    param_1 = (int *)FUN_004b84e0();
  }
  if ((void *)param_1[1] != (void *)0x0) {
    free((void *)param_1[1]);
  }
  iVar1 = FUN_004b8110();
  param_1[1] = iVar1;
  param_1[2] = param_3;
  param_1[3] = param_4;
  param_1[4] = param_7;
  *param_1 = param_2;
  param_1[5] = param_5;
  param_1[6] = param_6;
  param_1[9] = param_3;
  param_1[10] = param_4;
  *(undefined4 *)(param_1[1] + 0x28) = *(undefined4 *)(param_2 + 0x28);
  *(int *)(param_1[1] + 0x2c) =
       *(int *)(param_2 + 0x1c) * param_3 + *(int *)(param_2 + 0x20) * param_4;
  param_1[0xd] = (*(int *)(*(int *)(param_2 + 0x28) + param_7 * 4) +
                  param_1[10] * *(int *)(param_2 + 0xc) + param_1[9]) * 4 + *(int *)(param_2 + 0x30)
  ;
  param_1[0xe] = *(int *)(param_2 + 0x18) * 4 + *(int *)(param_2 + 0x30);
  FUN_004b82c0((int *)param_1[1],param_1[0xd],param_5,param_6,1);
  param_1[0xf] = param_1[0xd];
  param_1[7] = 1;
  param_1[8] = 1;
  if (param_5 == 1) {
    *(undefined4 *)(param_1[1] + 0x1c) = *(undefined4 *)(param_2 + 0xc);
    *(undefined4 *)(param_1[1] + 0x20) = 1;
  }
  else if (param_6 == 1) {
    *(undefined4 *)(param_1[1] + 0x20) = *(undefined4 *)(param_2 + 0xc);
    *(undefined4 *)(param_1[1] + 0x1c) = 1;
  }
  *(undefined4 *)(param_1[1] + 0x24) = *(undefined4 *)(param_1[1] + 0x1c);
  param_1[0xc] = 1;
  return param_1;
}


void __cdecl
FUN_004b72b0(int *param_1,int *param_2,uint param_3,uint param_4,float param_5,int param_6,
            undefined4 param_7,float param_8,uint *param_9,int param_10,int param_11)

{
  undefined1 uVar1;
  size_t _Count;
  uint *puVar2;
  uint *puVar3;
  uint *puVar4;
  void *pvVar5;
  undefined4 *puVar6;
  undefined3 extraout_var;
  uint *puVar7;
  uint *puVar8;
  uint uVar9;
  int iVar10;
  uint uVar11;
  void *local_4;
  
  _Count = FUN_004b7240(*param_1,param_1[1],param_3,param_6);
  puVar2 = (uint *)FUN_004b8710((int *)0x0,_Count,1,1);
  puVar3 = (uint *)FUN_004b8710((int *)0x0,_Count,1,1);
  puVar4 = (uint *)FUN_004b8710((int *)0x0,_Count,1,1);
  if ((int)param_3 < 2) {
    iVar10 = FUN_004b6b60(param_4,param_3,param_10);
    pvVar5 = calloc(_Count * 5,1);
    if (pvVar5 == (void *)0x0) {
      perror(s_***Error:_00516d18);
      perror(s_***ERROR:_out_of_memory_***_00516cfc);
      perror(s_***_00516cf4);
                    /* WARNING: Subroutine does not return */
      exit(1);
    }
    FUN_004b71f0(_Count * 5,param_2,pvVar5);
    FUN_004bc190(pvVar5);
    uVar11 = 0;
    puVar7 = (uint *)FUN_004b89c0((int)puVar2,0);
    if (*puVar2 != 0) {
      do {
        uVar11 = uVar11 + 1;
        uVar9 = FUN_004bc220(iVar10 << 3);
        *puVar7 = uVar9;
        puVar7 = puVar7 + 1;
      } while (uVar11 < *puVar2);
    }
  }
  else {
    pvVar5 = calloc(_Count,1);
    if (pvVar5 == (void *)0x0) {
      perror(s_***Error:_00516d18);
      perror(s_***ERROR:_out_of_memory_***_00516cfc);
      perror(s_***_00516cf4);
                    /* WARNING: Subroutine does not return */
      exit(1);
    }
    FUN_004b71f0(_Count,param_2,pvVar5);
    uVar11 = 0;
    local_4 = pvVar5;
    puVar6 = (undefined4 *)FUN_004b89c0((int)puVar3,0);
    if (*puVar3 != 0) {
      do {
        uVar11 = uVar11 + 1;
        uVar1 = FUN_004bc0f0(&local_4);
        *puVar6 = CONCAT31(extraout_var,uVar1);
        puVar6 = puVar6 + 1;
      } while (uVar11 < *puVar3);
    }
    free(pvVar5);
    if (DAT_00516c78 == 0) {
      FUN_004bc190(*param_2);
      puVar7 = (uint *)FUN_004b89c0((int)puVar3,0);
      uVar11 = 0;
      puVar8 = (uint *)FUN_004b89c0((int)puVar4,0);
      if (*puVar3 != 0) {
        do {
          if ((*puVar7 & 0x80) == 0) {
            *puVar8 = 0;
          }
          else {
            uVar9 = FUN_004bc220(4);
            *puVar8 = uVar9;
          }
          puVar8 = puVar8 + 1;
          uVar11 = uVar11 + 1;
          *puVar7 = *puVar7 & 0x7f;
          puVar7 = puVar7 + 1;
        } while (uVar11 < *puVar3);
      }
      iVar10 = FUN_004bc1b0();
      *param_2 = iVar10;
    }
    else {
      puVar6 = (undefined4 *)FUN_004b89c0((int)puVar4,0);
      uVar11 = 0;
      if (*puVar4 != 0) {
        do {
          uVar11 = uVar11 + 1;
          *puVar6 = 0;
          puVar6 = puVar6 + 1;
        } while (uVar11 < *puVar4);
      }
    }
    pvVar5 = calloc(_Count * 5,1);
    if (pvVar5 == (void *)0x0) {
      perror(s_***Error:_00516d18);
      perror(s_***ERROR:_out_of_memory_***_00516cfc);
      perror(s_***_00516cf4);
                    /* WARNING: Subroutine does not return */
      exit(1);
    }
    FUN_004b71f0(_Count * 5,param_2,pvVar5);
    FUN_004bc190(pvVar5);
    puVar7 = (uint *)FUN_004b89c0((int)puVar2,0);
    uVar11 = 0;
    puVar8 = (uint *)FUN_004b89c0((int)puVar3,0);
    if (*puVar2 != 0) {
      do {
        uVar9 = *puVar8;
        puVar8 = puVar8 + 1;
        iVar10 = FUN_004b88a0(param_11,param_3,uVar9,0);
        uVar11 = uVar11 + 1;
        uVar9 = FUN_004bc220(iVar10);
        *puVar7 = uVar9;
        puVar7 = puVar7 + 1;
      } while (uVar11 < *puVar2);
    }
  }
  free(pvVar5);
  FUN_004b7180(param_1,(int)puVar2,(int)puVar3,(int)puVar4,param_3,param_4,param_5,param_6,0.0,
               param_8,param_9);
  FUN_004b8850(puVar2);
  FUN_004b8850(puVar3);
  FUN_004b8850(puVar4);
  return;
}


void __cdecl FUN_004bd1e0(int param_1,int param_2,int *param_3,uint *param_4)

{
  int iVar1;
  int *piVar2;
  int *piVar3;
  int iVar4;
  
  iVar4 = param_3[1] + -1;
  if (0 < param_3[1] + -1) {
    do {
      iVar1 = iVar4 + -1;
      piVar2 = (int *)FUN_004bc610(param_3,iVar1);
      piVar3 = (int *)FUN_004bc610(param_3,iVar4);
      FUN_004bc640(param_1,param_2,*(uint **)(*piVar2 + 0xc),piVar3);
      iVar4 = iVar1;
    } while (iVar1 != 0);
  }
  piVar2 = (int *)FUN_004bc610(param_3,0);
  FUN_004bc640(param_1,param_2,param_4,piVar2);
  return;
}

undefined4 __cdecl FUN_004bc610(int *param_1,int param_2)

{
  if (param_1[1] <= param_2) {
    perror(s_fArray_out_of_bounds_00516dec);
    return 0;
  }
  return *(undefined4 *)(*param_1 + param_2 * 4);
}

void __cdecl FUN_004bc640(int param_1,int param_2,uint *param_3,int *param_4)

{
  int iVar1;
  int iVar2;
  int iVar3;
  uint uVar4;
  int *piVar5;
  int *piVar6;
  int iVar7;
  int local_8;
  int local_4;
  
  piVar5 = (int *)*param_4;
  iVar7 = piVar5[3];
  iVar1 = *piVar5;
  iVar2 = piVar5[1];
  iVar3 = piVar5[2];
  FUN_004bc7c0(*param_3,&local_8,&local_4);
  uVar4 = param_3[1];
  piVar5 = FUN_004b8130((int *)0x0,local_8,uVar4,1);
  piVar6 = FUN_004b8130((int *)0x0,local_4,uVar4,1);
  if ((param_3[1] & 1) == 0) {
    FUN_004bc810(param_1,(int)piVar5,iVar7,1,1,2);
    FUN_004bcc90(param_2,(int)piVar5,iVar2,1,2,1);
    FUN_004bc810(param_1,(int)piVar6,iVar1,1,1,2);
    iVar7 = 1;
  }
  else {
    FUN_004bc810(param_1,(int)piVar5,iVar7,1,1,1);
    FUN_004bcc90(param_2,(int)piVar5,iVar2,1,2,2);
    FUN_004bc810(param_1,(int)piVar6,iVar1,1,1,1);
    iVar7 = 2;
  }
  FUN_004bcc90(param_2,(int)piVar6,iVar3,1,2,iVar7);
  if ((*param_3 & 1) == 0) {
    FUN_004bc810(param_1,(int)param_3,(int)piVar5,0,1,2);
    iVar7 = 1;
  }
  else {
    FUN_004bc810(param_1,(int)param_3,(int)piVar5,0,1,1);
    iVar7 = 2;
  }
  FUN_004bcc90(param_2,(int)param_3,(int)piVar6,0,2,iVar7);
  FUN_004b8270(piVar5);
  FUN_004b8270(piVar6);
  return;
}




uint __cdecl FUN_004bc220(int param_1)

{
  ushort uVar1;
  undefined2 extraout_var;
  uint uVar2;
  uint uVar3;
  
  uVar2 = 0;
  uVar3 = 1;
  if (0 < param_1) {
    do {
      uVar1 = FUN_004bc1d0();
      if (CONCAT22(extraout_var,uVar1) != 0) {
        uVar2 = uVar2 | uVar3;
      }
      uVar3 = uVar3 * 2;
      param_1 = param_1 + -1;
    } while (param_1 != 0);
  }
  return uVar2;
}


void __cdecl
FUN_004b7180(int *param_1,int param_2,int param_3,int param_4,int param_5,int param_6,float param_7,
            int param_8,float param_9,float param_10,uint *param_11)

{
  if (param_5 == 1) {
    FUN_004b70a0(param_1,param_2,param_6,param_7,param_9,param_10);
    return;
  }
  FUN_004b6c40(param_1,param_2,param_3,param_4,param_5,param_6,param_7,param_8,param_9,param_10,
               param_11);
  return;
}




ushort FUN_004bc1d0(void)

{
  ushort uVar1;
  
  if (DAT_0057ffdc == 0) {
    DAT_0057ffe0 = (ushort)*DAT_0057ffd8;
  }
  uVar1 = DAT_0057ffe0;
  DAT_0057ffdc = DAT_0057ffdc + 1;
  DAT_0057ffe0 = DAT_0057ffe0 >> 1;
  if (DAT_0057ffdc == 8) {
    DAT_0057ffdc = 0;
    DAT_0057ffd8 = DAT_0057ffd8 + 1;
  }
  return uVar1 & 1;
}


void __cdecl
FUN_004b70a0(int *param_1,int param_2,int param_3,float param_4,float param_5,float param_6)

{
  int iVar1;
  int iVar2;
  int iVar3;
  int iVar4;
  int *piVar5;
  float *pfVar6;
  int iVar7;
  int local_4;
  
  iVar1 = *param_1;
  iVar2 = param_1[1];
  iVar3 = *(int *)(param_2 + 0x24);
  piVar5 = (int *)FUN_004b89c0(param_2,0);
  pfVar6 = (float *)FUN_004b8370((int)param_1,0,0,0);
  local_4 = iVar1;
  if (0 < iVar1) {
    do {
      iVar7 = iVar2;
      if (0 < iVar2) {
        do {
          iVar4 = *piVar5;
          piVar5 = piVar5 + iVar3;
          *pfVar6 = (float)(iVar4 % (param_3 * 2 + 1) - param_3) *
                    (param_4 / (float)param_3) * param_6 + param_5;
          pfVar6 = pfVar6 + iVar1;
          iVar7 = iVar7 + -1;
        } while (iVar7 != 0);
      }
      local_4 = local_4 + -1;
      pfVar6 = pfVar6 + (1 - iVar2 * iVar1);
    } while (local_4 != 0);
  }
  return;
}


void __cdecl
FUN_004b6c40(int *param_1,int param_2,int param_3,int param_4,int param_5,int param_6,float param_7,
            int param_8,float param_9,float param_10,uint *param_11)

{
  int iVar1;
  int iVar2;
  int iVar3;
  int iVar4;
  int iVar5;
  int iVar6;
  uint uVar7;
  float fVar8;
  float fVar9;
  int *piVar10;
  uint *puVar11;
  int *piVar12;
  float *pfVar13;
  int *piVar14;
  int iVar15;
  float10 fVar16;
  uint local_3c;
  uint local_38;
  int *local_34;
  uint *local_30;
  
  iVar2 = *param_1;
  iVar3 = param_1[1];
  fVar8 = (param_7 / (float)param_6) * param_10;
  iVar4 = *(int *)(param_2 + 0x24);
  iVar5 = *(int *)(param_3 + 0x24);
  iVar6 = *(int *)(param_4 + 0x24);
  local_34 = (int *)FUN_004b89c0(param_2,0);
  local_30 = (uint *)FUN_004b89c0(param_3,0);
  piVar10 = (int *)FUN_004b89c0(param_4,0);
  puVar11 = (uint *)FUN_004b8710((int *)0x0,param_5,1,1);
  piVar12 = FUN_004b8130((int *)0x0,param_5,1,1);
  if (param_8 == 1) {
    local_3c = 0;
    if (0 < iVar3) {
      do {
        local_38 = 0;
        if (0 < iVar2) {
          do {
            iVar15 = *local_34;
            uVar7 = *local_30;
            fVar16 = FUN_004b8a40(*piVar10);
            FUN_004bbdf0(puVar11,iVar15,uVar7,param_11);
            piVar14 = (int *)puVar11[0xc];
            pfVar13 = (float *)piVar12[0xc];
            iVar15 = param_5;
            if (0 < param_5) {
              while( true ) {
                iVar1 = *piVar14;
                piVar14 = piVar14 + 1;
                fVar9 = (float)iVar1 * (fVar8 / (float)fVar16) + param_9;
                if (iVar15 + -1 == 0) break;
                *pfVar13 = fVar9;
                pfVar13 = pfVar13 + 1;
                iVar15 = iVar15 + -1;
              }
              *pfVar13 = fVar9;
            }
            FUN_004b6ba0(param_1,piVar12,local_38,local_3c,0,2);
            iVar15 = local_34[iVar4];
            uVar7 = local_30[iVar5];
            fVar16 = FUN_004b8a40(piVar10[iVar6]);
            piVar10 = piVar10 + iVar6 + iVar6;
            local_34 = local_34 + iVar4 + iVar4;
            local_30 = local_30 + iVar5 + iVar5;
            FUN_004bbdf0(puVar11,iVar15,uVar7,param_11);
            piVar14 = (int *)puVar11[0xc];
            pfVar13 = (float *)piVar12[0xc];
            iVar15 = param_5;
            if (0 < param_5) {
              while( true ) {
                iVar1 = *piVar14;
                piVar14 = piVar14 + 1;
                fVar9 = (float)iVar1 * (fVar8 / (float)fVar16) + param_9;
                if (iVar15 + -1 == 0) break;
                *pfVar13 = fVar9;
                pfVar13 = pfVar13 + 1;
                iVar15 = iVar15 + -1;
              }
              *pfVar13 = fVar9;
            }
            FUN_004b6ba0(param_1,piVar12,local_38,local_3c + 1,0,2);
            local_38 = local_38 + 1;
          } while ((int)local_38 < iVar2);
        }
        local_3c = local_3c + param_5 * 2;
      } while ((int)local_3c < iVar3);
    }
  }
  else {
    local_38 = 0;
    if (0 < iVar2) {
      do {
        local_3c = 0;
        if (0 < iVar3) {
          do {
            iVar15 = *local_34;
            uVar7 = *local_30;
            fVar16 = FUN_004b8a40(*piVar10);
            FUN_004bbdf0(puVar11,iVar15,uVar7,param_11);
            piVar14 = (int *)puVar11[0xc];
            pfVar13 = (float *)piVar12[0xc];
            iVar15 = param_5;
            if (0 < param_5) {
              while( true ) {
                iVar1 = *piVar14;
                piVar14 = piVar14 + 1;
                fVar9 = (float)iVar1 * (fVar8 / (float)fVar16) + param_9;
                if (iVar15 + -1 == 0) break;
                *pfVar13 = fVar9;
                iVar15 = iVar15 + -1;
                pfVar13 = pfVar13 + 1;
              }
              *pfVar13 = fVar9;
            }
            FUN_004b6ba0(param_1,piVar12,local_38,local_3c,2,0);
            iVar15 = local_34[iVar4];
            uVar7 = local_30[iVar5];
            fVar16 = FUN_004b8a40(piVar10[iVar6]);
            piVar10 = piVar10 + iVar6 + iVar6;
            local_34 = local_34 + iVar4 + iVar4;
            local_30 = local_30 + iVar5 + iVar5;
            FUN_004bbdf0(puVar11,iVar15,uVar7,param_11);
            piVar14 = (int *)puVar11[0xc];
            pfVar13 = (float *)piVar12[0xc];
            iVar15 = param_5;
            if (0 < param_5) {
              while( true ) {
                iVar1 = *piVar14;
                piVar14 = piVar14 + 1;
                fVar9 = (float)iVar1 * (fVar8 / (float)fVar16) + param_9;
                if (iVar15 + -1 == 0) break;
                *pfVar13 = fVar9;
                iVar15 = iVar15 + -1;
                pfVar13 = pfVar13 + 1;
              }
              *pfVar13 = fVar9;
            }
            FUN_004b6ba0(param_1,piVar12,local_38 + 1,local_3c,2,0);
            local_3c = local_3c + 1;
          } while ((int)local_3c < iVar3);
        }
        local_38 = local_38 + param_5 * 2;
      } while ((int)local_38 < iVar2);
    }
  }
  FUN_004b8850(puVar11);
  FUN_004b8270(piVar12);
  return;
}


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


int * FUN_004b8a60(void)

{
  int *piVar1;
  uint uVar2;
  uint uVar3;
  undefined **local_b5c [483];
  char *local_3d0;
  undefined *local_3cc;
  undefined *local_3c8;
  undefined *local_3c4;
  undefined *local_3c0;
  undefined4 local_3bc;
  undefined4 local_3b8;
  undefined4 local_3b4;
  undefined4 local_3b0;
  undefined4 local_3ac;
  undefined4 local_3a8;
  undefined4 local_3a4;
  undefined4 local_3a0;
  undefined4 local_39c;
  undefined4 local_398;
  undefined4 local_394;
  undefined4 local_390;
  undefined4 local_38c;
  undefined4 local_388;
  undefined4 local_384;
  undefined4 local_380;
  undefined4 local_37c;
  undefined4 local_378;
  undefined4 local_374;
  undefined4 local_370;
  undefined4 local_36c;
  undefined4 local_368;
  undefined4 local_364;
  undefined4 local_360;
  undefined4 local_35c;
  undefined4 local_358;
  undefined4 local_354;
  undefined4 local_350;
  undefined4 local_34c;
  undefined4 local_348;
  undefined4 local_344;
  undefined4 local_340;
  undefined4 local_33c;
  undefined4 local_338;
  undefined4 local_334;
  undefined4 local_330;
  undefined4 local_32c;
  undefined4 local_328;
  undefined4 local_324;
  undefined **local_320 [200];
  
  local_b5c[0x7e] = (undefined **)0xd;
  local_b5c[0x7c] = (undefined **)0x1;
  local_b5c[0x7f] = (undefined **)0x19;
  local_b5c[0x80] = (undefined **)0x29;
  local_b5c[0x81] = (undefined **)0x3d;
  local_b5c[0x7d] = (undefined **)0x5;
  local_b5c[0x82] = (undefined **)0x55;
  local_b5c[0x83] = (undefined **)0x71;
  local_b5c[0x84] = (undefined **)0x91;
  local_b5c[0x85] = (undefined **)0xb5;
  local_b5c[0x86] = (undefined **)0xdd;
  local_b5c[0x87] = (undefined **)0x109;
  local_b5c[0x88] = (undefined **)0x139;
  local_b5c[0x89] = (undefined **)0x16d;
  local_b5c[0x8a] = (undefined **)0x1a5;
  local_b5c[0x8b] = (undefined **)0x1e1;
  local_b5c[0x8c] = (undefined **)0x221;
  local_b5c[0x8d] = (undefined **)0x265;
  local_b5c[0x8e] = (undefined **)0x2ad;
  local_b5c[0x8f] = (undefined **)0x2f9;
  local_b5c[0x90] = (undefined **)0x349;
  local_b5c[0x91] = (undefined **)0x39d;
  local_b5c[0x92] = (undefined **)0x3f5;
  local_b5c[0x93] = (undefined **)0x451;
  local_b5c[0x94] = (undefined **)0x4b1;
  local_b5c[0x95] = (undefined **)0x515;
  local_b5c[0x96] = (undefined **)0x57d;
  local_b5c[0x97] = (undefined **)0x5e9;
  local_b5c[0x98] = (undefined **)0x659;
  local_b5c[0x99] = (undefined **)0x6cd;
  local_b5c[0x9a] = (undefined **)0x745;
  local_b5c[0x9b] = (undefined **)0x7c1;
  local_b5c[0x9c] = (undefined **)0x841;
  local_b5c[0x9d] = (undefined **)0x8c5;
  local_b5c[0x9e] = (undefined **)0x94d;
  local_b5c[0x9f] = (undefined **)0x9d9;
  local_b5c[0xa0] = (undefined **)0xa69;
  local_b5c[0xa1] = (undefined **)0xafd;
  local_b5c[0xa2] = (undefined **)0xb95;
  local_b5c[0xa3] = (undefined **)0xc31;
  local_b5c[0xa4] = (undefined **)0xcd1;
  local_b5c[0xa5] = (undefined **)0xd75;
  local_b5c[0xa6] = (undefined **)0xe1d;
  local_b5c[0xa7] = (undefined **)0xec9;
  local_b5c[0xa8] = (undefined **)0xf79;
  local_b5c[0xa9] = (undefined **)0x102d;
  local_b5c[0xaa] = (undefined **)0x10e5;
  local_b5c[0xab] = (undefined **)0x11a1;
  local_b5c[0xac] = (undefined **)0x1261;
  local_b5c[0xad] = (undefined **)0x1325;
  local_b5c[0xae] = (undefined **)0x13ed;
  local_b5c[0xaf] = (undefined **)0x14b9;
  local_b5c[0xb0] = (undefined **)0x1589;
  local_b5c[0xb1] = (undefined **)0x165d;
  local_b5c[0xb2] = (undefined **)0x1735;
  local_b5c[0xb3] = (undefined **)0x1811;
  local_b5c[0xb4] = (undefined **)0x18f1;
  local_b5c[0xb5] = (undefined **)0x19d5;
  local_b5c[0xb6] = (undefined **)0x1abd;
  local_b5c[0xb7] = (undefined **)0x1ba9;
  local_b5c[0xb8] = (undefined **)0x1c99;
  local_b5c[0xb9] = (undefined **)0x1d8d;
  local_b5c[0xba] = (undefined **)0x1e85;
  local_b5c[0xbb] = (undefined **)0x1f81;
  local_b5c[0xbc] = (undefined **)0x2081;
  local_b5c[0xbd] = (undefined **)0x2185;
  local_b5c[0xbe] = (undefined **)0x228d;
  local_b5c[0xbf] = (undefined **)0x2399;
  local_b5c[0xc0] = (undefined **)0x24a9;
  local_b5c[0xc1] = (undefined **)0x25bd;
  local_b5c[0xc2] = (undefined **)0x26d5;
  local_b5c[0xc3] = (undefined **)0x27f1;
  local_b5c[0xc4] = (undefined **)0x2911;
  local_b5c[0xc5] = (undefined **)0x2a35;
  local_b5c[0xc6] = (undefined **)0x2b5d;
  local_b5c[199] = (undefined **)0x2c89;
  local_b5c[200] = (undefined **)0x2db9;
  local_b5c[0xc9] = (undefined **)0x2eed;
  local_b5c[0xca] = (undefined **)0x3025;
  local_b5c[0xcb] = (undefined **)0x3161;
  local_b5c[0xcc] = (undefined **)0x32a1;
  local_b5c[0xcd] = (undefined **)0x33e5;
  local_b5c[0xce] = (undefined **)0x352d;
  local_b5c[0xcf] = (undefined **)0x3679;
  local_b5c[0xd0] = (undefined **)0x37c9;
  local_b5c[0xd1] = (undefined **)0x391d;
  local_b5c[0xd2] = (undefined **)0x3a75;
  local_b5c[0xd3] = (undefined **)0x3bd1;
  local_b5c[0xd4] = (undefined **)0x3d31;
  local_b5c[0xd5] = (undefined **)0x3e95;
  local_b5c[0xd6] = (undefined **)0x3ffd;
  local_b5c[0xd7] = (undefined **)0x4169;
  local_b5c[0xd8] = (undefined **)0x42d9;
  local_b5c[0xd9] = (undefined **)0x444d;
  local_b5c[0xda] = (undefined **)0x45c5;
  local_b5c[0xdb] = (undefined **)0x4741;
  local_b5c[0xdc] = (undefined **)0x48c1;
  local_b5c[0xdd] = (undefined **)0x4a45;
  local_b5c[0xde] = (undefined **)0x4bcd;
  local_b5c[0xdf] = (undefined **)0x4d59;
  local_b5c[0xe0] = (undefined **)0x4ee9;
  local_b5c[0xe1] = (undefined **)0x507d;
  local_b5c[0xe2] = (undefined **)0x5215;
  local_b5c[0xe3] = (undefined **)0x53b1;
  local_b5c[0xe4] = (undefined **)0x5551;
  local_b5c[0xe5] = (undefined **)0x56f5;
  local_b5c[0xe6] = (undefined **)0x589d;
  local_b5c[0xe7] = (undefined **)0x5a49;
  local_b5c[0xe8] = (undefined **)0x5bf9;
  local_b5c[0xe9] = (undefined **)0x5dad;
  local_b5c[0xea] = (undefined **)0x5f65;
  local_b5c[0xeb] = (undefined **)0x6121;
  local_b5c[0xec] = (undefined **)0x62e1;
  local_b5c[0xed] = (undefined **)0x64a5;
  local_b5c[0xee] = (undefined **)0x666d;
  local_b5c[0xef] = (undefined **)0x6839;
  local_b5c[0xf0] = (undefined **)0x6a09;
  local_b5c[0xf1] = (undefined **)0x6bdd;
  local_b5c[0xf2] = (undefined **)0x6db5;
  local_b5c[0xf3] = (undefined **)0x6f91;
  local_b5c[0xf4] = (undefined **)0x7171;
  local_b5c[0xf5] = (undefined **)0x7355;
  local_b5c[0xf6] = (undefined **)0x753d;
  local_b5c[0xf7] = (undefined **)0x7729;
  local_b5c[0xf8] = (undefined **)0x7919;
  local_b5c[0xf9] = (undefined **)0x7b0d;
  local_b5c[0xfa] = (undefined **)0x7d05;
  local_b5c[0xfb] = (undefined **)0x7f01;
  local_b5c[0xfc] = (undefined **)0x8101;
  local_b5c[0xfd] = (undefined **)0x8305;
  local_b5c[0xfe] = (undefined **)0x850d;
  local_b5c[0xff] = (undefined **)0x8719;
  local_b5c[0x100] = (undefined **)0x8929;
  local_b5c[0x101] = (undefined **)0x8b3d;
  local_b5c[0x102] = (undefined **)0x8d55;
  local_b5c[0x103] = (undefined **)0x8f71;
  local_b5c[0x104] = (undefined **)0x9191;
  local_b5c[0x105] = (undefined **)0x93b5;
  local_b5c[0x106] = (undefined **)0x95dd;
  local_b5c[0x107] = (undefined **)0x9809;
  local_b5c[0x108] = (undefined **)0x9a39;
  local_b5c[0x109] = (undefined **)0x9c6d;
  local_b5c[0x10a] = (undefined **)0x9ea5;
  local_b5c[0x10b] = (undefined **)0xa0e1;
  local_b5c[0x10c] = (undefined **)0xa321;
  local_b5c[0x10d] = (undefined **)0xa565;
  local_b5c[0x10e] = (undefined **)0xa7ad;
  local_b5c[0x10f] = (undefined **)0xa9f9;
  local_b5c[0x110] = (undefined **)0xac49;
  local_b5c[0x111] = (undefined **)0xae9d;
  local_b5c[0x112] = (undefined **)0xb0f5;
  local_b5c[0x113] = (undefined **)0xb351;
  local_b5c[0x114] = (undefined **)0xb5b1;
  local_b5c[0x115] = (undefined **)0xb815;
  local_b5c[0x116] = (undefined **)0xba7d;
  local_b5c[0x117] = (undefined **)0xbce9;
  local_b5c[0x118] = (undefined **)0xbf59;
  local_b5c[0x119] = (undefined **)0xc1cd;
  local_b5c[0x11a] = (undefined **)0xc445;
  local_b5c[0x11b] = (undefined **)0xc6c1;
  local_b5c[0x11c] = (undefined **)0xc941;
  local_b5c[0x11d] = (undefined **)0xcbc5;
  local_b5c[0x11e] = (undefined **)0xce4d;
  local_b5c[0x11f] = (undefined **)0xd0d9;
  local_b5c[0x120] = (undefined **)0xd369;
  local_b5c[0x121] = (undefined **)0xd5fd;
  local_b5c[0x122] = (undefined **)0xd895;
  local_b5c[0x123] = (undefined **)0xdb31;
  local_b5c[0x124] = (undefined **)0xddd1;
  local_b5c[0x125] = (undefined **)0xe075;
  local_b5c[0x126] = (undefined **)0xe31d;
  local_b5c[0x127] = (undefined **)0xe5c9;
  local_b5c[0x128] = (undefined **)0xe879;
  local_b5c[0x129] = (undefined **)0xeb2d;
  local_b5c[0x12a] = (undefined **)0xede5;
  local_b5c[299] = (undefined **)0xf0a1;
  local_b5c[300] = (undefined **)0xf361;
  local_b5c[0x12d] = (undefined **)0xf625;
  local_b5c[0x12e] = (undefined **)0xf8ed;
  local_b5c[0x12f] = (undefined **)0xfbb9;
  local_b5c[0x130] = (undefined **)0xfe89;
  local_b5c[0x131] = (undefined **)0x1015d;
  local_b5c[0x132] = (undefined **)0x10435;
  local_b5c[0x133] = (undefined **)0x10711;
  local_b5c[0x134] = (undefined **)0x109f1;
  local_b5c[0x135] = (undefined **)0x10cd5;
  local_b5c[0x136] = (undefined **)0x10fbd;
  local_b5c[0x137] = (undefined **)0x112a9;
  local_b5c[0x138] = (undefined **)0x11599;
  local_b5c[0x139] = (undefined **)0x1188d;
  local_b5c[0x13a] = (undefined **)0x11b85;
  local_b5c[0x13b] = (undefined **)0x11e81;
  local_b5c[0x13c] = (undefined **)0x12181;
  local_b5c[0x13d] = (undefined **)0x12485;
  local_b5c[0x13e] = (undefined **)0x1278d;
  local_b5c[0x13f] = (undefined **)0x12a99;
  local_b5c[0x140] = (undefined **)0x12da9;
  local_b5c[0x145] = (undefined **)0x1;
  local_b5c[0x141] = (undefined **)0x130bd;
  local_b5c[0x142] = (undefined **)0x133d5;
  local_b5c[0x143] = (undefined **)0x136f1;
  local_b5c[0x144] = (undefined **)0x0;
  local_b5c[0x147] = (undefined **)0x19;
  local_b5c[0x146] = (undefined **)0x7;
  local_b5c[0x148] = (undefined **)0x3f;
  local_b5c[0x14a] = (undefined **)0xe7;
  local_b5c[0x14b] = (undefined **)0x179;
  local_b5c[0x14c] = (undefined **)0x23f;
  local_b5c[0x14d] = (undefined **)0x341;
  local_b5c[0x14e] = (undefined **)0x487;
  local_b5c[0x14f] = (undefined **)0x619;
  local_b5c[0x150] = (undefined **)0x7ff;
  local_b5c[0x151] = (undefined **)0xa41;
  local_b5c[0x152] = (undefined **)0xce7;
  local_b5c[0x153] = (undefined **)0xff9;
  local_b5c[0x154] = (undefined **)0x137f;
  local_b5c[0x155] = (undefined **)0x1781;
  local_b5c[0x156] = (undefined **)0x1c07;
  local_b5c[0x157] = (undefined **)0x2119;
  local_b5c[0x158] = (undefined **)0x26bf;
  local_b5c[0x159] = (undefined **)0x2d01;
  local_b5c[0x15a] = (undefined **)0x33e7;
  local_b5c[0x15b] = (undefined **)0x3b79;
  local_b5c[0x15c] = (undefined **)0x43bf;
  local_b5c[0x15d] = (undefined **)0x4cc1;
  local_b5c[0x15e] = (undefined **)0x5687;
  local_b5c[0x15f] = (undefined **)0x6119;
  local_b5c[0x160] = (undefined **)0x6c7f;
  local_b5c[0x161] = (undefined **)0x78c1;
  local_b5c[0x162] = (undefined **)0x85e7;
  local_b5c[0x163] = (undefined **)0x93f9;
  local_b5c[0x149] = (undefined **)0x81;
  local_b5c[0x164] = (undefined **)0xa2ff;
  local_b5c[0x165] = (undefined **)0xb301;
  local_b5c[0x166] = (undefined **)0xc407;
  local_b5c[0x167] = (undefined **)0xd619;
  local_b5c[0x168] = (undefined **)0xe93f;
  local_b5c[0x169] = (undefined **)0xfd81;
  local_b5c[0x16a] = (undefined **)0x112e7;
  local_b5c[0x16b] = (undefined **)0x12979;
  local_b5c[0x16c] = (undefined **)0x1413f;
  local_b5c[0x16d] = (undefined **)0x15a41;
  local_b5c[0x16e] = (undefined **)0x17487;
  local_b5c[0x16f] = (undefined **)0x19019;
  local_b5c[0x170] = (undefined **)0x1acff;
  local_b5c[0x171] = (undefined **)0x1cb41;
  local_b5c[0x172] = (undefined **)0x1eae7;
  local_b5c[0x173] = (undefined **)0x20bf9;
  local_b5c[0x174] = (undefined **)0x22e7f;
  local_b5c[0x175] = (undefined **)0x25281;
  local_b5c[0x176] = (undefined **)0x27807;
  local_b5c[0x177] = (undefined **)0x29f19;
  local_b5c[0x178] = (undefined **)0x2c7bf;
  local_b5c[0x179] = (undefined **)0x2f201;
  local_b5c[0x17a] = (undefined **)0x31de7;
  local_b5c[0x17b] = (undefined **)0x34b79;
  local_b5c[0x17c] = (undefined **)0x37abf;
  local_b5c[0x17d] = (undefined **)0x3abc1;
  local_b5c[0x17e] = (undefined **)0x3de87;
  local_b5c[0x17f] = (undefined **)0x41319;
  local_b5c[0x180] = (undefined **)0x4497f;
  local_b5c[0x181] = (undefined **)0x481c1;
  local_b5c[0x182] = (undefined **)0x4bbe7;
  local_b5c[0x183] = (undefined **)0x4f7f9;
  local_b5c[0x184] = (undefined **)0x535ff;
  local_b5c[0x185] = (undefined **)0x57601;
  local_b5c[0x186] = (undefined **)0x5b807;
  local_b5c[0x187] = (undefined **)0x5fc19;
  local_b5c[0x188] = (undefined **)0x6423f;
  local_b5c[0x189] = (undefined **)0x68a81;
  local_b5c[0x18a] = (undefined **)0x6d4e7;
  local_b5c[0x18b] = (undefined **)0x72179;
  local_b5c[0x18c] = (undefined **)0x7703f;
  local_b5c[0x18d] = (undefined **)0x7c141;
  local_b5c[0x18e] = (undefined **)0x81487;
  local_b5c[399] = (undefined **)0x86a19;
  local_b5c[400] = (undefined **)0x8c1ff;
  local_b5c[0x191] = (undefined **)0x91c41;
  local_b5c[0x192] = (undefined **)0x978e7;
  local_b5c[0x193] = (undefined **)0x9d7f9;
  local_b5c[0x194] = (undefined **)0xa397f;
  local_b5c[0x195] = (undefined **)0xa9d81;
  local_b5c[0x196] = (undefined **)0xb0407;
  local_b5c[0x197] = (undefined **)0xb6d19;
  local_b5c[0x198] = (undefined **)0xbd8bf;
  local_b5c[0x199] = (undefined **)0xc4701;
  local_b5c[0x19a] = (undefined **)0xcb7e7;
  local_b5c[0x19b] = (undefined **)0xd2b79;
  local_b5c[0x19c] = (undefined **)0xda1bf;
  local_b5c[0x19d] = (undefined **)0xe1ac1;
  local_b5c[0x19e] = (undefined **)0xe9687;
  local_b5c[0x19f] = (undefined **)0xf1519;
  local_b5c[0x1a0] = (undefined **)0xf967f;
  local_b5c[0x1a1] = (undefined **)0x101ac1;
  local_b5c[0x1a2] = (undefined **)0x10a1e7;
  local_b5c[0x1a3] = (undefined **)0x112bf9;
  local_b5c[0x1a4] = (undefined **)0x11b8ff;
  local_b5c[0x1a5] = (undefined **)0x124901;
  local_b5c[0x1a6] = (undefined **)0x12dc07;
  local_b5c[0x1a7] = (undefined **)0x137219;
  local_b5c[0x1a8] = (undefined **)0x140b3f;
  local_b5c[0x1a9] = (undefined **)0x14a781;
  local_b5c[0x1aa] = (undefined **)0x1546e7;
  local_b5c[0x1ab] = (undefined **)0x15e979;
  local_b5c[0x1ac] = (undefined **)0x168f3f;
  local_b5c[0x1ad] = (undefined **)0x173841;
  local_b5c[0x1ae] = (undefined **)0x17e487;
  local_b5c[0x1af] = (undefined **)0x189419;
  local_b5c[0x1b0] = (undefined **)0x1946ff;
  local_b5c[0x1b1] = (undefined **)0x19fd41;
  local_b5c[0x1b2] = (undefined **)0x1ab6e7;
  local_b5c[0x1b3] = (undefined **)0x1b73f9;
  local_b5c[0x1b4] = (undefined **)0x1c347f;
  local_b5c[0x1b5] = (undefined **)0x1cf881;
  local_b5c[0x1b6] = (undefined **)0x1dc007;
  local_b5c[0x1b7] = (undefined **)0x1e8b19;
  local_b5c[0x1b8] = (undefined **)0x1f59bf;
  local_b5c[0x1b9] = (undefined **)0x202c01;
  local_b5c[0x1ba] = (undefined **)0x2101e7;
  local_b5c[0x1bb] = (undefined **)0x21db79;
  local_b5c[0x1bc] = (undefined **)0x22b8bf;
  local_b5c[0x1bd] = (undefined **)0x2399c1;
  local_b5c[0x1be] = (undefined **)0x247e87;
  local_b5c[0x1bf] = (undefined **)0x256719;
  local_b5c[0x1c0] = (undefined **)0x26537f;
  local_b5c[0x1c1] = (undefined **)0x2743c1;
  local_b5c[0x1c2] = (undefined **)0x2837e7;
  local_b5c[0x1c3] = (undefined **)0x292ff9;
  local_b5c[0x1c4] = (undefined **)0x2a2bff;
  local_b5c[0x1c5] = (undefined **)0x2b2c01;
  local_b5c[0x1c6] = (undefined **)0x2c3007;
  local_b5c[0x1c7] = (undefined **)0x2d3819;
  local_b5c[0x1c8] = (undefined **)0x2e443f;
  local_b5c[0x1c9] = (undefined **)0x2f5481;
  local_b5c[0x1ca] = (undefined **)0x3068e7;
  local_b5c[0x1cb] = (undefined **)0x318179;
  local_b5c[0x1cc] = (undefined **)0x329e3f;
  local_b5c[0x1cd] = (undefined **)0x33bf41;
  local_b5c[0x1ce] = (undefined **)0x34e487;
  local_b5c[0x1cf] = (undefined **)0x360e19;
  local_b5c[0x1d0] = (undefined **)0x373bff;
  local_b5c[0x1d1] = (undefined **)0x386e41;
  local_b5c[0x1d2] = (undefined **)0x39a4e7;
  local_b5c[0x1d3] = (undefined **)0x3adff9;
  local_b5c[0x1d4] = (undefined **)0x3c1f7f;
  local_b5c[0x1d5] = (undefined **)0x3d6381;
  local_b5c[0x1d6] = (undefined **)0x3eac07;
  local_b5c[0x1d7] = (undefined **)0x3ff919;
  local_b5c[0x1d8] = (undefined **)0x414abf;
  local_b5c[0x1d9] = (undefined **)&LAB_0042a101;
  local_b5c[0x1da] = (undefined **)0x43fbe7;
  local_b5c[0x1db] = (undefined **)&LAB_00455b79;
  local_b5c[0x1dc] = (undefined **)&DAT_0046bfbf;
  local_b5c[0x1dd] = (undefined **)0x4828c1;
  local_b5c[0x1de] = (undefined **)&LAB_00499687;
  local_b5c[0x1df] = (undefined **)&LAB_004b0919;
  local_b5c[0x1e0] = (undefined **)&DAT_004c807f;
  local_b5c[0x1e1] = (undefined **)&DAT_004dfcc1;
  local_b5c[0x1e2] = (undefined **)&DAT_004f7de7;
  local_3d0 = s_#(@)_$Header:_P:/bmw95/src/tis95_005103d8 + 0x21;
  local_3cc = &DAT_00528eff;
  local_3c8 = &DAT_00541f01;
  local_3c4 = &DAT_0055b407;
  local_3c0 = &DAT_00574e19;
  local_3bc = 0x58ed3f;
  local_3b8 = 0x5a9181;
  local_3b4 = 0x5c3ae7;
  local_3b0 = 0x5de979;
  local_3ac = 0x5f9d3f;
  local_3a8 = 0x615641;
  local_3a4 = 0x631487;
  local_3a0 = 0x64d819;
  local_39c = 0x66a0ff;
  local_398 = 0x686f41;
  local_394 = 0x6a42e7;
  local_390 = 0x6c1bf9;
  local_38c = 0x6dfa7f;
  local_388 = 0x6fde81;
  local_384 = 0x71c807;
  local_380 = 0x73b719;
  local_37c = 0x75abbf;
  local_378 = 0x77a601;
  local_374 = 0x79a5e7;
  local_370 = 0x7bab79;
  local_36c = 0x7db6bf;
  local_368 = 0x7fc7c1;
  local_364 = 0x81de87;
  local_360 = 0x83fb19;
  local_35c = 0x861d7f;
  local_358 = 0x8845c1;
  local_354 = 0x8a73e7;
  local_350 = 0x8ca7f9;
  local_34c = 0x8ee1ff;
  local_348 = 0x912201;
  local_344 = 0x936807;
  local_340 = 0x95b419;
  local_33c = 0x98063f;
  local_338 = 0x9a5e81;
  local_334 = 0x9cbce7;
  local_324 = 1;
  local_320[1] = (undefined **)0x29;
  local_330 = 0x9f2179;
  local_320[2] = (undefined **)0x81;
  local_320[4] = (undefined **)0x2a9;
  local_32c = 0xa18c3f;
  local_328 = 0;
  local_320[5] = (undefined **)0x509;
  local_320[0] = (undefined **)0x9;
  local_320[3] = (undefined **)0x141;
  local_320[6] = (undefined **)0x8c1;
  local_320[7] = (undefined **)0xe41;
  local_320[8] = (undefined **)0x1609;
  local_320[9] = (undefined **)0x20a9;
  local_320[10] = (undefined **)0x2ec1;
  local_320[0xb] = (undefined **)0x4101;
  local_320[0xc] = (undefined **)0x5829;
  local_320[0xd] = (undefined **)0x7509;
  local_320[0xe] = (undefined **)0x9881;
  local_320[0xf] = (undefined **)0xc381;
  local_320[0x10] = (undefined **)0xf709;
  local_320[0x11] = (undefined **)0x13429;
  local_320[0x12] = (undefined **)0x17c01;
  local_320[0x13] = (undefined **)0x1cfc1;
  local_320[0x14] = (undefined **)0x230a9;
  local_320[0x15] = (undefined **)0x2a009;
  local_320[0x16] = (undefined **)0x31f41;
  local_320[0x17] = (undefined **)0x3afc1;
  local_320[0x18] = (undefined **)0x45309;
  local_320[0x19] = (undefined **)0x50aa9;
  local_320[0x1a] = (undefined **)0x5d841;
  local_320[0x1b] = (undefined **)0x6bd81;
  local_320[0x1c] = (undefined **)0x7bc29;
  local_320[0x1d] = (undefined **)0x8d609;
  local_320[0x1e] = (undefined **)0xa0d01;
  local_320[0x1f] = (undefined **)0xb6301;
  local_320[0x20] = (undefined **)0xcda09;
  local_320[0x21] = (undefined **)0xe7429;
  local_320[0x22] = (undefined **)0x103381;
  local_320[0x23] = (undefined **)0x121a41;
  local_320[0x24] = (undefined **)0x142aa9;
  local_320[0x25] = (undefined **)0x166709;
  local_320[0x26] = (undefined **)0x18d1c1;
  local_320[0x27] = (undefined **)0x1b6d41;
  local_320[0x28] = (undefined **)0x1e3c09;
  local_320[0x29] = (undefined **)0x2140a9;
  local_320[0x2a] = (undefined **)0x247dc1;
  local_320[0x2b] = (undefined **)0x27f601;
  local_320[0x2c] = (undefined **)0x2bac29;
  local_320[0x2d] = (undefined **)0x2fa309;
  local_320[0x2e] = (undefined **)0x33dd81;
  local_320[0x2f] = (undefined **)0x385e81;
  local_320[0x30] = (undefined **)0x3d2909;
  local_320[0x31] = (undefined **)0x424029;
  local_320[0x32] = (undefined **)0x47a701;
  local_320[0x33] = (undefined **)&DAT_004d60c1;
  local_320[0x34] = (undefined **)&DAT_005370a9;
  local_320[0x35] = (undefined **)&DAT_0059da09;
  local_320[0x36] = (undefined **)0x60a041;
  local_320[0x37] = (undefined **)0x67c6c1;
  local_320[0x38] = (undefined **)0x6f5109;
  local_320[0x39] = (undefined **)0x7742a9;
  local_320[0x3a] = (undefined **)0x7f9f41;
  local_320[0x3b] = (undefined **)0x886a81;
  local_320[0x3c] = (undefined **)0x91a829;
  local_320[0x3d] = (undefined **)0x9b5c09;
  local_320[0x3e] = (undefined **)0xa58a01;
  local_320[0x3f] = (undefined **)0xb03601;
  local_320[0x40] = (undefined **)0xbb6409;
  local_320[0x41] = (undefined **)0xc71829;
  local_320[0x42] = (undefined **)0xd35681;
  local_320[0x43] = (undefined **)0xe02341;
  local_320[0x44] = (undefined **)0xed82a9;
  local_320[0x45] = (undefined **)0xfb7909;
  local_320[0x46] = (undefined **)0x10a0ac1;
  local_320[0x47] = (undefined **)0x1193c41;
  local_320[0x48] = (undefined **)0x1291209;
  local_320[0x49] = (undefined **)0x13990a9;
  local_320[0x4a] = (undefined **)0x14abcc1;
  local_320[0x4b] = (undefined **)0x15c9b01;
  local_320[0x4c] = (undefined **)0x16f3029;
  local_320[0x4d] = (undefined **)0x1828109;
  local_320[0x4e] = (undefined **)0x1969281;
  local_320[0x4f] = (undefined **)0x1ab6981;
  local_320[0x50] = (undefined **)0x1c10b09;
  local_320[0x51] = (undefined **)0x1d77c29;
  local_320[0x52] = (undefined **)0x1eec201;
  local_320[0x53] = (undefined **)0x206e1c1;
  local_320[0x54] = (undefined **)0x21fe0a9;
  local_320[0x55] = (undefined **)0x239c409;
  local_320[0x56] = (undefined **)0x2549141;
  local_320[0x57] = (undefined **)0x2704dc1;
  local_320[0x58] = (undefined **)0x28cff09;
  local_320[0x59] = (undefined **)0x2aaaaa9;
  local_320[0x5a] = (undefined **)0x2c95641;
  local_320[0x5b] = (undefined **)0x2e90781;
  local_320[0x5c] = (undefined **)0x309c429;
  local_320[0x5d] = (undefined **)0x32b9209;
  local_320[0x5e] = (undefined **)0x34e7701;
  local_320[0x5f] = (undefined **)0x3727901;
  local_320[0x60] = (undefined **)0x3979e09;
  local_320[0x61] = (undefined **)0x3bdec29;
  local_320[0x62] = (undefined **)0x3e56981;
  local_320[99] = (undefined **)0x40e1c41;
  local_320[100] = (undefined **)0x4380aa9;
  local_320[0x65] = (undefined **)0x4633b09;
  local_320[0x66] = (undefined **)0x48fb3c1;
  local_320[0x67] = (undefined **)0x4bd7b41;
  local_320[0x68] = (undefined **)0x4ec9809;
  local_320[0x69] = (undefined **)0x51d10a9;
  local_320[0x6a] = (undefined **)0x54eebc1;
  local_320[0x6b] = (undefined **)0x5823001;
  local_320[0x6c] = (undefined **)0x5b6e429;
  local_320[0x6d] = (undefined **)0x5ed0f09;
  local_320[0x6e] = (undefined **)0x624b781;
  local_320[0x6f] = (undefined **)0x65de481;
  local_320[0x70] = (undefined **)0x6989d09;
  local_320[0x71] = (undefined **)0x6d4e829;
  local_320[0x72] = (undefined **)0x712cd01;
  local_320[0x73] = (undefined **)0x75252c1;
  local_320[0x74] = (undefined **)0x79380a9;
  local_320[0x75] = (undefined **)0x7d65e09;
  local_320[0x76] = (undefined **)0x81af241;
  local_320[0x77] = (undefined **)0x86144c1;
  local_320[0x78] = (undefined **)0x8a95d09;
  local_320[0x79] = (undefined **)0x8f342a9;
  local_320[0x7a] = (undefined **)0x93efd41;
  local_320[0x7b] = (undefined **)0x98c9481;
  local_320[0x7c] = (undefined **)0x9dc1029;
  local_320[0x7d] = (undefined **)0xa2d7809;
  local_320[0x7e] = (undefined **)0xa80d401;
  local_320[0x7f] = (undefined **)0xad62c01;
  local_320[0x80] = (undefined **)0xb2d8809;
  local_320[0x81] = (undefined **)0xb86f029;
  local_320[0x82] = (undefined **)0xbe26c81;
  local_320[0x83] = (undefined **)0xc400541;
  local_320[0x84] = (undefined **)0xc9fc2a9;
  local_320[0x85] = (undefined **)0xd01ad09;
  local_320[0x86] = (undefined **)0xd65ccc1;
  local_320[0x87] = (undefined **)0xdcc2a41;
  local_320[0x88] = (undefined **)0xe34ce09;
  local_320[0x89] = (undefined **)0xe9fc0a9;
  local_320[0x8a] = (undefined **)0xf0d0ac1;
  local_320[0x8b] = (undefined **)0xf7cb501;
  local_320[0x8c] = (undefined **)0xfeec829;
  local_320[0x8d] = (undefined **)0x10634d09;
  local_320[0x8e] = (undefined **)0x10da4c81;
  local_320[0x8f] = (undefined **)0x1153cf81;
  local_320[0x90] = (undefined **)0x11cfdf09;
  local_320[0x91] = (undefined **)0x124e8429;
  local_320[0x92] = (undefined **)0x12cfc801;
  local_320[0x93] = (undefined **)0x1353b3c1;
  local_320[0x94] = (undefined **)0x13da50a9;
  local_320[0x95] = (undefined **)0x1463a809;
  local_320[0x96] = (undefined **)0x14efc341;
  local_320[0x97] = (undefined **)0x157eabc1;
  local_320[0x98] = (undefined **)0x16106b09;
  local_320[0x99] = (undefined **)0x16a50aa9;
  local_320[0x9a] = (undefined **)0x173c9441;
  local_320[0x9b] = (undefined **)0x17d71181;
  local_320[0x9c] = (undefined **)0x18748c29;
  local_320[0x9d] = (undefined **)0x19150e09;
  local_320[0x9e] = (undefined **)0x19b8a101;
  local_320[0x9f] = (undefined **)0x1a5f4f01;
  local_320[0xa0] = (undefined **)0x1b092209;
  local_320[0xa1] = (undefined **)0x1bb62429;
  local_320[0xa2] = (undefined **)0x1c665f81;
  local_320[0xa3] = (undefined **)0x1d19de41;
  local_320[0xa4] = (undefined **)0x1dd0aaa9;
  local_320[0xa5] = (undefined **)0x1e8acf09;
  local_320[0xa6] = (undefined **)0x1f4855c1;
  local_320[0xa7] = (undefined **)0x20094941;
  local_320[0xa8] = (undefined **)0x20cdb409;
  local_320[0xa9] = (undefined **)0x2195a0a9;
  local_320[0xaa] = (undefined **)0x226119c1;
  local_320[0xab] = (undefined **)0x23302a01;
  local_320[0xac] = (undefined **)0x2402dc29;
  local_320[0xad] = (undefined **)0x24d93b09;
  local_320[0xae] = (undefined **)0x25b35181;
  local_320[0xaf] = (undefined **)0x26912a81;
  local_320[0xb0] = (undefined **)0x2772d109;
  local_320[0xb1] = (undefined **)0x28585029;
  local_320[0xb2] = (undefined **)0x2941b301;
  local_320[0xb3] = (undefined **)0x2a2f04c1;
  local_320[0xb4] = (undefined **)0x2b2050a9;
  local_320[0xb5] = (undefined **)0x2c15a209;
  local_320[0xb6] = (undefined **)0x2d0f0441;
  local_320[0xb7] = (undefined **)0x2e0c82c1;
  local_320[0xb8] = (undefined **)0x2f0e2909;
  local_320[0xb9] = (undefined **)0x301402a9;
  local_320[0xba] = (undefined **)0x311e1b41;
  local_320[0xbb] = (undefined **)0x322c7e81;
  local_320[0xbc] = (undefined **)0x333f3829;
  local_320[0xbd] = (undefined **)0x34565409;
  local_320[0xbe] = (undefined **)0x3571de01;
  local_320[0xbf] = (undefined **)0x3691e201;
  local_320[0xc0] = (undefined **)0x37b66c09;
  local_320[0xc1] = (undefined **)0x38df8829;
  local_320[0xc2] = (undefined **)0x3a0d4281;
  local_320[0xc3] = (undefined **)0x3b3fa741;
  local_320[0xc4] = (undefined **)0x3c76c2a9;
  local_b5c[0] = (undefined **)0x1;
  local_b5c[2] = (undefined **)0x3d;
  local_320[0xc5] = (undefined **)0x3db2a109;
  local_320[0xc6] = (undefined **)0x3ef34ec1;
  local_320[199] = (undefined **)0x0;
  local_b5c[4] = (undefined **)0x2a9;
  local_b5c[1] = (undefined **)0xb;
  local_b5c[7] = (undefined **)0x1c0f;
  local_b5c[8] = (undefined **)0x3311;
  local_b5c[3] = (undefined **)0xe7;
  local_b5c[5] = (undefined **)0x693;
  local_b5c[6] = (undefined **)0xe45;
  local_b5c[9] = (undefined **)0x575b;
  local_b5c[10] = (undefined **)0x8e0d;
  local_b5c[0xb] = (undefined **)0xdd77;
  local_b5c[0xc] = (undefined **)0x14d39;
  local_b5c[0xd] = (undefined **)0x1e663;
  local_b5c[0xe] = (undefined **)0x2b395;
  local_b5c[0xf] = (undefined **)0x3c11f;
  local_b5c[0x10] = (undefined **)0x51d21;
  local_b5c[0x11] = (undefined **)0x6d7ab;
  local_b5c[0x12] = (undefined **)0x902dd;
  local_b5c[0x13] = (undefined **)0xbb307;
  local_b5c[0x14] = (undefined **)0xefec9;
  local_b5c[0x15] = (undefined **)0x12ff33;
  local_b5c[0x16] = (undefined **)0x17cfe5;
  local_b5c[0x17] = (undefined **)0x1d8f2f;
  local_b5c[0x18] = (undefined **)0x245e31;
  local_b5c[0x19] = (undefined **)0x2c60fb;
  local_b5c[0x1a] = (undefined **)0x35bead;
  local_b5c[0x1f] = (undefined **)0x1;
  local_b5c[0x20] = (undefined **)0xd;
  local_b5c[0x1b] = &PTR_DAT_0040a197;
  local_b5c[0x1c] = (undefined **)&DAT_004d3759;
  local_b5c[0x1d] = (undefined **)0x5bb103;
  local_b5c[0x1e] = (undefined **)0x0;
  local_b5c[0x23] = (undefined **)0x509;
  local_b5c[0x21] = (undefined **)0x55;
  local_b5c[0x26] = (undefined **)0x4d71;
  local_b5c[0x27] = (undefined **)0x9c91;
  local_b5c[0x22] = (undefined **)0x179;
  local_b5c[0x24] = (undefined **)0xe45;
  local_b5c[0x25] = (undefined **)0x231d;
  local_b5c[0x28] = (undefined **)0x126fd;
  local_b5c[0x29] = (undefined **)0x20c65;
  local_b5c[0x2a] = (undefined **)0x377e9;
  local_b5c[0x2b] = (undefined **)0x5a299;
  local_b5c[0x2c] = (undefined **)0x8d635;
  local_b5c[0x2d] = (undefined **)0xd702d;
  local_b5c[0x2e] = (undefined **)0x13e4e1;
  local_b5c[0x2f] = (undefined **)0x1cc321;
  local_b5c[0x30] = (undefined **)0x28b7ed;
  local_b5c[0x31] = (undefined **)0x389275;
  local_b5c[0x32] = (undefined **)&DAT_004d4859;
  local_b5c[0x33] = (undefined **)0x67fa29;
  local_b5c[0x34] = (undefined **)0x89f825;
  local_b5c[0x35] = (undefined **)0xb4c73d;
  local_b5c[0x36] = (undefined **)0xea2651;
  local_b5c[0x37] = (undefined **)0x12c13b1;
  local_b5c[0x38] = (undefined **)0x17cd2dd;
  local_b5c[0x39] = (undefined **)0x1def285;
  local_b5c[0x3a] = (undefined **)0x25552c9;
  local_b5c[0x3b] = (undefined **)0x2e32bb9;
  local_b5c[0x3c] = (undefined **)0x38c1415;
  local_b5c[0x3d] = (undefined **)0x0;
  local_b5c[0x3e] = (undefined **)0x1;
  local_b5c[0x3f] = (undefined **)0xf;
  local_b5c[0x43] = (undefined **)0x1c0f;
  local_b5c[0x44] = (undefined **)0x4d71;
  local_b5c[0x40] = (undefined **)0x71;
  local_b5c[0x41] = (undefined **)0x23f;
  local_b5c[0x42] = (undefined **)0x8c1;
  local_b5c[0x45] = (undefined **)0xbdff;
  local_b5c[0x47] = (undefined **)0x36b8f;
  local_b5c[0x48] = (undefined **)0x69ef1;
  local_b5c[0x49] = (undefined **)0xc233f;
  local_b5c[0x4a] = (undefined **)0x153dc1;
  local_b5c[0x4b] = (undefined **)0x23b68f;
  local_b5c[0x4c] = (undefined **)0x39fcf1;
  local_b5c[0x4d] = (undefined **)0x5b51ff;
  local_b5c[0x4e] = (undefined **)0x8bfa01;
  local_b5c[0x4f] = (undefined **)0xd1750f;
  local_b5c[0x50] = (undefined **)0x132bf71;
  local_b5c[0x51] = (undefined **)0x1b89a3f;
  local_b5c[0x52] = (undefined **)0x26ddcc1;
  local_b5c[0x53] = (undefined **)0x35fcf0f;
  local_b5c[0x54] = (undefined **)0x49e8e71;
  local_b5c[0x55] = (undefined **)0x63d7bff;
  local_b5c[0x56] = (undefined **)0x853b601;
  local_b5c[0x57] = (undefined **)0xafc9c8f;
  local_b5c[0x58] = (undefined **)0xe5861f1;
  local_b5c[0x5d] = (undefined **)0x1;
  local_b5c[0x59] = (undefined **)0x128ca73f;
  local_b5c[0x5a] = (undefined **)0x17c525c1;
  local_b5c[0x5b] = (undefined **)0x1e34658f;
  local_b5c[0x5e] = (undefined **)0x11;
  local_b5c[0x46] = (undefined **)0x1a801;
  local_b5c[0x62] = (undefined **)0x3311;
  local_b5c[0x5c] = (undefined **)0x0;
  local_b5c[99] = (undefined **)0x9c91;
  local_b5c[0x5f] = (undefined **)0x91;
  local_b5c[0x60] = (undefined **)0x341;
  local_b5c[0x61] = (undefined **)0xe41;
  local_b5c[0x65] = (undefined **)0x40e01;
  local_b5c[0x66] = (undefined **)0x92191;
  local_b5c[0x67] = (undefined **)0x132c11;
  local_b5c[0x68] = (undefined **)0x25ee41;
  local_b5c[0x69] = (undefined **)0x474f41;
  local_b5c[0x6a] = (undefined **)0x804391;
  local_b5c[0x6b] = (undefined **)0xddf711;
  local_b5c[0x6c] = (undefined **)0x1734601;
  local_b5c[0x6d] = (undefined **)0x25a9201;
  local_b5c[100] = (undefined **)0x1a801;
  local_b5c[0x6e] = (undefined **)0x3b80111;
  local_b5c[0x6f] = (undefined **)0x5bc3591;
  local_b5c[0x70] = (undefined **)0x8a78f41;
  local_b5c[0x71] = (undefined **)0xcce0641;
  local_b5c[0x72] = (undefined **)0x129bb211;
  local_b5c[0x73] = (undefined **)0x1a9a0f91;
  local_b5c[0x74] = (undefined **)0x25761a01;
  local_b5c[0x75] = (undefined **)0x34074c01;
  local_b5c[0x76] = (undefined **)0x47579e91;
  local_b5c[0x77] = (undefined **)0x60ac9d11;
  local_b5c[0x78] = (undefined **)0x8191a641;
  local_b5c[0x79] = (undefined **)0xabe37341;
  local_b5c[0x7a] = (undefined **)0xe1dcfe91;
  local_b5c[0x7b] = (undefined **)0x0;
  piVar1 = FUN_004b8710((int *)0x0,9,0xc9,1);
  piVar1[7] = piVar1[1];
  piVar1[8] = 1;
  uVar2 = 0;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,1,uVar2,0,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,1,0,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,uVar2 * 2 + 1,1,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x7c],2,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x145],3,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x20e],4,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0xc9);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2],5,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x1f],6,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x3e],7,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  uVar2 = 1;
  do {
    uVar3 = uVar2 + 1;
    FUN_004b8920((int)piVar1,local_b5c[uVar2 + 0x5d],8,uVar2,0);
    uVar2 = uVar3;
  } while ((int)uVar3 < 0x1f);
  return piVar1;
}


void __cdecl FUN_004bc190(undefined4 param_1)

{
  DAT_0057ffd8 = param_1;
  DAT_0057ffe0 = 0;
  DAT_0057ffdc = 0;
  return;
}



undefined1 __cdecl FUN_004bc0f0(undefined4 *param_1)

{
  undefined1 uVar1;
  
  uVar1 = *(undefined1 *)*param_1;
  *param_1 = (undefined1 *)*param_1 + 1;
  return uVar1;
}



uint __cdecl FUN_004bc220(int param_1)

{
  ushort uVar1;
  undefined2 extraout_var;
  uint uVar2;
  uint uVar3;
  
  uVar2 = 0;
  uVar3 = 1;
  if (0 < param_1) {
    do {
      uVar1 = FUN_004bc1d0();
      if (CONCAT22(extraout_var,uVar1) != 0) {
        uVar2 = uVar2 | uVar3;
      }
      uVar3 = uVar3 * 2;
      param_1 = param_1 + -1;
    } while (param_1 != 0);
  }
  return uVar2;
}


int FUN_004bc1b0(void)

{
  if (DAT_0057ffdc == 0) {
    return DAT_0057ffd8;
  }
  return DAT_0057ffd8 + 1;
}



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


