import {
  canonicalizeExpression,
  expressionKey,
  extractTerms,
  maxDepth,
  nodeCount,
} from "./normalize";
import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  isBinaryExpr,
  isVariableExpr,
  NormalForm,
  RewriteLimits,
  RewriteStats,
  SourceSpan,
  VariableSign,
} from "./types";

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
 *
 * @param expression Expression to transform.
 * @param form Target normal form.
 * @param limits Optional rewrite limits overriding defaults.
 * @returns Expanded expression and rewrite statistics.
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
 * Factorizes an expression by extracting common factors.
 *
 * @param expression Expression to factorize.
 * @param limits Optional rewrite limits overriding defaults.
 * @returns Factorized expression and rewrite statistics.
 */
export function factorizeExpression(
  expression: BoolExpr,
  limits: RewriteLimits = DEFAULT_LIMITS
): { expression: BoolExpr; stats: RewriteStats } {
  const effectiveLimits = { ...DEFAULT_LIMITS, ...limits };
  const stats: MutableRewriteStats = { rewrites: 0 };
  const result = factorizeRecursive(canonicalizeExpression(expression), effectiveLimits, stats);
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

// ---------------------------------------------------------------------------
// Expand internals
// ---------------------------------------------------------------------------

/**
 * Recursively expands an expression toward a target normal form.
 *
 * @param expression Current expression node.
 * @param form Target normal form.
 * @param limits Enforced transformation limits.
 * @param stats Mutable rewrite counters.
 * @returns Expanded expression subtree.
 */
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
  const node = { ...expression, left, right };
  const distributed = tryDistributeExpression(node, form);
  if (distributed === null) {
    return node;
  }

  stats.rewrites += 1;
  assertRewriteLimit(limits, stats);
  return distributed;
}

// ---------------------------------------------------------------------------
// Factorize internals
// ---------------------------------------------------------------------------

/**
 * Recursively factorizes an expression by pulling out common factors.
 *
 * @param expression Current expression node.
 * @param limits Enforced transformation limits.
 * @param stats Mutable rewrite counters.
 * @returns Factorized expression subtree.
 */
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
  const current = canonicalizeExpression({ ...expression, left, right });
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

/**
 * Attempts one factorization step across outer-operator terms.
 *
 * @param expression Expression candidate for factorization.
 * @param innerOperator Operator inside each factorizable term.
 * @param outerOperator Operator connecting top-level terms.
 * @returns Factorized expression when a common factor exists; otherwise null.
 */
function factorizeOuter(
  expression: BoolExpr,
  innerOperator: BinaryOperator,
  outerOperator: BinaryOperator
): BoolExpr | null {
  const terms = extractTerms(expression, outerOperator);
  if (terms.length < 2) {
    return null;
  }

  const best = selectBestFactor(buildFactorFrequency(terms, innerOperator));
  if (best === undefined) {
    return null;
  }

  const { grouped, otherTerms } = partitionTermsByFactor(
    terms,
    innerOperator,
    expressionKey(best.expr),
    best.expr
  );

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

/**
 * Prioritizes common-factor candidates by variable sign semantics.
 *
 * Priority order: Equals (`in`) first, NotEquals (`not in`) second,
 * then all non-variable expressions.
 *
 * @param expression Candidate factor expression.
 * @returns Lower numbers indicate higher priority.
 */
function factorPriority(expression: BoolExpr): number {
  if (!isVariableExpr(expression)) {
    return 2;
  }

  if (expression.sign === VariableSign.Equals) {
    return 0;
  }

  if (expression.sign === VariableSign.NotEquals) {
    return 1;
  }

  return 2;
}

/**
 * Attempts a single distribution step based on the requested normal form.
 *
 * @param expression Candidate expression node.
 * @param form Target normal form.
 * @returns Distributed expression, or null when no rule applies.
 */
function tryDistributeExpression(expression: BoolExpr, form: NormalForm): BoolExpr | null {
  if (!isBinaryExpr(expression)) {
    return null;
  }

  const distribution =
    form === NormalForm.Dnf
      ? {
          outerOperator: BinaryOperator.And,
          branchOperator: BinaryOperator.Or,
        }
      : {
          outerOperator: BinaryOperator.Or,
          branchOperator: BinaryOperator.And,
        };

  if (expression.operator !== distribution.outerOperator) {
    return null;
  }

  return (
    distributeAcrossSide(
      expression.left,
      expression.right,
      distribution.branchOperator,
      distribution.outerOperator,
      true
    ) ??
    distributeAcrossSide(
      expression.right,
      expression.left,
      distribution.branchOperator,
      distribution.outerOperator,
      false
    )
  );
}

/**
 * Distributes a shared expression across both branches of a binary candidate.
 *
 * @param branchCandidate Side expected to contain the branch operator.
 * @param shared Expression replicated into both distributed branches.
 * @param branchOperator Operator required on the branching side.
 * @param innerOperator Operator used inside each distributed branch.
 * @param branchOnLeft Indicates whether branchCandidate is the left operand.
 * @returns Distributed expression, or null when branching preconditions fail.
 */
function distributeAcrossSide(
  branchCandidate: BoolExpr,
  shared: BoolExpr,
  branchOperator: BinaryOperator,
  innerOperator: BinaryOperator,
  branchOnLeft: boolean
): BoolExpr | null {
  if (!isBinaryExpr(branchCandidate) || branchCandidate.operator !== branchOperator) {
    return null;
  }

  const leftBranch = branchOnLeft
    ? buildBinary(innerOperator, branchCandidate.left, shared)
    : buildBinary(innerOperator, shared, branchCandidate.left);
  const rightBranch = branchOnLeft
    ? buildBinary(innerOperator, branchCandidate.right, shared)
    : buildBinary(innerOperator, shared, branchCandidate.right);

  return buildBinary(branchOperator, leftBranch, rightBranch);
}

/**
 * Builds factor occurrence counts across outer terms.
 *
 * @param terms Outer terms to inspect.
 * @param innerOperator Operator used to extract factors per term.
 * @returns Frequency table keyed by canonical expression key.
 */
function buildFactorFrequency(
  terms: readonly BoolExpr[],
  innerOperator: BinaryOperator
): Map<string, { count: number; expr: BoolExpr }> {
  const frequency = new Map<string, { count: number; expr: BoolExpr }>();

  for (const term of terms) {
    const uniqueFactors = new Map<string, BoolExpr>();
    for (const factor of extractTerms(term, innerOperator)) {
      uniqueFactors.set(expressionKey(factor), factor);
    }

    for (const [key, factor] of uniqueFactors.entries()) {
      const current = frequency.get(key);
      if (current === undefined) {
        frequency.set(key, { count: 1, expr: factor });
        continue;
      }

      current.count += 1;
    }
  }

  return frequency;
}

/**
 * Selects the best common factor candidate from a frequency table.
 *
 * @param frequency Frequency table of candidate factors.
 * @returns Best candidate occurring in at least two terms, if any.
 */
function selectBestFactor(
  frequency: Map<string, { count: number; expr: BoolExpr }>
): { count: number; expr: BoolExpr } | undefined {
  return [...frequency.values()]
    .filter((value) => value.count >= 2)
    .sort(
      (a, b) =>
        b.count - a.count ||
        factorPriority(a.expr) - factorPriority(b.expr) ||
        expressionKey(a.expr).localeCompare(expressionKey(b.expr))
    )[0];
}

/**
 * Splits terms into those containing the common factor and all others.
 *
 * @param terms Outer terms to partition.
 * @param innerOperator Operator used to extract factors from each term.
 * @param commonKey Canonical key for the common factor.
 * @param commonFactor Common factor expression used when a term becomes empty.
 * @returns Grouped terms and untouched terms.
 */
function partitionTermsByFactor(
  terms: readonly BoolExpr[],
  innerOperator: BinaryOperator,
  commonKey: string,
  commonFactor: BoolExpr
): { grouped: BoolExpr[]; otherTerms: BoolExpr[] } {
  const grouped: BoolExpr[] = [];
  const otherTerms: BoolExpr[] = [];

  for (const term of terms) {
    const factors = extractTerms(term, innerOperator);
    const remaining = factors.filter((factor) => expressionKey(factor) !== commonKey);

    if (remaining.length === factors.length) {
      otherTerms.push(term);
      continue;
    }

    grouped.push(buildRemainingFactors(remaining, innerOperator, commonFactor));
  }

  return { grouped, otherTerms };
}

/**
 * Rebuilds a term from remaining factors after removing a common factor.
 *
 * @param remaining Factors left in the term.
 * @param operator Operator used to reconnect remaining factors.
 * @param commonFactor Common factor fallback when no factors remain.
 * @returns Reconstructed term.
 */
function buildRemainingFactors(
  remaining: readonly BoolExpr[],
  operator: BinaryOperator,
  commonFactor: BoolExpr
): BoolExpr {
  if (remaining.length === 0) {
    return commonFactor;
  }

  if (remaining.length === 1) {
    return remaining[0];
  }

  return buildChain(remaining, operator);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a binary AST node and merges operand spans.
 *
 * @param operator Binary operator.
 * @param left Left operand.
 * @param right Right operand.
 * @returns Binary expression node.
 */
function buildBinary(operator: BinaryOperator, left: BoolExpr, right: BoolExpr): BoolExpr {
  return {
    kind: ExprKind.Binary,
    operator,
    left,
    right,
    span: mergeSpan(left.span, right.span),
  };
}

/**
 * Builds a left-associative chain with a shared operator.
 *
 * @param terms Terms to chain.
 * @param operator Operator connecting terms.
 * @returns Chained expression.
 */
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

/**
 * Merges two source spans into their enclosing span.
 *
 * @param left Left span.
 * @param right Right span.
 * @returns Span covering both inputs.
 */
function mergeSpan(left: SourceSpan, right: SourceSpan): SourceSpan {
  return {
    start: Math.min(left.start, right.start),
    end: Math.max(left.end, right.end),
  };
}

/**
 * Asserts depth, node-count, and rewrite limits.
 *
 * @param expression Expression to validate.
 * @param limits Enforced transformation limits.
 * @param stats Mutable rewrite counters.
 */
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

/**
 * Asserts rewrite count does not exceed configured maximum.
 *
 * @param limits Enforced transformation limits.
 * @param stats Mutable rewrite counters.
 */
function assertRewriteLimit(limits: Required<RewriteLimits>, stats: MutableRewriteStats): void {
  if (stats.rewrites > limits.maxRewrites) {
    throw new Error(`Transformation exceeded maxRewrites (${limits.maxRewrites}).`);
  }
}
