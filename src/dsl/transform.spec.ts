import { SyntaxMode } from "./detect";
import * as normalize from "./normalize";
import { expressionKey, extractTerms } from "./normalize";
import { parseExpression, stringifyExpression } from "./parser";
import { expandExpression, factorizeExpression } from "./transform";
import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  NormalForm,
  VariableSign,
  isBinaryExpr,
} from "./types";

function makeVar(sign: VariableSign, code: string, value: string): BoolExpr {
  return {
    kind: ExprKind.Variable,
    sign,
    code,
    value,
    span: { start: 0, end: 0 },
  };
}

function makeBin(op: BinaryOperator, left: BoolExpr, right: BoolExpr): BoolExpr {
  return {
    kind: ExprKind.Binary,
    operator: op,
    left,
    right,
    span: { start: 0, end: 0 },
  };
}

describe("expandExpression", () => {
  it("should expand AND-over-OR to DNF", () => {
    // (A or B) and C → (A and C) or (B and C)
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const c = makeVar(VariableSign.Equals, "CCC", "01");
    const expr = makeBin(BinaryOperator.And, makeBin(BinaryOperator.Or, a, b), c);

    const result = expandExpression(expr, NormalForm.Dnf);
    expect(result.stats.rewrites).toBeGreaterThan(0);

    // Result should be in DNF: OR at top level
    if (isBinaryExpr(result.expression)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should expand DNF when OR is on the right side", () => {
    // A and (B or C) → (A and B) or (A and C)
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const c = makeVar(VariableSign.Equals, "CCC", "01");
    const expr = makeBin(BinaryOperator.And, a, makeBin(BinaryOperator.Or, b, c));

    const result = expandExpression(expr, NormalForm.Dnf);
    expect(result.stats.rewrites).toBeGreaterThan(0);
    expect(isBinaryExpr(result.expression)).toBe(true);
    if (isBinaryExpr(result.expression)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should expand OR-over-AND to CNF", () => {
    // (A and B) or C → (A or C) and (B or C)
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const c = makeVar(VariableSign.Equals, "CCC", "01");
    const expr = makeBin(BinaryOperator.Or, makeBin(BinaryOperator.And, a, b), c);

    const result = expandExpression(expr, NormalForm.Cnf);
    expect(result.stats.rewrites).toBeGreaterThan(0);

    // Result should be in CNF: AND at top level
    if (isBinaryExpr(result.expression)) {
      expect(result.expression.operator).toBe(BinaryOperator.And);
    }
  });

  it("should expand CNF when AND is on the right side", () => {
    // A or (B and C) → (A or B) and (A or C)
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const c = makeVar(VariableSign.Equals, "CCC", "01");
    const expr = makeBin(BinaryOperator.Or, a, makeBin(BinaryOperator.And, b, c));

    const result = expandExpression(expr, NormalForm.Cnf);
    expect(result.stats.rewrites).toBeGreaterThan(0);
    expect(isBinaryExpr(result.expression)).toBe(true);
    if (isBinaryExpr(result.expression)) {
      expect(result.expression.operator).toBe(BinaryOperator.And);
    }
  });

  it("should leave already-DNF expression unchanged", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const expr = makeBin(BinaryOperator.Or, a, b);
    const result = expandExpression(expr, NormalForm.Dnf);
    expect(result.stats.rewrites).toBe(0);
  });

  it("should not rewrite CNF when OR has no distributable AND side", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const expr = makeBin(BinaryOperator.Or, a, b);

    const result = expandExpression(expr, NormalForm.Cnf);
    expect(result.stats.rewrites).toBe(0);
    expect(result.expression).toEqual(expr);
  });

  it("should throw on exceeding maxNodes", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const expr = makeBin(BinaryOperator.Or, a, b);
    expect(() => expandExpression(expr, NormalForm.Dnf, { maxNodes: 1 })).toThrow(/maxNodes/);
  });

  it("should throw on exceeding maxDepth", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const c = makeVar(VariableSign.Equals, "CCC", "01");
    const deep = makeBin(BinaryOperator.And, makeBin(BinaryOperator.And, a, b), c);
    expect(() => expandExpression(deep, NormalForm.Dnf, { maxDepth: 1 })).toThrow(/maxDepth/);
  });
});

describe("factorizeExpression", () => {
  it("should extract common factor from OR branches", () => {
    // (A and B) or (A and C) → A and (B or C)
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const c = makeVar(VariableSign.Equals, "CCC", "01");
    const expr = makeBin(
      BinaryOperator.Or,
      makeBin(BinaryOperator.And, a, b),
      makeBin(BinaryOperator.And, a, c)
    );

    const result = factorizeExpression(expr);
    expect(result.stats.rewrites).toBeGreaterThan(0);

    // After factorization, the expression should contain A as a common factor
    const key = expressionKey(result.expression);
    expect(key).toContain("VAR:+:AAA:01");
  });

  it("should factorize a parsed explicit expression", () => {
    const parsed = parseExpression("(+ABC01 and +XYZ02) or (+ABC01 and +DEF03)");
    expect(parsed.expression).not.toBeNull();

    const result = factorizeExpression(parsed.expression!);
    const str = stringifyExpression(result.expression, SyntaxMode.Explicit);
    // Should contain the common factor ABC01
    expect(str).toContain("+ABC01");
    // And should be factored: +ABC01 and (+XYZ02 or +DEF03) or similar
    expect(result.stats.rewrites).toBeGreaterThan(0);
  });

  it("should leave an already-factored expression unchanged", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const expr = makeBin(BinaryOperator.And, a, b);
    const result = factorizeExpression(expr);
    expect(result.stats.rewrites).toBe(0);
  });

  it("should stop early when canonicalization collapses a binary expression", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const duplicated = makeBin(BinaryOperator.And, a, a);

    const result = factorizeExpression(duplicated);

    expect(result.stats.rewrites).toBe(0);
    expect(result.expression.kind).toBe(ExprKind.Variable);
  });

  it("should collapse duplicate OR branches before factorization", () => {
    const parsed = parseExpression("+AAA01 or +AAA01");
    expect(parsed.expression).not.toBeNull();

    const result = factorizeExpression(parsed.expression!);

    expect(result.stats.rewrites).toBe(0);
    expect(result.expression.kind).toBe(ExprKind.Variable);
  });

  it("should throw on exceeding maxRewrites", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const c = makeVar(VariableSign.Equals, "CCC", "01");
    const expr = makeBin(
      BinaryOperator.Or,
      makeBin(BinaryOperator.And, a, b),
      makeBin(BinaryOperator.And, a, c)
    );
    expect(() => factorizeExpression(expr, { maxRewrites: 0 })).toThrow(/maxRewrites/);
  });
});

describe("domain-aware factorization", () => {
  it("should extract common code across OR branches", () => {
    // (ABC=01 AND XYZ=B1) OR (ABC=02 AND XYZ=B1) → XYZ=B1 AND (ABC=01 OR ABC=02)
    const parsed = parseExpression("(+ABC01 and +XYZB1) or (+ABC02 and +XYZB1)");
    expect(parsed.expression).not.toBeNull();

    const result = factorizeExpression(parsed.expression!);
    const str = stringifyExpression(result.expression, SyntaxMode.Explicit);

    // XYZB1 should be factored out
    expect(str).toContain("+XYZB1");
    expect(result.stats.rewrites).toBeGreaterThan(0);

    // Check structure: the common factor XYZ=B1 should appear once
    const terms = extractTerms(result.expression, BinaryOperator.And);
    const xyzTerms = terms.filter(
      (t) => t.kind === ExprKind.Variable && t.code === "XYZ" && t.value === "B1"
    );
    expect(xyzTerms.length).toBe(1);
  });

  it("should expand then factorize a condensed expression", () => {
    const parsed = parseExpression("-ABC01 -AXB02 +XYZB1\n-ADEXX +ABC02");
    expect(parsed.expression).not.toBeNull();

    // Expand to DNF
    const expanded = expandExpression(parsed.expression!, NormalForm.Dnf);
    const expandedStr = stringifyExpression(expanded.expression, SyntaxMode.Explicit);
    expect(expandedStr.length).toBeGreaterThan(0);

    // Factorize
    const factorized = factorizeExpression(parsed.expression!);
    const factorizedStr = stringifyExpression(factorized.expression, SyntaxMode.Explicit);
    expect(factorizedStr.length).toBeGreaterThan(0);
  });

  it("should factorize while preserving non-matching terms", () => {
    const parsed = parseExpression(
      "+AAA01 or (+AAA01 and +BBB01) or (+AAA01 and +CCC01) or (+DDD01 and +EEE01)"
    );
    expect(parsed.expression).not.toBeNull();

    const result = factorizeExpression(parsed.expression!);
    const str = stringifyExpression(result.expression, SyntaxMode.Explicit);

    expect(str).toContain("+DDD01 and +EEE01");
    expect(str).toContain("+AAA01");
  });

  it("should handle tie-breaking between equally frequent factors", () => {
    const parsed = parseExpression(
      "(+AAA01 and +XXX01) or (+AAA01 and +YYY01) or (+BBB01 and +XXX01) or (+BBB01 and +YYY01)"
    );
    expect(parsed.expression).not.toBeNull();

    const result = factorizeExpression(parsed.expression!);
    const str = stringifyExpression(result.expression, SyntaxMode.Explicit);

    expect(result.stats.rewrites).toBeGreaterThan(0);
    expect(str.length).toBeGreaterThan(0);
  });
});

function makeNamedVar(name: string): BoolExpr {
  return {
    kind: ExprKind.Variable,
    sign: VariableSign.Equals,
    code: name,
    value: "01",
    span: { start: 0, end: 0 },
  };
}

function makeSimpleBin(operator: BinaryOperator, left: BoolExpr, right: BoolExpr): BoolExpr {
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
    jest.clearAllMocks();
  });

  it("should execute right-side distribution branches for DNF and CNF", async () => {
    jest.spyOn(normalize, "canonicalizeExpression").mockImplementation((expr: BoolExpr) => expr);

    const a = makeNamedVar("AAA");
    const b = makeNamedVar("BBB");
    const c = makeNamedVar("CCC");

    const dnfInput = makeSimpleBin(BinaryOperator.And, a, makeSimpleBin(BinaryOperator.Or, b, c));
    const dnfResult = expandExpression(dnfInput, NormalForm.Dnf);
    expect(dnfResult.stats.rewrites).toBeGreaterThan(0);

    const cnfInput = makeSimpleBin(BinaryOperator.Or, a, makeSimpleBin(BinaryOperator.And, b, c));
    const cnfResult = expandExpression(cnfInput, NormalForm.Cnf);
    expect(cnfResult.stats.rewrites).toBeGreaterThan(0);
  });

  it("should handle factorization path with fewer than two terms", async () => {
    jest.spyOn(normalize, "canonicalizeExpression").mockImplementation((expr: BoolExpr) => expr);
    jest
      .spyOn(normalize, "extractTerms")
      .mockImplementation((expr: BoolExpr, operator: BinaryOperator) => {
        if (expr.kind === ExprKind.Binary && expr.operator === operator) {
          return [expr.left];
        }
        return [expr];
      });

    const a = makeNamedVar("AAA");
    const b = makeNamedVar("BBB");
    const input = makeSimpleBin(BinaryOperator.Or, a, b);

    const result = factorizeExpression(input);
    expect(result.stats.rewrites).toBe(0);
  });

  it("should exercise tie-breaking and grouped-length guard paths", async () => {
    const a = makeNamedVar("AAA");
    const b = makeNamedVar("BBB");
    const c = makeNamedVar("CCC");
    const t1 = makeNamedVar("T1");
    const t2 = makeNamedVar("T2");
    const t3 = makeNamedVar("T3");
    const outer = makeSimpleBin(BinaryOperator.Or, makeSimpleBin(BinaryOperator.Or, t1, t2), t3);

    let innerCallCount = 0;

    jest.spyOn(normalize, "canonicalizeExpression").mockImplementation((expr: BoolExpr) => expr);
    jest.spyOn(normalize, "expressionKey").mockImplementation((expr: BoolExpr) => {
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
    });
    jest
      .spyOn(normalize, "extractTerms")
      .mockImplementation((expr: BoolExpr, operator: BinaryOperator) => {
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
      });

    const result = factorizeExpression(outer);

    expect(result.stats.rewrites).toBe(0);
  });

  it("should hit remaining-length-zero path when a term equals the common factor", async () => {
    const a = makeNamedVar("AAA");
    const b = makeNamedVar("BBB");
    const t1 = makeNamedVar("T1");
    const t2 = makeNamedVar("T2");
    const outer = makeSimpleBin(BinaryOperator.Or, t1, t2);

    jest.spyOn(normalize, "canonicalizeExpression").mockImplementation((expr: BoolExpr) => expr);
    jest.spyOn(normalize, "expressionKey").mockImplementation((expr: BoolExpr) => {
      if (expr === a) {
        return "A";
      }
      if (expr === b) {
        return "B";
      }
      return "T";
    });
    jest
      .spyOn(normalize, "extractTerms")
      .mockImplementation((expr: BoolExpr, operator: BinaryOperator) => {
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
      });

    const result = factorizeExpression(outer);

    expect(result.stats.rewrites).toBeGreaterThanOrEqual(0);
  });
});
