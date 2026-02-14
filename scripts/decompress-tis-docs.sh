#!/bin/bash
# Decompress TIS RTF documentation files
# Usage: ./decompress-tis-docs.sh /path/to/tis/DOCS [output_dir]

set -e

TIS_DOCS_DIR="${1:?Usage: $0 /path/to/tis/DOCS [output_dir]}"
OUTPUT_DIR="${2:-./tis-docs}"

if [[ ! -d "$TIS_DOCS_DIR" ]]; then
    echo "Error: DOCS directory not found at $TIS_DOCS_DIR"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Decompressing RTF files from $TIS_DOCS_DIR..."
echo "Output directory: $OUTPUT_DIR"
echo ""

count=0
failed=0

# Find all .RTF files and decompress them
# RTF files use Unix compress (LZW 16-bit), gzip can decompress
find "$TIS_DOCS_DIR" -type f -name "*.RTF" | while read -r rtf_file; do
    # Preserve directory structure
    rel_path="${rtf_file#$TIS_DOCS_DIR/}"
    output_file="$OUTPUT_DIR/$rel_path"
    output_dir=$(dirname "$output_file")
    
    mkdir -p "$output_dir"
    
    if gzip -d < "$rtf_file" > "$output_file" 2>/dev/null; then
        echo "  OK: $rel_path"
        ((count++)) || true
    else
        echo "  FAIL: $rel_path"
        ((failed++)) || true
        rm -f "$output_file"
    fi
done

echo ""
echo "Done!"
echo "Decompressed RTF files are in: $OUTPUT_DIR"
echo ""
echo "You can open them with:"
echo "  - Microsoft Word"
echo "  - LibreOffice Writer"
echo "  - macOS TextEdit"
echo "  - Any RTF-compatible viewer"
