/**
 * @emdzej/tisx-rtf — Custom RTF-to-HTML renderer for BMW TIS documents.
 *
 * Replaces the pandoc-based pipeline with a purpose-built renderer that
 * natively handles TIS-specific RTF extensions:
 *
 * - GRAFIK image references (\v hidden text + N:GRAFIK\path)
 * - Cross-reference hotspot links (\strike → <a class="tis-cross-ref">)
 * - Vehicle text placeholders (--TYP--, --FGSTNR--, etc.)
 * - Symbol font bullet substitution (\f1 \'b7 → bullet)
 * - Layout tables with tis-img-cell / tis-text-cell classes
 *
 * Usage:
 *   import { rtfToHtml } from '@emdzej/tisx-rtf';
 *   const html = rtfToHtml(rtfContent, { textPlaceholders: { '--TYP--': 'E46' } });
 */

import { tokenize } from './tokenizer.js';
import { parse, type ParseOptions } from './parser.js';
import { emit, type EmitOptions } from './emitter.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RtfToHtmlOptions {
  /** Text placeholder substitutions (e.g. { '--TYP--': 'E46' }) */
  textPlaceholders?: Record<string, string>;
  /** Base URL for image src attributes (default: "/api/images") */
  imageBaseUrl?: string;
}

/**
 * Convert RTF content to HTML.
 *
 * Single-pass pipeline: tokenize → parse → emit.
 * No external dependencies.
 */
export const rtfToHtml = (
  rtfContent: string,
  options?: RtfToHtmlOptions,
): string => {
  const tokens = tokenize(rtfContent);

  const parseOpts: ParseOptions = {
    textPlaceholders: options?.textPlaceholders,
  };
  const nodes = parse(tokens, parseOpts);

  const emitOpts: EmitOptions = {
    imageBaseUrl: options?.imageBaseUrl,
  };
  return emit(nodes, emitOpts);
};

// ---------------------------------------------------------------------------
// Re-exports for advanced use / testing
// ---------------------------------------------------------------------------

export { tokenize, type Token, TokenType } from './tokenizer.js';
export {
  parse,
  type DocNode,
  NodeType,
  type FormatState,
  type ParseOptions,
} from './parser.js';
export { emit, type EmitOptions } from './emitter.js';
