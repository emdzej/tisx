/**
 * HTML Emitter — walks the document node list and produces HTML.
 *
 * Handles:
 * - Character formatting (bold, italic, underline, super/subscript)
 * - Cross-reference links (\strike → <a class="tis-cross-ref">)
 * - Images (GRAFIK → <img class="tis-inline-image">)
 * - Tables with TIS layout classes
 * - Paragraph spacing and indentation
 */

import {
  type DocNode,
  NodeType,
  type FormatState,
  type TextRunNode,
} from './parser.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EmitOptions {
  /** Base URL for image src attributes (default: "/api/images") */
  imageBaseUrl?: string;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

/**
 * Emit HTML from a document node list.
 */
export const emit = (nodes: DocNode[], options?: EmitOptions): string => {
  const imageBaseUrl = options?.imageBaseUrl ?? '/api/images';
  const out: string[] = [];

  let inParagraph = false;
  let inTable = false;
  let inRow = false;
  let inCell = false;
  let hotspotCounter = 0;

  // Track open inline tags for proper nesting
  let currentTags: string[] = [];

  // Track per-row column widths (percentages) for <td> width styling
  let currentRowWidths: number[] = [];
  let currentCellIdx = 0;

  const closeParagraph = () => {
    if (inParagraph) {
      closeInlineTags(out, currentTags);
      currentTags = [];
      out.push('</p>\n');
      inParagraph = false;
    }
  };

  /** Close the current table (and any open cell/row) */
  const closeTable = () => {
    closeParagraph();
    if (inCell) {
      out.push('</td>');
      inCell = false;
    }
    if (inRow) {
      out.push('</tr>\n');
      inRow = false;
    }
    if (inTable) {
      out.push('</tbody>\n</table>\n');
      inTable = false;
    }
  };

  const openParagraph = (node: DocNode & { type: NodeType.Paragraph }) => {
    closeParagraph();

    const styles: string[] = [];
    if (node.leftIndent > 0) {
      styles.push(`margin-left:${twipsToPt(node.leftIndent)}pt`);
    }
    if (node.rightIndent > 0) {
      styles.push(`margin-right:${twipsToPt(node.rightIndent)}pt`);
    }
    if (node.firstLineIndent !== 0) {
      styles.push(
        `text-indent:${twipsToPt(node.firstLineIndent)}pt`,
      );
    }
    if (node.spaceBefore > 0) {
      styles.push(`margin-top:${twipsToPt(node.spaceBefore)}pt`);
    }
    if (node.spaceAfter > 0) {
      styles.push(`margin-bottom:${twipsToPt(node.spaceAfter)}pt`);
    }

    const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
    out.push(`<p${styleAttr}>`);
    inParagraph = true;
  };

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    switch (node.type) {
      case NodeType.Paragraph: {
        // If we're inside a table but this paragraph is NOT in a table,
        // close the table first — non-table content between table rows
        // must live outside the <table> element.
        if (inTable && !node.inTable) {
          closeTable();
        }
        openParagraph(node);
        break;
      }

      case NodeType.TextRun: {
        const run = node as TextRunNode;
        const tags = formatTags(run.format);

        // Diff current tags vs new tags to minimize tag churn
        closeInlineTags(out, currentTags);
        currentTags = [];

        if (run.format.strike) {
          // TIS cross-reference: \strike text → <a class="tis-cross-ref">
          hotspotCounter++;
          out.push(
            `<a class="tis-cross-ref" data-hotspot="${hotspotCounter}" href="#">`,
          );
          openInlineTags(out, tags);
          currentTags = [...tags];
          out.push(escapeHtml(run.text));
          closeInlineTags(out, currentTags);
          currentTags = [];
          out.push('</a>');
        } else if (run.format.superscript > 0) {
          openInlineTags(out, tags);
          currentTags = [...tags];
          out.push(`<sup>${escapeHtml(run.text)}</sup>`);
        } else if (run.format.superscript < 0) {
          openInlineTags(out, tags);
          currentTags = [...tags];
          out.push(`<sub>${escapeHtml(run.text)}</sub>`);
        } else {
          openInlineTags(out, tags);
          currentTags = [...tags];
          out.push(escapeHtml(run.text));
        }
        break;
      }

      case NodeType.LineBreak: {
        out.push('<br>');
        break;
      }

      case NodeType.Tab: {
        out.push('&emsp;');
        break;
      }

      case NodeType.Image: {
        closeParagraph();
        out.push(
          `<img src="${imageBaseUrl}/${node.imageId}" alt="Technical illustration" class="tis-inline-image" loading="lazy" />\n`,
        );
        break;
      }

      case NodeType.TableRowStart: {
        closeParagraph();
        if (!inTable) {
          // Apply table-level styles from \trleft and \cellx boundaries
          const tableStyles: string[] = [];
          if (node.leftIndent > 0) {
            tableStyles.push(
              `margin-left:${twipsToPt(node.leftIndent)}pt`,
            );
          }
          // Compute table width from \cellx boundaries
          if (node.cellWidths.length > 0) {
            const lastBoundary = node.cellWidths[node.cellWidths.length - 1];
            const tableWidthTwips = lastBoundary - node.leftIndent;
            if (tableWidthTwips > 0) {
              tableStyles.push(
                `width:${twipsToPt(tableWidthTwips)}pt`,
              );
            }
          }
          const tableStyle =
            tableStyles.length > 0
              ? ` style="${tableStyles.join(';')}"`
              : '';
          out.push(
            `<table class="tis-layout-table"${tableStyle}>\n<tbody>\n`,
          );
          inTable = true;
        }
        // Compute individual column widths from cumulative \cellx boundaries
        const widths = cellWidthsFromBoundaries(
          node.cellWidths,
          node.leftIndent,
        );
        currentRowWidths = widths;
        currentCellIdx = 0;
        out.push('<tr>');
        inRow = true;
        break;
      }

      case NodeType.TableCellStart: {
        closeParagraph();
        if (!inRow) {
          // Orphaned cell start — start a row
          if (!inTable) {
            out.push('<table class="tis-layout-table">\n<tbody>\n');
            inTable = true;
          }
          out.push('<tr>');
          inRow = true;
        }
        // Determine cell class based on content look-ahead
        const cellClass = lookAheadCellClass(nodes, i);
        // Apply computed column width from \cellx boundaries
        const attrs: string[] = [];
        if (cellClass) attrs.push(`class="${cellClass}"`);
        if (currentCellIdx < currentRowWidths.length) {
          const pct = currentRowWidths[currentCellIdx];
          attrs.push(`style="width:${pct}%"`);
        }
        currentCellIdx++;
        out.push(`<td${attrs.length > 0 ? ' ' + attrs.join(' ') : ''}>`);
        inCell = true;
        break;
      }

      case NodeType.TableCellEnd: {
        closeParagraph();
        if (inCell) {
          out.push('</td>');
          inCell = false;
        }
        break;
      }

      case NodeType.TableRowEnd: {
        closeParagraph();
        if (inCell) {
          out.push('</td>');
          inCell = false;
        }
        if (inRow) {
          out.push('</tr>\n');
          inRow = false;
        }
        // Don't close table here — let the next non-table content close it
        // or close at end
        break;
      }
    }
  }

  // Close any remaining open elements
  closeParagraph();
  closeTable();

  return out.join('');
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const twipsToPt = (twips: number): number => Math.round((twips / 20) * 10) / 10;

/**
 * Compute individual column width percentages from cumulative \cellx right-edge
 * boundaries, relative to the table's left indent (\trleft).
 *
 * \cellx values are absolute positions (in twips) from the page left margin.
 * The first column starts at the \trleft position.
 *
 * Returns an array of percentage widths that sum to ~100%.
 */
const cellWidthsFromBoundaries = (
  cellBoundaries: number[],
  leftIndent: number,
): number[] => {
  if (cellBoundaries.length === 0) return [];

  const widths: number[] = [];
  let prevEdge = leftIndent;
  for (const rightEdge of cellBoundaries) {
    widths.push(Math.max(0, rightEdge - prevEdge));
    prevEdge = rightEdge;
  }

  const total = widths.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  return widths.map((w) => Math.round((w / total) * 1000) / 10);
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Determine which inline HTML tags are needed for a format state.
 * Returns tags in open order (outermost first).
 * Excludes strike (handled separately as cross-ref link).
 */
const formatTags = (format: FormatState): string[] => {
  const tags: string[] = [];
  if (format.bold) tags.push('strong');
  if (format.italic) tags.push('em');
  if (format.underline) tags.push('u');
  return tags;
};

const openInlineTags = (out: string[], tags: string[]): void => {
  for (const tag of tags) {
    out.push(`<${tag}>`);
  }
};

const closeInlineTags = (out: string[], tags: string[]): void => {
  for (let i = tags.length - 1; i >= 0; i--) {
    out.push(`</${tags[i]}>`);
  }
};

/**
 * Look ahead from a TableCellStart to determine if the cell contains an image
 * (→ "tis-img-cell") or text (→ "tis-text-cell").
 */
const lookAheadCellClass = (
  nodes: DocNode[],
  cellStartIdx: number,
): string | null => {
  let hasImage = false;
  let hasText = false;

  for (let j = cellStartIdx + 1; j < nodes.length; j++) {
    const n = nodes[j];
    if (
      n.type === NodeType.TableCellEnd ||
      n.type === NodeType.TableRowEnd
    ) {
      break;
    }
    if (n.type === NodeType.Image) hasImage = true;
    if (n.type === NodeType.TextRun && n.text.trim()) hasText = true;
  }

  if (hasImage && !hasText) return 'tis-img-cell';
  if (hasText && !hasImage) return 'tis-text-cell';
  return null;
};
