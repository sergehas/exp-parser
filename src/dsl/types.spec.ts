import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  NormalForm,
  VariableSign,
  isBinaryExpr,
  isVariableExpr,
} from "./types";

describe("type guards", () => {
  const varExpr: BoolExpr = {
    kind: ExprKind.Variable,
    sign: VariableSign.Equals,
    code: "ABC",
    value: "01",
    span: { start: 0, end: 6 },
  };

  const binExpr: BoolExpr = {
    kind: ExprKind.Binary,
    operator: BinaryOperator.And,
    left: varExpr,
    right: varExpr,
    span: { start: 0, end: 12 },
  };

  describe("isVariableExpr", () => {
    it("should return true for VariableExpr", () => {
      expect(isVariableExpr(varExpr)).toBe(true);
    });

    it("should return false for BinaryExpr", () => {
      expect(isVariableExpr(binExpr)).toBe(false);
    });
  });

  describe("isBinaryExpr", () => {
    it("should return true for BinaryExpr", () => {
      expect(isBinaryExpr(binExpr)).toBe(true);
    });

    it("should return false for VariableExpr", () => {
      expect(isBinaryExpr(varExpr)).toBe(false);
    });
  });
});

describe("enums", () => {
  it("should have correct VariableSign values", () => {
    expect(VariableSign.Equals).toBe("+");
    expect(VariableSign.NotEquals).toBe("-");
  });

  it("should have correct BinaryOperator values", () => {
    expect(BinaryOperator.And).toBe("AND");
    expect(BinaryOperator.Or).toBe("OR");
  });

  it("should have correct ExprKind values", () => {
    expect(ExprKind.Variable).toBe("Variable");
    expect(ExprKind.Binary).toBe("Binary");
  });

  it("should have correct NormalForm values", () => {
    expect(NormalForm.Dnf).toBe("DNF");
    expect(NormalForm.Cnf).toBe("CNF");
  });
});
