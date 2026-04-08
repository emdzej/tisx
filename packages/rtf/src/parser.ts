/**
 * RTF Parser — walks the token stream and builds a document tree.
 *
 * Uses a stack-based state machine to track formatting context through
 * RTF groups. Produces a flat list of document nodes (paragraphs, table
 * structures, images, cross-references) that the emitter walks to produce HTML.
 */

import {
  type Token,
  TokenType,
  type ControlWordToken,
  type ControlSymbolToken,
} from './tokenizer.js';

// ---------------------------------------------------------------------------
// Document node types
// ---------------------------------------------------------------------------

export const enum NodeType {
  Paragraph = 0,
  TextRun = 1,
  LineBreak = 2,
  Tab = 3,
  Image = 4,
  TableRowStart = 5,
  TableCellStart = 6,
  TableCellEnd = 7,
  TableRowEnd = 8,
}

/** Inline formatting state */
export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  hidden: boolean;
  superscript: number; // \up N (0 = none)
  fontSize: number; // half-points (default 24 = 12pt)
  font: number; // 0 = Helvetica, 1 = Symbol
}

export interface ParagraphNode {
  type: NodeType.Paragraph;
  inTable: boolean;
  leftIndent: number; // twips
  rightIndent: number;
  firstLineIndent: number;
  spaceBefore: number; // twips
  spaceAfter: number;
}

export interface TextRunNode {
  type: NodeType.TextRun;
  text: string;
  format: FormatState;
}

export interface LineBreakNode {
  type: NodeType.LineBreak;
}

export interface TabNode {
  type: NodeType.Tab;
}

export interface ImageNode {
  type: NodeType.Image;
  imageId: string; // e.g. "1/03/47/65.png"
}

export interface TableRowStartNode {
  type: NodeType.TableRowStart;
  cellWidths: number[]; // \cellxN right boundaries in twips
  leftIndent: number; // \trleftN in twips (default 0)
}

export interface TableCellStartNode {
  type: NodeType.TableCellStart;
}

export interface TableCellEndNode {
  type: NodeType.TableCellEnd;
}

export interface TableRowEndNode {
  type: NodeType.TableRowEnd;
}

export type DocNode =
  | ParagraphNode
  | TextRunNode
  | LineBreakNode
  | TabNode
  | ImageNode
  | TableRowStartNode
  | TableCellStartNode
  | TableCellEndNode
  | TableRowEndNode;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface ParserState {
  format: FormatState;
  inTable: boolean;
  /** Accumulated hidden text buffer (for \v groups) */
  hiddenBuf: string;
  /** Whether we're inside a \fonttbl destination (skip content) */
  inFontTable: boolean;
  /** Whether we're inside a \colortbl destination (skip content) */
  inColorTable: boolean;
  /** Whether we're inside a \stylesheet destination (skip content) */
  inStyleSheet: boolean;
  /** Whether we're inside an \info destination (skip content) */
  inInfo: boolean;
  /** Paragraph state */
  leftIndent: number;
  rightIndent: number;
  firstLineIndent: number;
  spaceBefore: number;
  spaceAfter: number;
}

const defaultFormat = (): FormatState => ({
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  hidden: false,
  superscript: 0,
  fontSize: 24,
  font: 0,
});

const cloneFormat = (f: FormatState): FormatState => ({ ...f });

const cloneState = (s: ParserState): ParserState => ({
  ...s,
  format: cloneFormat(s.format),
});

const defaultState = (): ParserState => ({
  format: defaultFormat(),
  inTable: false,
  hiddenBuf: '',
  inFontTable: false,
  inColorTable: false,
  inStyleSheet: false,
  inInfo: false,
  leftIndent: 0,
  rightIndent: 0,
  firstLineIndent: 0,
  spaceBefore: 0,
  spaceAfter: 0,
});

// ---------------------------------------------------------------------------
// TIS-specific: GRAFIK path → image ID
// ---------------------------------------------------------------------------

const parseGrafikPath = (hidden: string): string | null => {
  const match = hidden.match(/N:GRAFIK\\([^;]+\.itw)/i);
  if (!match) return null;
  return match[1].replace(/\\/g, '/').replace(/\.itw$/i, '.png');
};

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export interface ParseOptions {
  /** Text placeholder substitutions (e.g. { '--TYP--': 'E46' }) */
  textPlaceholders?: Record<string, string>;
}

/**
 * Parse an RTF token stream into a document node list.
 */
export const parse = (tokens: Token[], options?: ParseOptions): DocNode[] => {
  const nodes: DocNode[] = [];
  const stateStack: ParserState[] = [];
  let state = defaultState();

  const placeholders = options?.textPlaceholders ?? {};

  // Track whether we've emitted an opening paragraph
  let paragraphOpen = false;
  // Track table row cell boundaries for current row
  let currentCellWidths: number[] = [];
  // Track whether we're collecting hidden text
  let collectingHidden = false;
  // Buffer for text following a hidden-text GRAFIK sentinel
  let grafikTextBuf = '';
  let expectGrafikText = false;
  // Deferred row start: set to true when \trowd is seen, emitted lazily
  // when content arrives (so that \cellx widths are collected first)
  let pendingRowStart = false;
  // Track \trleft for the pending row
  let pendingRowLeftIndent = 0;

  /** Flush pending table row start — called before any cell content */
  const flushPendingRow = () => {
    if (pendingRowStart) {
      nodes.push({
        type: NodeType.TableRowStart,
        cellWidths: [...currentCellWidths],
        leftIndent: pendingRowLeftIndent,
      });
      nodes.push({ type: NodeType.TableCellStart });
      pendingRowStart = false;
    }
  };

  /** Ensure a paragraph node is emitted before text content */
  const ensureParagraph = () => {
    // If there's a deferred row start and we're about to emit table content,
    // flush the row start first
    if (state.inTable) {
      flushPendingRow();
    }
    if (!paragraphOpen) {
      nodes.push({
        type: NodeType.Paragraph,
        inTable: state.inTable,
        leftIndent: state.leftIndent,
        rightIndent: state.rightIndent,
        firstLineIndent: state.firstLineIndent,
        spaceBefore: state.spaceBefore,
        spaceAfter: state.spaceAfter,
      });
      paragraphOpen = true;
    }
  };

  /** Substitute text placeholders and emit a text run */
  const emitText = (raw: string) => {
    if (!raw) return;

    // Apply placeholder substitutions
    let text = raw;
    for (const [placeholder, value] of Object.entries(placeholders)) {
      if (text.includes(placeholder)) {
        text = text.split(placeholder).join(value);
      }
    }

    // Symbol font bullet substitution: \f1 \'b7 → bullet character
    if (state.format.font === 1) {
      text = text.replace(/\xB7/g, '\u2022'); // middle dot → bullet
    }

    ensureParagraph();
    nodes.push({
      type: NodeType.TextRun,
      text,
      format: cloneFormat(state.format),
    });
  };

  const isSkipDestination = (s: ParserState): boolean =>
    s.inFontTable || s.inColorTable || s.inStyleSheet || s.inInfo;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    switch (tok.type) {
      case TokenType.GroupStart: {
        stateStack.push(cloneState(state));
        break;
      }

      case TokenType.GroupEnd: {
        const prev = stateStack.pop();

        // If we were collecting hidden text, process the GRAFIK reference
        if (collectingHidden && !state.format.hidden) {
          // Hidden text ended in a previous group; should already be processed
        }
        if (state.format.hidden && prev && !prev.format.hidden) {
          // Exiting hidden text group
          const hidden = state.hiddenBuf;
          if (hidden.includes('N:GRAFIK') || hidden.includes('.Z.')) {
            // Check if this hidden text has a GRAFIK path
            const imageId = parseGrafikPath(hidden);
            if (imageId) {
              ensureParagraph();
              nodes.push({ type: NodeType.Image, imageId });
            }
            // If .Z. but no GRAFIK yet, the GRAFIK text follows outside \v
            if (hidden.includes('.Z.') && !imageId) {
              expectGrafikText = true;
              grafikTextBuf = '';
            }
          }
          collectingHidden = false;
        }

        if (prev) {
          state = prev;
        }
        break;
      }

      case TokenType.ControlWord: {
        if (isSkipDestination(state)) break;

        const cw = tok as ControlWordToken;
        handleControlWord(cw, state, nodes, () => {
          paragraphOpen = false;
        }, currentCellWidths);

        // Track destination groups that should be skipped
        if (cw.word === 'fonttbl') state.inFontTable = true;
        if (cw.word === 'colortbl') state.inColorTable = true;
        if (cw.word === 'stylesheet') state.inStyleSheet = true;
        if (cw.word === 'info') state.inInfo = true;

        // Track hidden text state
        if (cw.word === 'v') {
          if (cw.param === 0) {
            // \v0 — turn off hidden
            state.format.hidden = false;
          } else {
            // \v or \v1 — turn on hidden
            state.format.hidden = true;
            collectingHidden = true;
            state.hiddenBuf = '';
          }
        }

        // \plain resets formatting
        if (cw.word === 'plain') {
          // If hidden text was active, process the buffer before resetting
          if (state.format.hidden && collectingHidden) {
            const hidden = state.hiddenBuf;
            if (hidden.includes('.Z.')) {
              // .Z. sentinel found — GRAFIK path follows as visible text
              expectGrafikText = true;
              grafikTextBuf = '';
            } else if (hidden.includes('N:GRAFIK')) {
              const imageId = parseGrafikPath(hidden);
              if (imageId) {
                ensureParagraph();
                nodes.push({ type: NodeType.Image, imageId });
              }
            }
            collectingHidden = false;
          }

          const wasInTable = state.inTable;
          state.format = defaultFormat();
          state.inTable = wasInTable;
        }

        // Table row definition: defer emission until \cellx widths collected
        if (cw.word === 'trowd') {
          currentCellWidths = [];
          pendingRowStart = true;
          pendingRowLeftIndent = 0;
        }

        // Track \trleft for deferred row start
        if (cw.word === 'trleft' && cw.param !== undefined) {
          pendingRowLeftIndent = cw.param;
        }

        // Collect cell widths
        if (cw.word === 'cellx' && cw.param !== undefined) {
          currentCellWidths.push(cw.param);
        }

        // \intbl marks content as inside a table
        if (cw.word === 'intbl') {
          state.inTable = true;
        }

        // \cell — end current cell
        if (cw.word === 'cell') {
          flushPendingRow(); // ensure row is started
          paragraphOpen = false;
          nodes.push({ type: NodeType.TableCellEnd });
        }

        // \row — end current row
        if (cw.word === 'row') {
          paragraphOpen = false;
          state.inTable = false;
          nodes.push({ type: NodeType.TableRowEnd });
        }

        break;
      }

      case TokenType.ControlSymbol: {
        if (isSkipDestination(state)) break;

        const cs = tok as ControlSymbolToken;

        if (cs.symbol === '~') {
          // Non-breaking space
          emitText('\u00A0');
        } else if (cs.symbol === '-') {
          // Optional hyphen — emit soft hyphen
          emitText('\u00AD');
        } else if (cs.symbol === '_') {
          // Non-breaking hyphen
          emitText('\u2011');
        } else if (cs.symbol === "'") {
          // Hex escape — decode as Latin-1 byte
          if (cs.byte !== undefined) {
            const char = String.fromCharCode(cs.byte);
            if (state.format.hidden) {
              state.hiddenBuf += char;
            } else if (expectGrafikText) {
              grafikTextBuf += char;
            } else {
              emitText(char);
            }
          }
        } else if (cs.symbol === '{' || cs.symbol === '}' || cs.symbol === '\\') {
          if (expectGrafikText) {
            grafikTextBuf += cs.symbol;
          } else {
            emitText(cs.symbol);
          }
        }
        // Other control symbols: \*, etc. — ignore
        break;
      }

      case TokenType.Text: {
        if (isSkipDestination(state)) break;

        const text = tok.text;

        if (state.format.hidden) {
          // Accumulate hidden text for GRAFIK detection
          state.hiddenBuf += text;
          break;
        }

        if (expectGrafikText) {
          // Text following a .Z. hidden sentinel — should be N:GRAFIK\...
          grafikTextBuf += text;
          // Check if we have the complete GRAFIK reference (ends with format;)
          if (grafikTextBuf.includes('.itw;')) {
            const imageId = parseGrafikPath(grafikTextBuf);
            if (imageId) {
              ensureParagraph();
              nodes.push({ type: NodeType.Image, imageId });
            }
            expectGrafikText = false;
            grafikTextBuf = '';
          }
          break;
        }

        emitText(text);
        break;
      }
    }
  }

  return normalizeNodes(nodes);
};

// ---------------------------------------------------------------------------
// Control word handler
// ---------------------------------------------------------------------------

const handleControlWord = (
  cw: ControlWordToken,
  state: ParserState,
  nodes: DocNode[],
  resetParagraph: () => void,
  currentCellWidths: number[],
): void => {
  const { word, param } = cw;

  switch (word) {
    // Formatting
    case 'b':
      state.format.bold = param !== 0;
      break;
    case 'i':
      state.format.italic = param !== 0;
      break;
    case 'ul':
    case 'uld':
    case 'uldb':
    case 'ulw':
      state.format.underline = param !== 0;
      break;
    case 'ulnone':
      state.format.underline = false;
      break;
    case 'strike':
      state.format.strike = param !== 0;
      break;
    case 'up':
      state.format.superscript = param ?? 6;
      break;
    case 'dn':
      // subscript — treat as negative superscript
      state.format.superscript = -(param ?? 6);
      break;
    case 'nosupersub':
      state.format.superscript = 0;
      break;
    case 'fs':
      state.format.fontSize = param ?? 24;
      break;
    case 'f':
      state.format.font = param ?? 0;
      break;

    // Paragraph breaks
    case 'par':
      resetParagraph();
      break;

    // Line break (no paragraph spacing)
    case 'line':
      nodes.push({ type: NodeType.LineBreak });
      break;

    // Tab
    case 'tab':
      nodes.push({ type: NodeType.Tab });
      break;

    // Paragraph formatting
    case 'pard':
      // Reset paragraph formatting (but not character formatting)
      state.leftIndent = 0;
      state.rightIndent = 0;
      state.firstLineIndent = 0;
      state.spaceBefore = 0;
      state.spaceAfter = 0;
      state.inTable = false;
      break;
    case 'li':
      state.leftIndent = param ?? 0;
      break;
    case 'ri':
      state.rightIndent = param ?? 0;
      break;
    case 'fi':
      state.firstLineIndent = param ?? 0;
      break;
    case 'sb':
      state.spaceBefore = param ?? 0;
      break;
    case 'sa':
      state.spaceAfter = param ?? 0;
      break;

    // Table row start — handled by deferred emission in main loop
    // \trowd sets pendingRowStart=true, emission happens when content arrives
    case 'trowd':
      break;

    // \cell already handled in main switch (emits TableCellEnd + starts new cell)
    case 'cell':
      // Handled in main loop — this is just here to suppress unknown word warnings
      break;

    default:
      // Unknown control word — ignore silently
      break;
  }
};

// ---------------------------------------------------------------------------
// Post-parse normalization
// ---------------------------------------------------------------------------

/**
 * Clean up the node list:
 * - Ensure TableCellStart appears after each TableCellEnd (except before TableRowEnd)
 * - Remove empty paragraphs at very end
 * - Populate TableRowStart cellWidths retroactively when \trowd comes before \cellx
 */
const normalizeNodes = (nodes: DocNode[]): DocNode[] => {
  const result: DocNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    result.push(node);

    // After a TableCellEnd, insert a TableCellStart if the next meaningful
    // node is not a TableRowEnd or another TableCellStart
    if (node.type === NodeType.TableCellEnd) {
      // Look ahead to see what follows
      let j = i + 1;
      while (
        j < nodes.length &&
        nodes[j].type === NodeType.Paragraph
      ) {
        j++;
      }
      const next = j < nodes.length ? nodes[j] : null;
      if (
        next &&
        next.type !== NodeType.TableRowEnd &&
        next.type !== NodeType.TableCellStart &&
        next.type !== NodeType.TableCellEnd
      ) {
        result.push({ type: NodeType.TableCellStart });
      }
    }
  }

  return result;
};
