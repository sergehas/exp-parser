import { SyntaxMode } from "./detect";
import { ParseDiagnostic, VariableSign } from "./types";

/** Token categories in the lexer output. */
export enum TokenType {
  Variable = "Variable",
  In = "In",
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
  readonly values?: readonly string[];
  readonly start: number;
  readonly end: number;
}

/** Result of tokenization, containing tokens and any parsing diagnostics. */
export interface LexResult {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly ParseDiagnostic[];
}

const KEYWORD_PATTERN = /and|or/iy;
const VARIABLE_PATTERN = /[+-][a-z0-9]{4,5}/iy;
const EXPLICIT_VARIABLE_PATTERN = /[a-z0-9]{3}[:!][a-z0-9]{1,2}/iy;
const IN_EXPRESSION_PATTERN = /[a-z0-9]{3}[:!]\([^)]*\)/iy;

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
 * Parses an explicit-syntax variable token (CODE:VALUE or CODE!VALUE) into its components.
 *
 * @param raw Variable token text in explicit form.
 * @returns Parsed sign, code, and value segments.
 */
function parseExplicitVariable(raw: string): { sign: VariableSign; code: string; value: string } {
  const code = raw.slice(0, 3).toUpperCase();
  const sign = raw[3] === ":" ? VariableSign.Equals : VariableSign.NotEquals;
  const value = raw.slice(4).toUpperCase();
  return { sign, code, value };
}

/**
 * Parses an IN-expression token (CODE:(V1 V2) or CODE!(V1 V2)) into its components.
 *
 * @param raw Full IN-expression text including parentheses.
 * @returns Parsed sign, code, and array of values.
 */
function parseInExpression(raw: string): { sign: VariableSign; code: string; values: string[] } {
  const code = raw.slice(0, 3).toUpperCase();
  const sign = raw[3] === ":" ? VariableSign.Equals : VariableSign.NotEquals;
  const inner = raw.slice(5, -1);
  const values = inner
    .split(/\s+/)
    .filter((v) => v.length > 0)
    .map((v) => v.toUpperCase());
  return { sign, code, values };
}

/**
 * Attempts to match and tokenize a parenthesis ('(' or ')') at the given index.
 *
 * @param input The input string to tokenize.
 * @param index The current position in the input string.
 * @param tokens The array where matched tokens are added.
 * @returns The new index after consuming the parenthesis, or the original index if no parenthesis was found.
 */
function tryMatchParenthesis(input: string, index: number, tokens: Token[]): number {
  const ch = input[index];
  if (ch === "(") {
    tokens.push({ type: TokenType.LParen, start: index, end: index + 1 });
    return index + 1;
  }
  if (ch === ")") {
    tokens.push({ type: TokenType.RParen, start: index, end: index + 1 });
    return index + 1;
  }
  return index;
}

/**
 * Attempts to match and tokenize an IN expression at the given index.
 *
 * @param input The input string to tokenize.
 * @param index The current position in the input string.
 * @param tokens The array where matched tokens are added.
 * @param diagnostics The array where parsing diagnostics are added.
 * @returns The new index after consuming the IN expression, or the original index if no match was found.
 */
function tryMatchInExpression(
  input: string,
  index: number,
  tokens: Token[],
  diagnostics: ParseDiagnostic[]
): number {
  IN_EXPRESSION_PATTERN.lastIndex = index;
  const match = IN_EXPRESSION_PATTERN.exec(input);
  if (match) {
    const raw = match[0];
    const { sign, code, values } = parseInExpression(raw);
    if (values.length === 0) {
      diagnostics.push({
        message: "Empty IN expression.",
        span: { start: index, end: index + raw.length },
      });
    } else {
      tokens.push({
        type: TokenType.In,
        sign,
        code,
        values,
        start: index,
        end: index + raw.length,
      });
    }
    return index + raw.length;
  }
  return index;
}

/**
 * Attempts to match and tokenize an explicit variable at the given index.
 *
 * @param input The input string to tokenize.
 * @param index The current position in the input string.
 * @param tokens The array where matched tokens are added.
 * @returns The new index after consuming the variable, or the original index if no match was found.
 */
function tryMatchVariable(input: string, index: number, tokens: Token[]): number {
  EXPLICIT_VARIABLE_PATTERN.lastIndex = index;
  const match = EXPLICIT_VARIABLE_PATTERN.exec(input);
  if (match) {
    const raw = match[0];
    const { sign, code, value } = parseExplicitVariable(raw);
    tokens.push({
      type: TokenType.Variable,
      sign,
      code,
      value,
      start: index,
      end: index + raw.length,
    });
    return index + raw.length;
  }
  return index;
}

/**
 * Attempts to match and tokenize a keyword ('and' or 'or') at the given index.
 *
 * @param input The input string to tokenize.
 * @param index The current position in the input string.
 * @param tokens The array where matched tokens are added.
 * @returns The new index after consuming the keyword, or the original index if no match was found.
 */
function tryMatchKeyword(input: string, index: number, tokens: Token[]): number {
  KEYWORD_PATTERN.lastIndex = index;
  const match = KEYWORD_PATTERN.exec(input);
  if (match) {
    const raw = match[0];
    const upper = raw.toUpperCase();
    tokens.push({
      type: upper === "AND" ? TokenType.And : TokenType.Or,
      start: index,
      end: index + raw.length,
    });
    return index + raw.length;
  }
  return index;
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

    let newIndex = tryMatchParenthesis(input, index, tokens);
    if (newIndex > index) {
      index = newIndex;
      continue;
    }

    newIndex = tryMatchInExpression(input, index, tokens, diagnostics);
    if (newIndex > index) {
      index = newIndex;
      continue;
    }

    newIndex = tryMatchVariable(input, index, tokens);
    if (newIndex > index) {
      index = newIndex;
      continue;
    }

    newIndex = tryMatchKeyword(input, index, tokens);
    if (newIndex > index) {
      index = newIndex;
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
