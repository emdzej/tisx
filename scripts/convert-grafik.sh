#!/bin/bash
# Batch-convert ITW images to PNG, preserving directory structure.
# Usage: ./convert-grafik.sh <source_dir> <output_dir> [parallelism]
#
# Requires: itw-decode CLI (@emdzej/itw-decoder)
#   If not installed, the script will offer to install it globally via npm.

set -euo pipefail

SOURCE_DIR="${1:?Usage: $0 <source_dir> <output_dir> [parallelism]}"
OUTPUT_DIR="${2:?Usage: $0 <source_dir> <output_dir> [parallelism]}"
JOBS="${3:-$(nproc 2>/dev/null || sysctl -n hw.logicalcpu 2>/dev/null || echo 4)}"

# ── Dependency check ─────────────────────────────────────────────────────────

if ! command -v itw-decode &>/dev/null; then
    echo "itw-decode not found."
    echo "It is provided by the @emdzej/itw-decoder npm package."
    read -r -p "Install it globally now? (npm install -g @emdzej/itw-decoder) [y/N] " answer
    if [[ "${answer,,}" == "y" ]]; then
        npm install -g @emdzej/itw-decoder
        if ! command -v itw-decode &>/dev/null; then
            echo "Error: installation succeeded but itw-decode is still not on PATH."
            exit 1
        fi
    else
        echo "Aborted. Install @emdzej/itw-decoder and try again."
        exit 1
    fi
fi

# ── Validate source ───────────────────────────────────────────────────────────

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Error: source directory not found: $SOURCE_DIR"
    exit 1
fi

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"

echo "=========================================="
echo "ITW → PNG Batch Conversion"
echo "=========================================="
echo "Source      : $SOURCE_DIR"
echo "Output      : $OUTPUT_DIR"
echo "Parallelism : $JOBS"
echo ""

# ── Per-file worker (called by xargs) ────────────────────────────────────────
# Exported so it survives into the subshell spawned by xargs -P.

export SOURCE_DIR OUTPUT_DIR

_convert_one() {
    local itw_file="$1"
    local rel_path="${itw_file#$SOURCE_DIR/}"
    local rel_dir
    rel_dir="$(dirname "$rel_path")"
    local base
    base="$(basename "$itw_file")"
    local png_name="${base%.*}.png"
    local dest_dir="$OUTPUT_DIR/$rel_dir"
    local dest_file="$dest_dir/$png_name"

    if [[ -f "$dest_file" ]]; then
        echo "SKIP $rel_path"
        return
    fi

    mkdir -p "$dest_dir"

    if itw-decode -o "$dest_file" "$itw_file" &>/dev/null; then
        echo "OK   $rel_path"
    else
        echo "FAIL $rel_path"
        rm -f "$dest_file"
    fi
}

export -f _convert_one

# ── Parallel conversion ───────────────────────────────────────────────────────

find "$SOURCE_DIR" -type f -iname "*.itw" -print0 \
    | xargs -0 -P "$JOBS" -I {} bash -c '_convert_one "$@"' _ {} \
    | tee /tmp/convert-grafik-$$.log

# ── Summary ───────────────────────────────────────────────────────────────────

converted=$(grep -c '^OK' /tmp/convert-grafik-$$.log 2>/dev/null || echo 0)
skipped=$(grep -c   '^SKIP' /tmp/convert-grafik-$$.log 2>/dev/null || echo 0)
failed=$(grep -c    '^FAIL' /tmp/convert-grafik-$$.log 2>/dev/null || echo 0)
rm -f /tmp/convert-grafik-$$.log

echo ""
echo "=========================================="
echo "Done."
echo "  Converted : $converted"
echo "  Skipped   : $skipped (already existed)"
echo "  Failed    : $failed"
echo "=========================================="
