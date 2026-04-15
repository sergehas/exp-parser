import { Token, TokenType, tokenize } from "./lexer";
import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  ParseDiagnostic,
  SourceSpan,
  isBinaryExpr,
} from "./types";

export interface ParseResult {
  readonly expression: BoolExpr | null;
  readonly diagnostics: readonly ParseDiagnostic[];
}

const PRECEDENCE: Readonly<Record<TokenType, number>> = {
  [TokenType.Identifier]: 0,
  [TokenType.And]: 20,
  [TokenType.Or]: 10,
  [TokenType.LParen]: 0,
  [TokenType.RParen]: 0,
  [TokenType.Eof]: 0,
};

class Parser {
  private readonly _tokens: readonly Token[];

  private readonly _diagnostics: ParseDiagnostic[];

  private _index: number;

  public constructor(tokens: readonly Token[], diagnostics: ParseDiagnostic[]) {
    this._tokens = tokens;
    this._diagnostics = diagnostics;
    this._index = 0;
  }

  public get diagnostics(): readonly ParseDiagnostic[] {
    return this._diagnostics;
  }

  public parse(): BoolExpr | null {
    const expression = this.parseExpression(0);
    if (expression === null) {
      return null;
    }

    const token = this.current();
    if (token.type !== TokenType.Eof) {
      this._diagnostics.push({
        message: "Unexpected trailing token.",
        span: { start: token.start, end: token.end },
      });
      return null;
    }

    return expression;
  }

  private parseExpression(minBindingPower: number): BoolExpr | null {
    let left = this.parsePrefix();
    if (left === null) {
      return null;
    }

    while (true) {
      const token = this.current();
      const bindingPower = PRECEDENCE[token.type];
      if (bindingPower < minBindingPower) {
        break;
      }

      if (token.type !== TokenType.And && token.type !== TokenType.Or) {
        break;
      }

      this.advance();
      const right = this.parseExpression(bindingPower + 1);
      if (right === null) {
        return null;
      }

      const operator =
        token.type === TokenType.And ? BinaryOperator.And : BinaryOperator.Or;
      left = {
        kind: ExprKind.Binary,
        operator,
        left,
        right,
        span: mergeSpan(left.span, right.span),
      };
    }

    return left;
  }

  private parsePrefix(): BoolExpr | null {
    const token = this.current();

    if (token.type === TokenType.Identifier) {
      this.advance();
      return {
        kind: ExprKind.Variable,
        name: token.value ?? "",
        span: { start: token.start, end: token.end },
      };
    }

    if (token.type === TokenType.LParen) {
      const start = token.start;
      this.advance();
      const expression = this.parseExpression(0);
      if (expression === null) {
        return null;
      }

      const closing = this.current();
      if (closing.type !== TokenType.RParen) {
        this._diagnostics.push({
          message: "Missing closing parenthesis.",
          span: { start: closing.start, end: closing.end },
        });
        return null;
      }

      this.advance();
      return {
        ...expression,
        span: {
          start,
          end: closing.end,
        },
      };
    }

    this._diagnostics.push({
      message: "Expected identifier or '('.",
      span: { start: token.start, end: token.end },
    });
    return null;
  }

  private current(): Token {
    return this._tokens[this._index] ?? this._tokens[this._tokens.length - 1];
  }

  private advance(): void {
    if (this._index < this._tokens.length - 1) {
      this._index += 1;
    }
  }
}

export function parseExpression(input: string): ParseResult {
  const lex = tokenize(input);
  const diagnostics: ParseDiagnostic[] = [...lex.diagnostics];
  if (lex.diagnostics.length > 0) {
    return { expression: null, diagnostics };
  }

  const parser = new Parser(lex.tokens, diagnostics);
  const expression = parser.parse();
  return {
    expression,
    diagnostics: parser.diagnostics,
  };
}

export function stringifyExpression(expression: BoolExpr): string {
  return stringify(expression, 0);
}

function stringify(expression: BoolExpr, parentPrecedence: number): string {
  if (!isBinaryExpr(expression)) {
    return expression.name;
  }

  const currentPrecedence =
    expression.operator === BinaryOperator.And ? 20 : 10;
  const left = stringify(expression.left, currentPrecedence);
  const right = stringify(expression.right, currentPrecedence + 1);
  const content = `${left} ${expression.operator} ${right}`;
  if (currentPrecedence < parentPrecedence) {
    return `(${content})`;
  }

  return content;
}

function mergeSpan(left: SourceSpan, right: SourceSpan): SourceSpan {
  return {
    start: Math.min(left.start, right.start),
    end: Math.max(left.end, right.end),
  };
}
