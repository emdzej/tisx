#!/bin/bash
# Convert RTF files to Markdown recursively
# Usage: ./rtf-to-markdown.sh /path/to/rtf_dir /path/to/output_dir

set -e

# Check arguments
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <input_dir> <output_dir>"
    echo "Example: $0 ./tis-docs ./tis-markdown"
    exit 1
fi

INPUT_DIR="$1"
OUTPUT_DIR="$2"

# Check if pandoc exists
if ! command -v pandoc &> /dev/null; then
    echo "Error: pandoc not found"
    echo "Install pandoc:"
    echo "  macOS:  brew install pandoc"
    echo "  Ubuntu: sudo apt install pandoc"
    echo "  Fedora: sudo dnf install pandoc"
    exit 1
fi

# Check if input directory exists
if [[ ! -d "$INPUT_DIR" ]]; then
    echo "Error: Directory not found: $INPUT_DIR"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Converting RTF to Markdown"
echo "Input:  $INPUT_DIR"
echo "Output: $OUTPUT_DIR"
echo ""

# Count files
total=$(find "$INPUT_DIR" -type f -iname "*.rtf" | wc -l | tr -d ' ')
count=0
failed=0

# Find all RTF files and convert
find "$INPUT_DIR" -type f -iname "*.rtf" | while read -r rtf_file; do
    ((count++)) || true
    
    # Get relative path and create output path
    rel_path="${rtf_file#$INPUT_DIR/}"
    md_file="$OUTPUT_DIR/${rel_path%.*}.md"
    # Handle uppercase extension
    output_dir=$(dirname "$md_file")
    
    # Create output subdirectory
    mkdir -p "$output_dir"
    
    printf "[%d/%d] %s... " "$count" "$total" "$rel_path"
    
    # Convert with pandoc
    if pandoc -f rtf -t markdown-grid_tables -o "$md_file" "$rtf_file" 2>/dev/null; then
        echo "OK"
    else
        echo "FAILED"
        ((failed++)) || true
        rm -f "$md_file"
    fi
done

echo ""
echo "Done! Converted files are in: $OUTPUT_DIR"
