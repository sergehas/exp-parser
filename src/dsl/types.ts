export enum ExprKind {
  Variable = "Variable",
  Binary = "Binary",
}

export enum BinaryOperator {
  And = "AND",
  Or = "OR",
}

export enum VariableSign {
  Equals = "+",
  NotEquals = "-",
}

export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

export interface VariableExpr {
  readonly kind: ExprKind.Variable;
  readonly sign: VariableSign;
  readonly code: string;
  readonly value: string;
  readonly span: SourceSpan;
}

export interface BinaryExpr {
  readonly kind: ExprKind.Binary;
  readonly operator: BinaryOperator;
  readonly left: BoolExpr;
  readonly right: BoolExpr;
  readonly span: SourceSpan;
}

export type BoolExpr = VariableExpr | BinaryExpr;

export interface ParseDiagnostic {
  readonly message: string;
  readonly span: SourceSpan;
}

export interface RewriteLimits {
  readonly maxNodes?: number;
  readonly maxDepth?: number;
  readonly maxRewrites?: number;
}

export interface RewriteStats {
  readonly rewrites: number;
  readonly maxDepth: number;
  readonly nodeCount: number;
}

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
