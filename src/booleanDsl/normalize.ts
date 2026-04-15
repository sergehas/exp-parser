import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  SourceSpan,
  isBinaryExpr,
} from "./types";
import { stringifyExpression } from "./parser";

export function canonicalizeExpression(expression: BoolExpr): BoolExpr {
  if (!isBinaryExpr(expression)) {
    return expression;
  }

  const left = canonicalizeExpression(expression.left);
  const right = canonicalizeExpression(expression.right);
  const operator = expression.operator;
  const terms = extractTerms(
    {
      ...expression,
      left,
      right,
    },
    operator
  );
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
    return absorbedTerms[0] as BoolExpr;
  }

  return buildChain(absorbedTerms, operator, expression.span);
}

export function expressionKey(expression: BoolExpr): string {
  if (!isBinaryExpr(expression)) {
    return `VAR:${expression.name}`;
  }

  const op = expression.operator;
  const terms = extractTerms(expression, op).map(expressionKey).sort();
  return `${op}(${terms.join(",")})`;
}

export function extractTerms(
  expression: BoolExpr,
  operator: BinaryOperator
): BoolExpr[] {
  if (!isBinaryExpr(expression) || expression.operator !== operator) {
    return [expression];
  }

  return [
    ...extractTerms(expression.left, operator),
    ...extractTerms(expression.right, operator),
  ];
}

function applyAbsorption(
  terms: readonly BoolExpr[],
  outerOperator: BinaryOperator
): BoolExpr[] {
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

function buildChain(
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

export function nodeCount(expression: BoolExpr): number {
  if (!isBinaryExpr(expression)) {
    return 1;
  }

  return 1 + nodeCount(expression.left) + nodeCount(expression.right);
}

export function maxDepth(expression: BoolExpr): number {
  if (!isBinaryExpr(expression)) {
    return 1;
  }

  return 1 + Math.max(maxDepth(expression.left), maxDepth(expression.right));
}

export function debugExpression(expression: BoolExpr): string {
  return `${stringifyExpression(expression)} [${expressionKey(expression)}]`;
}
