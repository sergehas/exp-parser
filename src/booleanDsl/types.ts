export enum ExprKind {
  Variable = "Variable",
  Binary = "Binary",
}

export enum BinaryOperator {
  And = "AND",
  Or = "OR",
}

export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

export interface VariableExpr {
  readonly kind: ExprKind.Variable;
  readonly name: string;
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

export function isVariableExpr(expr: BoolExpr): expr is VariableExpr {
  return expr.kind === ExprKind.Variable;
}

export function isBinaryExpr(expr: BoolExpr): expr is BinaryExpr {
  return expr.kind === ExprKind.Binary;
}
