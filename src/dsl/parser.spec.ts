import { SyntaxMode } from "./detect";
import { parseExpression, stringifyExpression } from "./parser";
import { BinaryOperator, ExprKind, VariableSign, isBinaryExpr, isVariableExpr } from "./types";

describe("parseExpression — condensed syntax", () => {
  it("should parse a single variable", () => {
    const result = parseExpression("+ABC01");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    expect(result.expression!.kind).toBe(ExprKind.Variable);
    if (isVariableExpr(result.expression!)) {
      expect(result.expression!.sign).toBe(VariableSign.Equals);
      expect(result.expression!.code).toBe("ABC");
      expect(result.expression!.value).toBe("01");
    }
  });

  it("should parse space-separated variables as AND", () => {
    const result = parseExpression("+ABC01 -XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    expect(isBinaryExpr(result.expression!)).toBe(true);
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.And);
    }
  });

  it("should parse newline-separated groups as OR", () => {
    const result = parseExpression("+ABC01\n-XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should parse multi-line multi-variable expression", () => {
    const result = parseExpression("-ABC01 -AXB02 +XYZB1\n-ADEXX +ABC02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    // Top-level should be OR (two lines)
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.Or);
      // Left should be AND chain of 3 variables
      expect(isBinaryExpr(result.expression!.left)).toBe(true);
      // Right should be AND chain of 2 variables
      expect(isBinaryExpr(result.expression!.right)).toBe(true);
    }
  });

  it("should skip blank lines", () => {
    const result = parseExpression("+ABC01\n\n-XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should return diagnostics for empty input", () => {
    const result = parseExpression("");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("parseExpression — explicit syntax", () => {
  it("should parse simple AND expression", () => {
    const result = parseExpression("+ABC01 and -XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.And);
    }
  });

  it("should parse simple OR expression", () => {
    const result = parseExpression("+ABC01 or -XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should respect AND > OR precedence", () => {
    const result = parseExpression("+ABC01 or -XYZ02 and +DEF03");
    expect(result.diagnostics).toHaveLength(0);
    // Should parse as: +ABC01 or (-XYZ02 and +DEF03)
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.Or);
      expect(isBinaryExpr(result.expression!.right)).toBe(true);
      if (isBinaryExpr(result.expression!.right)) {
        expect(result.expression!.right.operator).toBe(BinaryOperator.And);
      }
    }
  });

  it("should parse parenthesized groups", () => {
    const result = parseExpression("(-ABC01 and -AXB02 and +XYZB1) or (-ADEXX and +ABC02)");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression!.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should handle nested parentheses", () => {
    const result = parseExpression("(+ABC01 and (+XYZ02 or +DEF03))");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
  });

  it("should report error for missing closing paren", () => {
    const result = parseExpression("(+ABC01 and +XYZ02");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("should report error for empty parens", () => {
    const result = parseExpression("()");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("should handle case-insensitive keywords", () => {
    const result = parseExpression("+ABC01 AND -XYZ02 OR +DEF03");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
  });
});

describe("stringifyExpression — explicit mode", () => {
  it("should stringify a single variable", () => {
    const result = parseExpression("+ABC01");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("+ABC01");
  });

  it("should stringify AND with lowercase operator", () => {
    const result = parseExpression("+ABC01 and -XYZ02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("+ABC01 and -XYZ02");
  });

  it("should stringify OR with lowercase operator", () => {
    const result = parseExpression("+ABC01 or -XYZ02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("+ABC01 or -XYZ02");
  });

  it("should add parentheses for OR inside AND", () => {
    const result = parseExpression("+ABC01 and (+XYZ02 or +DEF03)");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("+ABC01 and (+XYZ02 or +DEF03)");
  });

  it("should output codes in uppercase", () => {
    const result = parseExpression("+abc01 and -xyz02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("+ABC01 and -XYZ02");
  });
});

describe("stringifyExpression — condensed mode", () => {
  it("should stringify a single variable", () => {
    const result = parseExpression("+ABC01");
    const str = stringifyExpression(result.expression!, SyntaxMode.Condensed);
    expect(str).toBe("+ABC01");
  });

  it("should stringify AND as space-separated", () => {
    const result = parseExpression("+ABC01 -XYZ02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Condensed);
    expect(str).toBe("+ABC01 -XYZ02");
  });

  it("should stringify OR as newline-separated", () => {
    const result = parseExpression("+ABC01\n-XYZ02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Condensed);
    expect(str).toContain("\n");
  });

  it("should stringify multi-line expression", () => {
    const result = parseExpression("-ABC01 +XYZ02\n-DEF03 +GHI04");
    expect(result.diagnostics).toHaveLength(0);
    const str = stringifyExpression(result.expression!, SyntaxMode.Condensed);
    const lines = str.split("\n");
    expect(lines).toHaveLength(2);
  });
});

describe("roundtrip: parse → stringify → parse", () => {
  const inputs = [
    "+ABC01 and -XYZ02",
    "(+ABC01 or -XYZ02) and +DEF03",
    "(-ABC01 and -AXB02 and +XYZB1) or (-ADEXX and +ABC02)",
  ];

  for (const input of inputs) {
    it(`should roundtrip explicit: ${input}`, () => {
      const parsed1 = parseExpression(input);
      expect(parsed1.expression).not.toBeNull();
      const str = stringifyExpression(parsed1.expression!, SyntaxMode.Explicit);
      const parsed2 = parseExpression(str);
      expect(parsed2.expression).not.toBeNull();
      const str2 = stringifyExpression(parsed2.expression!, SyntaxMode.Explicit);
      expect(str2).toBe(str);
    });
  }
});
