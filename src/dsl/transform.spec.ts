import { SyntaxMode } from "./detect";
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

  it("should leave already-DNF expression unchanged", () => {
    const a = makeVar(VariableSign.Equals, "AAA", "01");
    const b = makeVar(VariableSign.Equals, "BBB", "01");
    const expr = makeBin(BinaryOperator.Or, a, b);
    const result = expandExpression(expr, NormalForm.Dnf);
    expect(result.stats.rewrites).toBe(0);
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
});
