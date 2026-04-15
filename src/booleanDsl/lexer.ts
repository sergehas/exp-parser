import { ParseDiagnostic } from "./types";

export enum TokenType {
  Identifier = "Identifier",
  And = "And",
  Or = "Or",
  LParen = "LParen",
  RParen = "RParen",
  Eof = "Eof",
}

export interface Token {
  readonly type: TokenType;
  readonly value?: string;
  readonly start: number;
  readonly end: number;
}

export interface LexResult {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly ParseDiagnostic[];
}

const IDENTIFIER_PATTERN = /[A-Za-z_][A-Za-z0-9_]*/y;

/**
 * Lexes a boolean expression into tokens with source locations.
 */
export function tokenize(input: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let index = 0;

  while (index < input.length) {
    const current = input[index];
    if (current === undefined) {
      break;
    }

    if (/\s/.test(current)) {
      index += 1;
      continue;
    }

    if (current === "(") {
      tokens.push({ type: TokenType.LParen, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (current === ")") {
      tokens.push({ type: TokenType.RParen, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    IDENTIFIER_PATTERN.lastIndex = index;
    const match = IDENTIFIER_PATTERN.exec(input);
    if (match?.[0] !== undefined) {
      const raw = match[0];
      const upper = raw.toUpperCase();
      const tokenType =
        upper === "AND"
          ? TokenType.And
          : upper === "OR"
            ? TokenType.Or
            : TokenType.Identifier;

      tokens.push({
        type: tokenType,
        value: tokenType === TokenType.Identifier ? raw : undefined,
        start: index,
        end: index + raw.length,
      });
      index += raw.length;
      continue;
    }

    diagnostics.push({
      message: `Unexpected token '${current}'.`,
      span: { start: index, end: index + 1 },
    });
    index += 1;
  }

  tokens.push({ type: TokenType.Eof, start: input.length, end: input.length });

  return {
    tokens,
    diagnostics,
  };
}
