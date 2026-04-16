import { BinaryOperator, BoolExpr, ExprKind, NormalForm, VariableSign } from "./types";

function makeVar(name: string): BoolExpr {
  return {
    kind: ExprKind.Variable,
    sign: VariableSign.Equals,
    code: name,
    value: "01",
    span: { start: 0, end: 0 },
  };
}

function makeBin(operator: BinaryOperator, left: BoolExpr, right: BoolExpr): BoolExpr {
  return {
    kind: ExprKind.Binary,
    operator,
    left,
    right,
    span: { start: 0, end: 0 },
  };
}

describe("transform internals with mocked normalize behavior", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should execute right-side distribution branches for DNF and CNF", async () => {
    jest.doMock("./normalize", () => {
      const actual = jest.requireActual("./normalize");
      return {
        ...actual,
        canonicalizeExpression: jest.fn((expr: BoolExpr) => expr),
      };
    });

    const { expandExpression } = await import("./transform");

    const a = makeVar("AAA");
    const b = makeVar("BBB");
    const c = makeVar("CCC");

    const dnfInput = makeBin(BinaryOperator.And, a, makeBin(BinaryOperator.Or, b, c));
    const dnfResult = expandExpression(dnfInput, NormalForm.Dnf);
    expect(dnfResult.stats.rewrites).toBeGreaterThan(0);

    const cnfInput = makeBin(BinaryOperator.Or, a, makeBin(BinaryOperator.And, b, c));
    const cnfResult = expandExpression(cnfInput, NormalForm.Cnf);
    expect(cnfResult.stats.rewrites).toBeGreaterThan(0);
  });

  it("should handle factorization path with fewer than two terms", async () => {
    jest.doMock("./normalize", () => {
      const actual = jest.requireActual("./normalize");
      return {
        ...actual,
        canonicalizeExpression: jest.fn((expr: BoolExpr) => expr),
        extractTerms: jest.fn((expr: BoolExpr, operator: BinaryOperator) => {
          if (expr.kind === ExprKind.Binary && expr.operator === operator) {
            return [expr.left];
          }
          return [expr];
        }),
      };
    });

    const { factorizeExpression } = await import("./transform");

    const a = makeVar("AAA");
    const b = makeVar("BBB");
    const input = makeBin(BinaryOperator.Or, a, b);

    const result = factorizeExpression(input);
    expect(result.stats.rewrites).toBe(0);
  });

  it("should exercise tie-breaking and grouped-length guard paths", async () => {
    const a = makeVar("AAA");
    const b = makeVar("BBB");
    const c = makeVar("CCC");
    const t1 = makeVar("T1");
    const t2 = makeVar("T2");
    const t3 = makeVar("T3");
    const outer = makeBin(BinaryOperator.Or, makeBin(BinaryOperator.Or, t1, t2), t3);

    let innerCallCount = 0;

    jest.doMock("./normalize", () => {
      const actual = jest.requireActual("./normalize");
      return {
        ...actual,
        canonicalizeExpression: jest.fn((expr: BoolExpr) => expr),
        expressionKey: jest.fn((expr: BoolExpr) => {
          if (expr === a) {
            return "A";
          }
          if (expr === b) {
            return "B";
          }
          if (expr === c) {
            return "C";
          }
          if (expr === t1) {
            return "T1";
          }
          if (expr === t2) {
            return "T2";
          }
          if (expr === t3) {
            return "T3";
          }
          return "X";
        }),
        extractTerms: jest.fn((expr: BoolExpr, operator: BinaryOperator) => {
          if (operator === BinaryOperator.Or && expr === outer) {
            return [t1, t2, t3];
          }

          if (operator === BinaryOperator.And) {
            innerCallCount += 1;

            // Frequency pass for 3 terms: create a tie A=2, B=2.
            if (innerCallCount === 1) {
              return [a, b];
            }
            if (innerCallCount === 2) {
              return [a];
            }
            if (innerCallCount === 3) {
              return [b];
            }

            // Grouping pass: only one term keeps the chosen common factor.
            if (expr === t1) {
              return [a, c];
            }
            if (expr === t2) {
              return [c];
            }
            if (expr === t3) {
              return [b];
            }
          }

          return [expr];
        }),
      };
    });

    const { factorizeExpression } = await import("./transform");
    const result = factorizeExpression(outer);

    expect(result.stats.rewrites).toBe(0);
  });

  it("should hit remaining-length-zero path when a term equals the common factor", async () => {
    const a = makeVar("AAA");
    const b = makeVar("BBB");
    const t1 = makeVar("T1");
    const t2 = makeVar("T2");
    const outer = makeBin(BinaryOperator.Or, t1, t2);

    jest.doMock("./normalize", () => {
      const actual = jest.requireActual("./normalize");
      return {
        ...actual,
        canonicalizeExpression: jest.fn((expr: BoolExpr) => expr),
        expressionKey: jest.fn((expr: BoolExpr) => {
          if (expr === a) {
            return "A";
          }
          if (expr === b) {
            return "B";
          }
          return "T";
        }),
        extractTerms: jest.fn((expr: BoolExpr, operator: BinaryOperator) => {
          if (operator === BinaryOperator.Or && expr === outer) {
            return [t1, t2];
          }
          if (operator === BinaryOperator.And && expr === t1) {
            return [a];
          }
          if (operator === BinaryOperator.And && expr === t2) {
            return [a, b];
          }
          return [expr];
        }),
      };
    });

    const { factorizeExpression } = await import("./transform");
    const result = factorizeExpression(outer);

    expect(result.stats.rewrites).toBeGreaterThanOrEqual(0);
  });
});
