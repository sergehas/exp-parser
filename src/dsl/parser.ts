import { SyntaxMode, detectSyntax } from "./detect";
import { Token, TokenType, tokenize } from "./lexer";
import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  ParseDiagnostic,
  SourceSpan,
  VariableSign,
  isBinaryExpr,
} from "./types";

/** Result of parsing an expression string, containing the AST or null on error. */
export interface ParseResult {
  readonly expression: BoolExpr | null;
  readonly diagnostics: readonly ParseDiagnostic[];
}

// ---------------------------------------------------------------------------
// Pratt parser for explicit syntax
// ---------------------------------------------------------------------------

const PRECEDENCE: Readonly<Record<TokenType, number>> = {
  [TokenType.Variable]: 0,
  [TokenType.And]: 20,
  [TokenType.Or]: 10,
  [TokenType.LParen]: 0,
  [TokenType.RParen]: 0,
  [TokenType.Newline]: 0,
  [TokenType.Eof]: 0,
};

/** Parser for explicit-syntax token streams based on Pratt parsing. */
class ExplicitParser {
  private readonly _tokens: readonly Token[];
  private readonly _diagnostics: ParseDiagnostic[];
  private _index: number;

  /**
   * Creates an explicit-mode parser instance.
   *
   * @param tokens Lexer token stream.
   * @param diagnostics Diagnostic sink shared with caller.
   */
  constructor(tokens: readonly Token[], diagnostics: ParseDiagnostic[]) {
    this._tokens = tokens;
    this._diagnostics = diagnostics;
    this._index = 0;
  }

  /**
   * Exposes parser diagnostics accumulated during parsing.
   *
   * @returns Current diagnostic collection.
   */
  get diagnostics(): readonly ParseDiagnostic[] {
    return this._diagnostics;
  }

  /**
   * Parses a full explicit expression from tokens.
   *
   * @returns Parsed expression or null when diagnostics were produced.
   */
  parse(): BoolExpr | null {
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

  /**
   * Parses an expression using Pratt parsing and precedence climbing.
   *
   * @param minBindingPower Minimum binding power required to continue parsing.
   * @returns Parsed expression subtree or null on error.
   */
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

      const operator = token.type === TokenType.And ? BinaryOperator.And : BinaryOperator.Or;
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

  /**
   * Parses prefix expressions (variable or parenthesized expression).
   *
   * @returns Prefix expression node or null on error.
   */
  private parsePrefix(): BoolExpr | null {
    const token = this.current();

    if (token.type === TokenType.Variable) {
      this.advance();
      return {
        kind: ExprKind.Variable,
        sign: token.sign ?? VariableSign.Equals,
        code: token.code ?? "",
        value: token.value ?? "",
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
        span: { start, end: closing.end },
      };
    }

    this._diagnostics.push({
      message: "Expected variable or '('.",
      span: { start: token.start, end: token.end },
    });
    return null;
  }

  /**
   * Returns the current parser token.
   *
   * @returns Current token, or final token as a safe fallback.
   */
  private current(): Token {
    return this._tokens[this._index] ?? this._tokens.at(-1);
  }

  /** Advances parser position to the next token when possible. */
  private advance(): void {
    if (this._index < this._tokens.length - 1) {
      this._index += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Line-based parser for condensed syntax
// ---------------------------------------------------------------------------

/**
 * Parses condensed-mode tokens where each line is an AND-chain and lines are OR'ed.
 *
 * @param tokens Token stream from the lexer.
 * @param diagnostics Diagnostic sink for parse errors.
 * @returns Parsed expression or null on invalid input.
 */
function parseCondensed(tokens: readonly Token[], diagnostics: ParseDiagnostic[]): BoolExpr | null {
  const lines: Token[][] = [];
  let current: Token[] = [];

  for (const token of tokens) {
    if (token.type === TokenType.Newline) {
      if (current.length > 0) {
        lines.push(current);
        current = [];
      }
      continue;
    }
    if (token.type === TokenType.Eof) {
      break;
    }
    current.push(token);
  }
  if (current.length > 0) {
    lines.push(current);
  }

  if (lines.length === 0) {
    diagnostics.push({
      message: "Empty expression.",
      span: { start: 0, end: 0 },
    });
    return null;
  }

  const lineExprs: BoolExpr[] = [];
  for (const line of lines) {
    const expr = buildAndChain(line);
    if (expr === null) {
      diagnostics.push({
        message: "Empty line in expression.",
        span: { start: 0, end: 0 },
      });
      return null;
    }
    lineExprs.push(expr);
  }

  if (lineExprs.length === 1) {
    return lineExprs[0];
  }

  const [first, ...rest] = lineExprs;
  return rest.reduce<BoolExpr>(
    (acc, cur) => ({
      kind: ExprKind.Binary,
      operator: BinaryOperator.Or,
      left: acc,
      right: cur,
      span: mergeSpan(acc.span, cur.span),
    }),
    first
  );
}

/**
 * Builds an AND-only expression chain from variable tokens.
 *
 * @param tokens Tokens representing one condensed line.
 * @returns AND-chained expression or null when no tokens are present.
 */
function buildAndChain(tokens: Token[]): BoolExpr | null {
  if (tokens.length === 0) {
    return null;
  }

  const exprs: BoolExpr[] = tokens.map((t) => ({
    kind: ExprKind.Variable as const,
    sign: t.sign ?? VariableSign.Equals,
    code: t.code ?? "",
    value: t.value ?? "",
    span: { start: t.start, end: t.end },
  }));

  const [first, ...rest] = exprs;
  return rest.reduce<BoolExpr>(
    (acc, cur) => ({
      kind: ExprKind.Binary,
      operator: BinaryOperator.And,
      left: acc,
      right: cur,
      span: mergeSpan(acc.span, cur.span),
    }),
    first
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a boolean condition expression and auto-detects the syntax mode.
 *
 * @param input Expression text in either condensed or explicit syntax.
 * @returns Parse result containing the AST on success, or null expression with diagnostics on failure.
 */
export function parseExpression(input: string): ParseResult {
  const mode = detectSyntax(input);
  const lex = tokenize(input, mode);
  const diagnostics: ParseDiagnostic[] = [...lex.diagnostics];

  if (lex.diagnostics.length > 0) {
    return { expression: null, diagnostics };
  }

  const expression =
    mode === SyntaxMode.Explicit
      ? new ExplicitParser(lex.tokens, diagnostics).parse()
      : parseCondensed(lex.tokens, diagnostics);

  return { expression, diagnostics };
}

// ---------------------------------------------------------------------------
// Stringify
// ---------------------------------------------------------------------------

/**
 * Serializes a boolean expression AST back into text.
 *
 * @param expression Expression tree to serialize.
 * @param mode Output syntax mode.
 * @returns Stringified expression in explicit infix form or condensed multiline form.
 */
export function stringifyExpression(expression: BoolExpr, mode: SyntaxMode): string {
  return mode === SyntaxMode.Explicit
    ? stringifyExplicit(expression, 0)
    : stringifyCondensed(expression);
}

/**
 * Formats a variable expression as sign+code+value text.
 *
 * @param sign Variable sign marker.
 * @param code Variable code segment.
 * @param value Variable value segment.
 * @returns Serialized variable token text.
 */
function variableToString(sign: VariableSign, code: string, value: string): string {
  return `${sign}${code.toUpperCase()}${value.toUpperCase()}`;
}

/**
 * Stringifies an expression in explicit infix notation.
 *
 * @param expression Expression subtree to stringify.
 * @param parentPrecedence Parent precedence used for parenthesis decisions.
 * @returns Stringified explicit expression.
 */
function stringifyExplicit(expression: BoolExpr, parentPrecedence: number): string {
  if (!isBinaryExpr(expression)) {
    return variableToString(expression.sign, expression.code, expression.value);
  }

  const currentPrecedence = expression.operator === BinaryOperator.And ? 20 : 10;
  const left = stringifyExplicit(expression.left, currentPrecedence);
  const right = stringifyExplicit(expression.right, currentPrecedence + 1);
  const op = expression.operator === BinaryOperator.And ? "and" : "or";
  const content = `${left} ${op} ${right}`;
  if (currentPrecedence < parentPrecedence) {
    return `(${content})`;
  }
  return content;
}

/**
 * Stringifies an expression in condensed multiline syntax.
 *
 * @param expression Expression to stringify.
 * @returns Condensed string where lines represent OR terms.
 */
function stringifyCondensed(expression: BoolExpr): string {
  const orTerms = collectBinaryTerms(expression, BinaryOperator.Or);
  const lines = orTerms.map((term) => {
    const andTerms = collectBinaryTerms(term, BinaryOperator.And);
    return andTerms
      .map((t) => {
        if (!isBinaryExpr(t)) {
          return variableToString(t.sign, t.code, t.value);
        }
        // Fallback: if a term is still binary (nested OR inside AND), use explicit notation
        return `(${stringifyExplicit(t, 0)})`;
      })
      .join(" ");
  });
  return lines.join("\n");
}

/**
 * Collects all terms connected by a matching binary operator.
 *
 * @param expression Expression to flatten.
 * @param operator Operator to flatten by.
 * @returns Flat list of collected terms.
 */
function collectBinaryTerms(expression: BoolExpr, operator: BinaryOperator): BoolExpr[] {
  if (!isBinaryExpr(expression) || expression.operator !== operator) {
    return [expression];
  }
  return [
    ...collectBinaryTerms(expression.left, operator),
    ...collectBinaryTerms(expression.right, operator),
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merges two spans into the smallest span that contains both.
 *
 * @param left Left span.
 * @param right Right span.
 * @returns Merged enclosing span.
 */
function mergeSpan(left: SourceSpan, right: SourceSpan): SourceSpan {
  return {
    start: Math.min(left.start, right.start),
    end: Math.max(left.end, right.end),
  };
}
