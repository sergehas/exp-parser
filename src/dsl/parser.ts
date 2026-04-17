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
  [TokenType.In]: 0,
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

    if (token.type === TokenType.In) {
      this.advance();
      return this.buildInChain(token);
    }

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
   * Builds an expression chain from an IN token.
   * Equals sign produces an OR-chain; NotEquals sign produces an AND-chain.
   *
   * @param token The IN token containing code, sign, and values.
   * @returns Desugared (more primitive form) expression chain or null on error.
   */
  private buildInChain(token: Token): BoolExpr | null {
    const code = token.code ?? "";
    const sign = token.sign ?? VariableSign.Equals;
    const values = token.values ?? [];
    const span: SourceSpan = { start: token.start, end: token.end };

    if (values.length === 0) {
      this._diagnostics.push({
        message: "Empty IN expression.",
        span,
      });
      return null;
    }

    const exprs: BoolExpr[] = values.map((v) => ({
      kind: ExprKind.Variable as const,
      sign,
      code,
      value: v,
      span,
    }));

    const operator = sign === VariableSign.Equals ? BinaryOperator.Or : BinaryOperator.And;

    const [first, ...rest] = exprs;
    return rest.reduce<BoolExpr>(
      (acc, cur) => ({
        kind: ExprKind.Binary,
        operator,
        left: acc,
        right: cur,
        span: mergeSpan(acc.span, cur.span),
      }),
      first
    );
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
 * Formats a variable expression as sign+code+value text for condensed output.
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
 * Formats a variable expression as CODE:VALUE or CODE!VALUE text for explicit output.
 *
 * @param sign Variable sign marker.
 * @param code Variable code segment.
 * @param value Variable value segment.
 * @returns Serialized explicit variable token text.
 */
function explicitVariableToString(sign: VariableSign, code: string, value: string): string {
  const separator = sign === VariableSign.Equals ? ":" : "!";
  return `${code.toUpperCase()}${separator}${value.toUpperCase()}`;
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
    return explicitVariableToString(expression.sign, expression.code, expression.value);
  }

  const inResult = tryStringifyIn(expression, parentPrecedence);
  if (inResult !== null) {
    return inResult;
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
 * Attempts to fold an expression into IN syntax (CODE:(V1 V2) or CODE!(V1 V2)).
 * Folds OR-chains of same-code Equals variables and AND-chains of same-code NotEquals variables.
 *
 * @param expression Binary expression to attempt folding.
 * @returns IN-syntax string if foldable, or null otherwise.
 */
function tryStringifyIn(expression: BoolExpr, parentPrecedence: number): string | null {
  if (!isBinaryExpr(expression)) {
    return null;
  }

  if (!supportsInFolding(expression.operator)) {
    return null;
  }

  const terms = collectBinaryTerms(expression, expression.operator);
  if (terms.length < 2) {
    return null;
  }

  if (terms.some((t) => isBinaryExpr(t))) {
    return null;
  }

  const operatorToken = expression.operator === BinaryOperator.And ? "and" : "or";
  const currentPrecedence = expression.operator === BinaryOperator.And ? 20 : 10;

  const foldResult = renderTermsWithInFolding(terms, expression.operator);
  if (foldResult === null) {
    return null;
  }

  if (!foldResult.hasAnyFold) {
    return null;
  }

  const content = foldResult.renderedTerms.join(` ${operatorToken} `);
  if (currentPrecedence < parentPrecedence && foldResult.renderedTerms.length > 1) {
    return `(${content})`;
  }

  return content;
}

interface FoldRenderResult {
  readonly renderedTerms: readonly string[];
  readonly hasAnyFold: boolean;
}

interface VariableRun {
  readonly variable: BoolExpr & { readonly kind: ExprKind.Variable };
  readonly nextIndex: number;
}

/**
 * Indicates whether a binary operator can participate in IN-folding.
 *
 * @param operator Operator candidate.
 * @returns True when the operator supports folding.
 */
function supportsInFolding(operator: BinaryOperator): boolean {
  return operator === BinaryOperator.Or || operator === BinaryOperator.And;
}

/**
 * Renders terms with opportunistic IN-folding for compatible variable runs.
 *
 * @param terms Flat list of terms connected by a shared operator.
 * @param operator Shared operator connecting the terms.
 * @returns Render result, or null when a term cannot be rendered as a variable.
 */
function renderTermsWithInFolding(
  terms: readonly BoolExpr[],
  operator: BinaryOperator
): FoldRenderResult | null {
  const renderedTerms: string[] = [];
  let hasAnyFold = false;
  let index = 0;

  while (index < terms.length) {
    const run = collectVariableRun(terms, index);
    if (run === null) {
      return null;
    }

    if (canFoldVariableRun(operator, run.variable.sign, index, run.nextIndex)) {
      hasAnyFold = true;
      renderedTerms.push(renderFoldedVariableRun(terms, run.variable, index, run.nextIndex));
      index = run.nextIndex;
      continue;
    }

    renderedTerms.push(
      explicitVariableToString(run.variable.sign, run.variable.code, run.variable.value)
    );
    index += 1;
  }

  return { renderedTerms, hasAnyFold };
}

/**
 * Collects a contiguous run of same-code/same-sign variable terms.
 *
 * @param terms Ordered term list.
 * @param startIndex Index where the run starts.
 * @returns Run metadata, or null when the start term is not a variable.
 */
function collectVariableRun(terms: readonly BoolExpr[], startIndex: number): VariableRun | null {
  const variable = terms[startIndex];
  if (variable?.kind !== ExprKind.Variable) {
    return null;
  }

  let nextIndex = startIndex + 1;
  while (matchesVariableRun(variable, terms[nextIndex])) {
    nextIndex += 1;
  }

  return { variable, nextIndex };
}

/**
 * Checks whether a candidate variable extends the current variable run.
 *
 * @param variable Run anchor variable.
 * @param candidate Neighbor term to validate.
 * @returns True when candidate has matching kind, code, and sign.
 */
function matchesVariableRun(
  variable: BoolExpr & { readonly kind: ExprKind.Variable },
  candidate: BoolExpr | undefined
): candidate is BoolExpr & { readonly kind: ExprKind.Variable } {
  return (
    candidate?.kind === ExprKind.Variable &&
    candidate.code === variable.code &&
    candidate.sign === variable.sign
  );
}

/**
 * Determines whether a variable run is eligible for IN-folding.
 *
 * @param operator Shared operator for the surrounding term list.
 * @param sign Variable sign used by the run.
 * @param startIndex Inclusive run start index.
 * @param nextIndex Exclusive run end index.
 * @returns True when the run should be folded into IN syntax.
 */
function canFoldVariableRun(
  operator: BinaryOperator,
  sign: VariableSign,
  startIndex: number,
  nextIndex: number
): boolean {
  if (nextIndex - startIndex <= 1) {
    return false;
  }

  return (
    (operator === BinaryOperator.Or && sign === VariableSign.Equals) ||
    (operator === BinaryOperator.And && sign === VariableSign.NotEquals)
  );
}

/**
 * Renders a foldable variable run as explicit IN syntax.
 *
 * @param terms Source term list.
 * @param variable Run anchor variable.
 * @param startIndex Inclusive run start index.
 * @param nextIndex Exclusive run end index.
 * @returns Folded IN representation for the variable run.
 */
function renderFoldedVariableRun(
  terms: readonly BoolExpr[],
  variable: BoolExpr & { readonly kind: ExprKind.Variable },
  startIndex: number,
  nextIndex: number
): string {
  const values = terms
    .slice(startIndex, nextIndex)
    .map((term) => (term.kind === ExprKind.Variable ? term.value.toUpperCase() : ""));
  const separator = variable.sign === VariableSign.Equals ? ":" : "!";
  return `${variable.code.toUpperCase()}${separator}(${values.join(" ")})`;
}

/**
 * Stringifies an expression in condensed multiline syntax.
 *
 * @param expression Expression to stringify.
 * @returns Condensed string where lines represent OR terms.
 */
function stringifyCondensed(expression: BoolExpr): string {
  const dnf = toDnf(expression);
  const orTerms = collectBinaryTerms(dnf, BinaryOperator.Or);
  const lines = orTerms.map((term) => {
    const andTerms = collectBinaryTerms(term, BinaryOperator.And);
    return andTerms
      .filter((t) => !isBinaryExpr(t))
      .map((t) => variableToString(t.sign, t.code, t.value))
      .join(" ");
  });
  return lines.join("\n");
}

/**
 * Converts an expression to Disjunctive Normal Form (OR of ANDs) by distributing
 * AND over OR. This ensures condensed output never needs to embed explicit syntax.
 *
 * @param expression Expression to normalize.
 * @returns Equivalent expression in DNF.
 */
function toDnf(expression: BoolExpr): BoolExpr {
  if (!isBinaryExpr(expression)) {
    return expression;
  }

  const left = toDnf(expression.left);
  const right = toDnf(expression.right);

  if (expression.operator === BinaryOperator.Or) {
    return { ...expression, left, right };
  }

  // AND: distribute over any OR on either side
  const leftOrTerms = collectBinaryTerms(left, BinaryOperator.Or);
  const rightOrTerms = collectBinaryTerms(right, BinaryOperator.Or);

  if (leftOrTerms.length === 1 && rightOrTerms.length === 1) {
    return { ...expression, left, right };
  }

  const products: BoolExpr[] = [];
  for (const l of leftOrTerms) {
    for (const r of rightOrTerms) {
      products.push({
        kind: ExprKind.Binary,
        operator: BinaryOperator.And,
        left: l,
        right: r,
        span: mergeSpan(l.span, r.span),
      });
    }
  }

  const [first, ...rest] = products;
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
