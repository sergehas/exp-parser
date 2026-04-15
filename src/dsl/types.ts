/** Supported expression node kinds in the boolean AST. */
export enum ExprKind {
  Variable = "Variable",
  Binary = "Binary",
}

/** Supported binary operators between two boolean expressions. */
export enum BinaryOperator {
  And = "AND",
  Or = "OR",
}

/** Sign prefix used by variable expressions. */
export enum VariableSign {
  Equals = "+",
  NotEquals = "-",
}

/** Character offsets for a parsed token or expression within the source input. */
export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

/** AST node representing a signed variable/value condition. */
export interface VariableExpr {
  readonly kind: ExprKind.Variable;
  readonly sign: VariableSign;
  readonly code: string;
  readonly value: string;
  readonly span: SourceSpan;
}

/** AST node representing a binary operation between two expressions. */
export interface BinaryExpr {
  readonly kind: ExprKind.Binary;
  readonly operator: BinaryOperator;
  readonly left: BoolExpr;
  readonly right: BoolExpr;
  readonly span: SourceSpan;
}

/** Union of all supported boolean expression AST node variants. */
export type BoolExpr = VariableExpr | BinaryExpr;

/** Parser diagnostic containing a message and source location. */
export interface ParseDiagnostic {
  readonly message: string;
  readonly span: SourceSpan;
}

/** Safety limits used to cap rewrite operations during transformations. */
export interface RewriteLimits {
  readonly maxNodes?: number;
  readonly maxDepth?: number;
  readonly maxRewrites?: number;
}

/** Runtime statistics collected while rewriting an expression tree. */
export interface RewriteStats {
  readonly rewrites: number;
  readonly maxDepth: number;
  readonly nodeCount: number;
}

/** Target canonical normal forms used by expression transformers. */
export enum NormalForm {
  Dnf = "DNF",
  Cnf = "CNF",
}

/** Type guard: checks if an expression is a VariableExpr. */
export function isVariableExpr(expr: BoolExpr): expr is VariableExpr {
  return expr.kind === ExprKind.Variable;
}

/** Type guard: checks if an expression is a BinaryExpr. */
export function isBinaryExpr(expr: BoolExpr): expr is BinaryExpr {
  return expr.kind === ExprKind.Binary;
}
