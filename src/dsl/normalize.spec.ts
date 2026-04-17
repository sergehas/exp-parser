import {
  canonicalizeExpression,
  expressionKey,
  extractTerms,
  maxDepth,
  nodeCount,
} from "./normalize";
import { parseExpression } from "./parser";
import { BinaryOperator, BoolExpr, ExprKind, VariableSign } from "./types";

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

describe("expressionKey", () => {
  it("should produce a key for a variable", () => {
    const key = expressionKey(makeVar(VariableSign.Equals, "ABC", "01"));
    expect(key).toBe("VAR:+:ABC:01");
  });

  it("should produce a key for a negated variable", () => {
    const key = expressionKey(makeVar(VariableSign.NotEquals, "XYZ", "02"));
    expect(key).toBe("VAR:-:XYZ:02");
  });

  it("should produce a key for a binary expression", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const b = makeVar(VariableSign.NotEquals, "XYZ", "02");
    const key = expressionKey(makeBin(BinaryOperator.And, a, b));
    expect(key).toBe("AND(VAR:-:XYZ:02,VAR:+:ABC:01)");
  });

  it("should sort terms in key for commutative comparison", () => {
    const a = makeVar(VariableSign.Equals, "ZZZ", "01");
    const b = makeVar(VariableSign.Equals, "AAA", "01");
    const key = expressionKey(makeBin(BinaryOperator.Or, a, b));
    expect(key).toBe("OR(VAR:+:AAA:01,VAR:+:ZZZ:01)");
  });
});

describe("extractTerms", () => {
  it("should extract terms from an AND chain", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const b = makeVar(VariableSign.Equals, "DEF", "02");
    const c = makeVar(VariableSign.Equals, "GHI", "03");
    const expr = makeBin(BinaryOperator.And, makeBin(BinaryOperator.And, a, b), c);
    const terms = extractTerms(expr, BinaryOperator.And);
    expect(terms).toHaveLength(3);
  });

  it("should not extract across different operators", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const b = makeVar(VariableSign.Equals, "DEF", "02");
    const expr = makeBin(BinaryOperator.Or, a, b);
    const terms = extractTerms(expr, BinaryOperator.And);
    expect(terms).toHaveLength(1);
  });

  it("should return single variable as one term", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const terms = extractTerms(a, BinaryOperator.And);
    expect(terms).toHaveLength(1);
  });
});

describe("canonicalizeExpression", () => {
  it("should return a variable as-is", () => {
    const v = makeVar(VariableSign.Equals, "ABC", "01");
    expect(canonicalizeExpression(v)).toEqual(v);
  });

  it("should sort AND terms alphabetically", () => {
    const result = parseExpression("ZZZ:01 and AAA:01");
    expect(result.expression).not.toBeNull();
    const canonical = canonicalizeExpression(result.expression!);
    // After canonicalization the key for AAA should come first
    const key = expressionKey(canonical);
    expect(key).toBe("AND(VAR:+:AAA:01,VAR:+:ZZZ:01)");
  });

  it("should deduplicate identical terms", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const expr = makeBin(BinaryOperator.And, a, a);
    const canonical = canonicalizeExpression(expr);
    // Deduplication should reduce A AND A to just A
    expect(canonical.kind).toBe(ExprKind.Variable);
  });

  it("should apply absorption: A OR (A AND B) = A", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const b = makeVar(VariableSign.Equals, "DEF", "02");
    const expr = makeBin(BinaryOperator.Or, a, makeBin(BinaryOperator.And, a, b));
    const canonical = canonicalizeExpression(expr);
    expect(expressionKey(canonical)).toBe("VAR:+:ABC:01");
  });
});

describe("nodeCount", () => {
  it("should return 1 for a variable", () => {
    expect(nodeCount(makeVar(VariableSign.Equals, "ABC", "01"))).toBe(1);
  });

  it("should count all nodes in a binary tree", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const b = makeVar(VariableSign.Equals, "DEF", "02");
    expect(nodeCount(makeBin(BinaryOperator.And, a, b))).toBe(3);
  });
});

describe("maxDepth", () => {
  it("should return 1 for a variable", () => {
    expect(maxDepth(makeVar(VariableSign.Equals, "ABC", "01"))).toBe(1);
  });

  it("should return correct depth for a chain", () => {
    const a = makeVar(VariableSign.Equals, "ABC", "01");
    const b = makeVar(VariableSign.Equals, "DEF", "02");
    const c = makeVar(VariableSign.Equals, "GHI", "03");
    const expr = makeBin(BinaryOperator.And, makeBin(BinaryOperator.And, a, b), c);
    expect(maxDepth(expr)).toBe(3);
  });
});
