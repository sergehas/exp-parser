import { SyntaxMode } from "./detect";
import { ParseDiagnostic, VariableSign } from "./types";

/** Token categories in the lexer output. */
export enum TokenType {
  Variable = "Variable",
  And = "And",
  Or = "Or",
  LParen = "LParen",
  RParen = "RParen",
  Newline = "Newline",
  Eof = "Eof",
}

/** A single token with type, optional variable components, and source location. */
export interface Token {
  readonly type: TokenType;
  readonly sign?: VariableSign;
  readonly code?: string;
  readonly value?: string;
  readonly start: number;
  readonly end: number;
}

/** Result of tokenization, containing tokens and any parsing diagnostics. */
export interface LexResult {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly ParseDiagnostic[];
}

const KEYWORD_PATTERN = /and|or/iy;
const VARIABLE_PATTERN = /[+-][A-Za-z0-9]{4,5}/y;

/**
 * Parses a sign+code+value token string into its components.
 * The raw string must be 5-6 chars: [+-] + 3-char code + 1-2 char value.
 *
 * @param raw Variable token text in condensed form.
 * @returns Parsed sign, code, and value segments.
 */
function parseVariable(raw: string): { sign: VariableSign; code: string; value: string } {
  const sign = raw.startsWith("+") ? VariableSign.Equals : VariableSign.NotEquals;
  const body = raw.slice(1).toUpperCase();
  const code = body.slice(0, 3);
  const value = body.slice(3);
  return { sign, code, value };
}

/**
 * Tokenizes input using explicit syntax rules (keywords and parentheses supported).
 *
 * @param input Raw expression text.
 * @returns Tokens and diagnostics produced during explicit-mode lexing.
 */
function tokenizeExplicit(input: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let index = 0;

  while (index < input.length) {
    const ch = input[index];

    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: TokenType.LParen, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: TokenType.RParen, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    KEYWORD_PATTERN.lastIndex = index;
    const kwMatch = KEYWORD_PATTERN.exec(input);
    if (kwMatch) {
      const raw = kwMatch[0];
      const upper = raw.toUpperCase();
      tokens.push({
        type: upper === "AND" ? TokenType.And : TokenType.Or,
        start: index,
        end: index + raw.length,
      });
      index += raw.length;
      continue;
    }

    VARIABLE_PATTERN.lastIndex = index;
    const varMatch = VARIABLE_PATTERN.exec(input);
    if (varMatch) {
      const raw = varMatch[0];
      const { sign, code, value } = parseVariable(raw);
      tokens.push({
        type: TokenType.Variable,
        sign,
        code,
        value,
        start: index,
        end: index + raw.length,
      });
      index += raw.length;
      continue;
    }

    diagnostics.push({
      message: `Unexpected token '${ch}'.`,
      span: { start: index, end: index + 1 },
    });
    index += 1;
  }

  tokens.push({ type: TokenType.Eof, start: input.length, end: input.length });
  return { tokens, diagnostics };
}

/**
 * Tokenizes input using condensed syntax rules (line-based conjunction/disjunction input).
 *
 * @param input Raw expression text.
 * @returns Tokens and diagnostics produced during condensed-mode lexing.
 */
function tokenizeCondensed(input: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let index = 0;
  let lineHasTokens = false;

  while (index < input.length) {
    const ch = input[index];

    // Handle newlines (\r\n or \n)
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && input[index + 1] === "\n") {
        index += 2;
      } else {
        index += 1;
      }
      // Only emit Newline if current line had tokens (skip blank lines)
      if (lineHasTokens) {
        tokens.push({ type: TokenType.Newline, start: index - 1, end: index });
        lineHasTokens = false;
      }
      continue;
    }

    // Skip spaces/tabs (collapse multiple)
    if (ch === " " || ch === "\t") {
      index += 1;
      continue;
    }

    VARIABLE_PATTERN.lastIndex = index;
    const varMatch = VARIABLE_PATTERN.exec(input);
    if (varMatch) {
      const raw = varMatch[0];
      const { sign, code, value } = parseVariable(raw);
      tokens.push({
        type: TokenType.Variable,
        sign,
        code,
        value,
        start: index,
        end: index + raw.length,
      });
      index += raw.length;
      lineHasTokens = true;
      continue;
    }

    diagnostics.push({
      message: `Unexpected token '${ch}'.`,
      span: { start: index, end: index + 1 },
    });
    index += 1;
  }

  tokens.push({ type: TokenType.Eof, start: input.length, end: input.length });
  return { tokens, diagnostics };
}

/**
 * Lexes a boolean expression into tokens with source locations.
 *
 * @param input Raw expression text.
 * @param mode Syntax mode used to choose explicit or condensed tokenization rules.
 * @returns Token stream and diagnostics gathered during lexing.
 */
export function tokenize(input: string, mode: SyntaxMode): LexResult {
  return mode === SyntaxMode.Explicit ? tokenizeExplicit(input) : tokenizeCondensed(input);
}
