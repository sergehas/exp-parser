import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  NormalForm,
  RewriteLimits,
  RewriteStats,
  SourceSpan,
  isBinaryExpr,
} from "./types";
import {
  canonicalizeExpression,
  expressionKey,
  extractTerms,
  maxDepth,
  nodeCount,
} from "./normalize";

interface MutableRewriteStats {
  rewrites: number;
}

const DEFAULT_LIMITS: Required<RewriteLimits> = {
  maxDepth: 64,
  maxNodes: 2000,
  maxRewrites: 2000,
};

/**
 * Expands a boolean expression toward DNF or CNF using distribution rules.
 */
export function expandExpression(
  expression: BoolExpr,
  form: NormalForm,
  limits: RewriteLimits = DEFAULT_LIMITS
): { expression: BoolExpr; stats: RewriteStats } {
  const effectiveLimits = { ...DEFAULT_LIMITS, ...limits };
  const stats: MutableRewriteStats = { rewrites: 0 };
  const expanded = expandRecursive(
    canonicalizeExpression(expression),
    form,
    effectiveLimits,
    stats
  );
  const normalized = canonicalizeExpression(expanded);
  assertLimits(normalized, effectiveLimits, stats);
  return {
    expression: normalized,
    stats: {
      rewrites: stats.rewrites,
      maxDepth: maxDepth(normalized),
      nodeCount: nodeCount(normalized),
    },
  };
}

/**
 * Factorizes by extracting common terms on OR-of-AND or AND-of-OR shapes.
 */
export function factorizeExpression(
  expression: BoolExpr,
  limits: RewriteLimits = DEFAULT_LIMITS
): { expression: BoolExpr; stats: RewriteStats } {
  const effectiveLimits = { ...DEFAULT_LIMITS, ...limits };
  const stats: MutableRewriteStats = { rewrites: 0 };
  const result = factorizeRecursive(
    canonicalizeExpression(expression),
    effectiveLimits,
    stats
  );
  const normalized = canonicalizeExpression(result);
  assertLimits(normalized, effectiveLimits, stats);
  return {
    expression: normalized,
    stats: {
      rewrites: stats.rewrites,
      maxDepth: maxDepth(normalized),
      nodeCount: nodeCount(normalized),
    },
  };
}

function expandRecursive(
  expression: BoolExpr,
  form: NormalForm,
  limits: Required<RewriteLimits>,
  stats: MutableRewriteStats
): BoolExpr {
  assertLimits(expression, limits, stats);
  if (!isBinaryExpr(expression)) {
    return expression;
  }

  const left = expandRecursive(expression.left, form, limits, stats);
  const right = expandRecursive(expression.right, form, limits, stats);
  const node: BoolExpr = {
    ...expression,
    left,
    right,
  };

  if (form === NormalForm.Dnf && isBinaryExpr(node) && node.operator === BinaryOperator.And) {
    if (isBinaryExpr(left) && left.operator === BinaryOperator.Or) {
      stats.rewrites += 1;
      assertRewriteLimit(limits, stats);
      return {
        kind: ExprKind.Binary,
        operator: BinaryOperator.Or,
        left: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.And,
          left: left.left,
          right,
          span: mergeSpan(left.left.span, right.span),
        },
        right: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.And,
          left: left.right,
          right,
          span: mergeSpan(left.right.span, right.span),
        },
        span: mergeSpan(left.span, right.span),
      };
    }

    if (isBinaryExpr(right) && right.operator === BinaryOperator.Or) {
      stats.rewrites += 1;
      assertRewriteLimit(limits, stats);
      return {
        kind: ExprKind.Binary,
        operator: BinaryOperator.Or,
        left: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.And,
          left,
          right: right.left,
          span: mergeSpan(left.span, right.left.span),
        },
        right: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.And,
          left,
          right: right.right,
          span: mergeSpan(left.span, right.right.span),
        },
        span: mergeSpan(left.span, right.span),
      };
    }
  }

  if (form === NormalForm.Cnf && isBinaryExpr(node) && node.operator === BinaryOperator.Or) {
    if (isBinaryExpr(left) && left.operator === BinaryOperator.And) {
      stats.rewrites += 1;
      assertRewriteLimit(limits, stats);
      return {
        kind: ExprKind.Binary,
        operator: BinaryOperator.And,
        left: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.Or,
          left: left.left,
          right,
          span: mergeSpan(left.left.span, right.span),
        },
        right: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.Or,
          left: left.right,
          right,
          span: mergeSpan(left.right.span, right.span),
        },
        span: mergeSpan(left.span, right.span),
      };
    }

    if (isBinaryExpr(right) && right.operator === BinaryOperator.And) {
      stats.rewrites += 1;
      assertRewriteLimit(limits, stats);
      return {
        kind: ExprKind.Binary,
        operator: BinaryOperator.And,
        left: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.Or,
          left,
          right: right.left,
          span: mergeSpan(left.span, right.left.span),
        },
        right: {
          kind: ExprKind.Binary,
          operator: BinaryOperator.Or,
          left,
          right: right.right,
          span: mergeSpan(left.span, right.right.span),
        },
        span: mergeSpan(left.span, right.span),
      };
    }
  }

  return node;
}

function factorizeRecursive(
  expression: BoolExpr,
  limits: Required<RewriteLimits>,
  stats: MutableRewriteStats
): BoolExpr {
  assertLimits(expression, limits, stats);
  if (!isBinaryExpr(expression)) {
    return expression;
  }

  const left = factorizeRecursive(expression.left, limits, stats);
  const right = factorizeRecursive(expression.right, limits, stats);
  const current = canonicalizeExpression({
    ...expression,
    left,
    right,
  });
  if (!isBinaryExpr(current)) {
    return current;
  }

  const factored =
    current.operator === BinaryOperator.Or
      ? factorizeOuter(current, BinaryOperator.And, BinaryOperator.Or)
      : factorizeOuter(current, BinaryOperator.Or, BinaryOperator.And);

  if (factored !== null) {
    stats.rewrites += 1;
    assertRewriteLimit(limits, stats);
    return canonicalizeExpression(factored);
  }

  return current;
}

function factorizeOuter(
  expression: BoolExpr,
  innerOperator: BinaryOperator,
  outerOperator: BinaryOperator
): BoolExpr | null {
  const terms = extractTerms(expression, outerOperator);
  if (terms.length < 2) {
    return null;
  }

  const frequency = new Map<string, { count: number; expr: BoolExpr }>();
  for (const term of terms) {
    const factors = new Map<string, BoolExpr>();
    for (const factor of extractTerms(term, innerOperator)) {
      factors.set(expressionKey(factor), factor);
    }

    for (const [key, factor] of factors.entries()) {
      const current = frequency.get(key);
      if (current === undefined) {
        frequency.set(key, { count: 1, expr: factor });
      } else {
        current.count += 1;
      }
    }
  }

  const best = [...frequency.values()]
    .filter((value) => value.count >= 2)
    .sort((a, b) => b.count - a.count || expressionKey(a.expr).localeCompare(expressionKey(b.expr)))[0];
  if (best === undefined) {
    return null;
  }

  const commonKey = expressionKey(best.expr);
  const grouped: BoolExpr[] = [];
  const otherTerms: BoolExpr[] = [];

  for (const term of terms) {
    const factors = extractTerms(term, innerOperator);
    const remaining = factors.filter((factor) => expressionKey(factor) !== commonKey);
    const hasCommonFactor = remaining.length !== factors.length;
    if (!hasCommonFactor) {
      otherTerms.push(term);
      continue;
    }

    if (remaining.length === 0) {
      grouped.push(best.expr);
    } else if (remaining.length === 1) {
      grouped.push(remaining[0] as BoolExpr);
    } else {
      grouped.push(buildChain(remaining, innerOperator));
    }
  }

  if (grouped.length < 2) {
    return null;
  }

  const groupedExpr = buildChain(grouped, outerOperator);
  const factoredGroup: BoolExpr = {
    kind: ExprKind.Binary,
    operator: innerOperator,
    left: best.expr,
    right: groupedExpr,
    span: mergeSpan(best.expr.span, groupedExpr.span),
  };

  if (otherTerms.length === 0) {
    return factoredGroup;
  }

  return buildChain([...otherTerms, factoredGroup], outerOperator);
}

function buildChain(terms: readonly BoolExpr[], operator: BinaryOperator): BoolExpr {
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
      span: mergeSpan(accumulator.span, current.span),
    }),
    first
  );
}

function mergeSpan(left: SourceSpan, right: SourceSpan): SourceSpan {
  return {
    start: Math.min(left.start, right.start),
    end: Math.max(left.end, right.end),
  };
}

function assertLimits(
  expression: BoolExpr,
  limits: Required<RewriteLimits>,
  stats: MutableRewriteStats
): void {
  if (nodeCount(expression) > limits.maxNodes) {
    throw new Error(
      `Expression exceeded maxNodes (${limits.maxNodes}). Current: ${nodeCount(expression)}.`
    );
  }

  if (maxDepth(expression) > limits.maxDepth) {
    throw new Error(
      `Expression exceeded maxDepth (${limits.maxDepth}). Current: ${maxDepth(expression)}.`
    );
  }

  assertRewriteLimit(limits, stats);
}

function assertRewriteLimit(
  limits: Required<RewriteLimits>,
  stats: MutableRewriteStats
): void {
  if (stats.rewrites > limits.maxRewrites) {
    throw new Error(
      `Transformation exceeded maxRewrites (${limits.maxRewrites}).`
    );
  }
}
