# ITW V1 Stream Structure

Analysis based on 26.ITW (316×238, 19 zlib streams).

## Stream Categories

### 1. RLE Position Streams (even indices, many zeros)
| Stream | Size | Zeros | Purpose |
|--------|------|-------|---------|
| 0 | 2380 | 1773 | LH1 positions |
| 2 | 2528 | 1731 | HL1 positions |
| 8 | 1264 | 1000 | Level 2 positions |
| 14 | 624 | 352 | Level 3 positions |

RLE format: `0=skip1, 1-127=place+skip(N-1), 128-255=embedded`

### 2. Value Streams (odd indices, mean ~100-130)
| Stream | Size | Mean | Purpose |
|--------|------|------|---------|
| 1 | 996 | 101.2 | LH1 values (Fischer) |
| 3 | 1470 | 109.2 | HL1 values (Fischer) |
| 5 | 782 | 107.4 | Level 2 values |
| 7 | 1093 | 105.8 | Level 2 values |
| 9 | 260 | 113.6 | Level 3 values |
| 11 | 212 | 108.7 | Level 3 values |
| 13 | 298 | 133.0 | Level 4 values |
| 15 | 139 | 111.9 | Level 4 values |

### 3. Direct Coefficient Streams
| Stream | Size | Mean | Classification |
|--------|------|------|----------------|
| 4 | 1200 | 8.8 | Detail band (sparse, signed) |
| 6 | 1264 | 12.5 | Detail band (sparse) |
| 10 | 624 | 10.4 | Detail band (sparse) |
| 12 | 640 | 13.6 | Detail band |
| **16** | **300** | **49.4** | **LL4 (deepest LL)** ✓ |
| 17 | 320 | 73.3 | Unknown |
| 18 | 300 | 21.2 | Possibly HH4 or scaled LL |

## LL Band Identification

**Key insight**: LL bands have:
- Higher mean (~50)
- No zeros
- Narrow value range

**Detail bands** have:
- Low mean (~10)
- Many zeros (sparse)
- Wide value range

Stream 16 confirmed as LL4 via visualization - produces recognizable thumbnail.

## Subband Size Reference

For 316×238 image with 4 decomposition levels:

| Level | LL | LH | HL | HH |
|-------|----|----|----|----|
| 1 | 18802 | 18802 | 18802 | 18802 |
| 2 | 4740 | 4661 | 4740 | 4661 |
| 3 | 1200 | 1200 | 1170 | 1170 |
| 4 | 300 | 300 | 300 | 300 |

## Reconstruction Order

1. Load LL4 (stream 16, direct u8)
2. Decode LH4/HL4/HH4 (RLE + Fischer) → reconstruct LL3
3. Decode LH3/HL3/HH3 → reconstruct LL2
4. Decode LH2/HL2/HH2 → reconstruct LL1
5. Decode LH1/HL1/HH1 → full image

## Stream Pairing Pattern

Appears to be: `(RLE_stream, Value_stream)` pairs for each subband
- Level 1: (0,1) = LH1, (2,3) = HL1
- Level 2: (8,?) and others
- etc.

HH bands may share streams or be stored differently.
