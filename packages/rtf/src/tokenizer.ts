/**
 * RTF Tokenizer — breaks raw RTF text into a stream of typed tokens.
 *
 * Token types:
 *   GroupStart  — `{`
 *   GroupEnd    — `}`
 *   ControlWord — `\keyword` with optional numeric parameter (e.g. `\b`, `\fs20`)
 *   ControlSymbol — `\` followed by a non-alpha char (e.g. `\'`, `\~`, `\\`, `\{`, `\}`)
 *   Text       — literal text content
 */

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export const enum TokenType {
  GroupStart = 0,
  GroupEnd = 1,
  ControlWord = 2,
  ControlSymbol = 3,
  Text = 4,
}

export interface GroupStartToken {
  type: TokenType.GroupStart;
}

export interface GroupEndToken {
  type: TokenType.GroupEnd;
}

export interface ControlWordToken {
  type: TokenType.ControlWord;
  word: string;
  param: number | undefined;
}

export interface ControlSymbolToken {
  type: TokenType.ControlSymbol;
  symbol: string;
  /** For hex escapes (\'xx), the decoded byte value */
  byte: number | undefined;
}

export interface TextToken {
  type: TokenType.Text;
  text: string;
}

export type Token =
  | GroupStartToken
  | GroupEndToken
  | ControlWordToken
  | ControlSymbolToken
  | TextToken;

// ---------------------------------------------------------------------------
// Reusable singleton tokens
// ---------------------------------------------------------------------------

const GROUP_START: GroupStartToken = { type: TokenType.GroupStart };
const GROUP_END: GroupEndToken = { type: TokenType.GroupEnd };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize an RTF string into an array of tokens.
 *
 * The tokenizer is intentionally simple — it does not interpret destination
 * groups, just structural grouping, control words/symbols, and text runs.
 */
export const tokenize = (rtf: string): Token[] => {
  const tokens: Token[] = [];
  const len = rtf.length;
  let i = 0;

  while (i < len) {
    const ch = rtf[i];

    if (ch === '{') {
      tokens.push(GROUP_START);
      i++;
      continue;
    }

    if (ch === '}') {
      tokens.push(GROUP_END);
      i++;
      continue;
    }

    if (ch === '\\') {
      i++; // consume backslash
      if (i >= len) break;

      const next = rtf[i];

      // Hex escape: \'xx
      if (next === "'") {
        i++; // consume apostrophe
        const hex = rtf.substring(i, i + 2);
        i += 2;
        const byte = parseInt(hex, 16);
        tokens.push({
          type: TokenType.ControlSymbol,
          symbol: "'",
          byte: isNaN(byte) ? undefined : byte,
        });
        continue;
      }

      // Control symbol: non-alpha character after backslash
      if (!(next >= 'a' && next <= 'z') && !(next >= 'A' && next <= 'Z')) {
        tokens.push({
          type: TokenType.ControlSymbol,
          symbol: next,
          byte: undefined,
        });
        i++;
        continue;
      }

      // Control word: \keyword[N]
      let wordStart = i;
      while (
        i < len &&
        ((rtf[i] >= 'a' && rtf[i] <= 'z') ||
          (rtf[i] >= 'A' && rtf[i] <= 'Z'))
      ) {
        i++;
      }
      const word = rtf.substring(wordStart, i);

      // Optional numeric parameter (may include leading minus)
      let param: number | undefined;
      if (
        i < len &&
        (rtf[i] === '-' || (rtf[i] >= '0' && rtf[i] <= '9'))
      ) {
        const numStart = i;
        if (rtf[i] === '-') i++;
        while (i < len && rtf[i] >= '0' && rtf[i] <= '9') {
          i++;
        }
        param = parseInt(rtf.substring(numStart, i), 10);
      }

      // Consume optional trailing space delimiter (RTF spec)
      if (i < len && rtf[i] === ' ') {
        i++;
      }

      tokens.push({ type: TokenType.ControlWord, word, param });
      continue;
    }

    // Text: collect until we hit a special character
    // Skip \r and \n — RTF ignores bare CR/LF outside control words
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    const textStart = i;
    while (
      i < len &&
      rtf[i] !== '{' &&
      rtf[i] !== '}' &&
      rtf[i] !== '\\' &&
      rtf[i] !== '\r' &&
      rtf[i] !== '\n'
    ) {
      i++;
    }
    tokens.push({ type: TokenType.Text, text: rtf.substring(textStart, i) });
  }

  return tokens;
};
