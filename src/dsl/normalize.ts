import { BinaryOperator, BoolExpr, ExprKind, SourceSpan, isBinaryExpr } from "./types";

/**
 * Produces a canonical, sorted, and deduplicated form of a boolean expression.
 *
 * @param expression Expression tree to normalize.
 * @returns Canonicalized expression with flattened and stable term ordering.
 */
export function canonicalizeExpression(expression: BoolExpr): BoolExpr {
  if (!isBinaryExpr(expression)) {
    return expression;
  }

  const left = canonicalizeExpression(expression.left);
  const right = canonicalizeExpression(expression.right);
  const operator = expression.operator;
  const terms = extractTerms({ ...expression, left, right }, operator);
  const normalizedTerms = terms.map(canonicalizeExpression);

  const uniqueByKey = new Map<string, BoolExpr>();
  for (const term of normalizedTerms) {
    uniqueByKey.set(expressionKey(term), term);
  }

  const dedupedTerms = [...uniqueByKey.values()].sort((a, b) =>
    expressionKey(a).localeCompare(expressionKey(b))
  );
  const absorbedTerms = applyAbsorption(dedupedTerms, operator);

  if (absorbedTerms.length === 1) {
    return absorbedTerms[0];
  }

  return buildChain(absorbedTerms, operator, expression.span);
}

/**
 * Builds a canonical string key for an expression.
 *
 * @param expression Expression to encode.
 * @returns Stable key used for deduplication and ordering.
 */
export function expressionKey(expression: BoolExpr): string {
  if (!isBinaryExpr(expression)) {
    return `VAR:${expression.sign}:${expression.code}:${expression.value}`;
  }

  const op = expression.operator;
  const terms = extractTerms(expression, op)
    .map(expressionKey)
    .sort((a, b) => a.localeCompare(b, "en-US"));
  return `${op}(${terms.join(",")})`;
}

/**
 * Flattens a chain of matching binary operators into a term array.
 *
 * @param expression Expression to flatten.
 * @param operator Operator to flatten by.
 * @returns Flat list of terms.
 */
export function extractTerms(expression: BoolExpr, operator: BinaryOperator): BoolExpr[] {
  if (!isBinaryExpr(expression) || expression.operator !== operator) {
    return [expression];
  }

  return [...extractTerms(expression.left, operator), ...extractTerms(expression.right, operator)];
}

/**
 * Applies absorption law to remove redundant terms.
 *
 * @param terms Candidate terms for simplification.
 * @param outerOperator Operator linking top-level terms.
 * @returns Terms after absorption is applied.
 */
function applyAbsorption(terms: readonly BoolExpr[], outerOperator: BinaryOperator): BoolExpr[] {
  const innerOperator =
    outerOperator === BinaryOperator.And ? BinaryOperator.Or : BinaryOperator.And;

  const result: BoolExpr[] = [];
  for (const candidate of terms) {
    const absorbed = terms.some((other) => {
      if (expressionKey(other) === expressionKey(candidate)) {
        return false;
      }

      if (!isBinaryExpr(candidate) || candidate.operator !== innerOperator) {
        return false;
      }

      const candidateTerms = extractTerms(candidate, innerOperator);
      return candidateTerms.some(
        (candidateTerm) => expressionKey(candidateTerm) === expressionKey(other)
      );
    });

    if (!absorbed) {
      result.push(candidate);
    }
  }

  return result;
}

/**
 * Builds a left-associative binary chain from terms.
 *
 * @param terms Terms to chain.
 * @param operator Operator placed between chained terms.
 * @param span Source span to assign to generated binary nodes.
 * @returns Composed expression tree.
 */
export function buildChain(
  terms: readonly BoolExpr[],
  operator: BinaryOperator,
  span: SourceSpan
): BoolExpr {
  const [first, ...rest] = terms;
  if (first === undefined) {
    throw new Error("Cannot build an expression from zero terms.");
  }

  return rest.reduce<BoolExpr>(
    (accumulator, current) => ({
      kind: ExprKind.Binary,
      operator,
      left: accumulator,
      right: current,
      span,
    }),
    first
  );
}

/**
 * Counts total AST nodes in an expression.
 *
 * @param expression Expression to measure.
 * @returns Number of variable and binary nodes.
 */
export function nodeCount(expression: BoolExpr): number {
  if (!isBinaryExpr(expression)) {
    return 1;
  }
  return 1 + nodeCount(expression.left) + nodeCount(expression.right);
}

/**
 * Computes maximum depth of an expression tree.
 *
 * @param expression Expression to measure.
 * @returns Maximum depth, where leaf variables have depth 1.
 */
export function maxDepth(expression: BoolExpr): number {
  if (!isBinaryExpr(expression)) {
    return 1;
  }
  return 1 + Math.max(maxDepth(expression.left), maxDepth(expression.right));
}
