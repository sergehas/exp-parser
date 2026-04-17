import * as detect from "./detect";
import { SyntaxMode } from "./detect";
import * as lexer from "./lexer";
import { parseExpression, stringifyExpression } from "./parser";
import { factorizeExpression } from "./transform";

import { TokenType } from "./lexer";
import {
  BinaryOperator,
  BoolExpr,
  ExprKind,
  VariableSign,
  isBinaryExpr,
  isVariableExpr,
} from "./types";

describe("parseExpression — condensed syntax", () => {
  it("should parse a single variable", () => {
    const result = parseExpression("+ABC01");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    expect(result.expression!.kind).toBe(ExprKind.Variable);
    if (isVariableExpr(result.expression!)) {
      expect(result.expression.sign).toBe(VariableSign.Equals);
      expect(result.expression.code).toBe("ABC");
      expect(result.expression.value).toBe("01");
    }
  });

  it("should parse space-separated variables as AND", () => {
    const result = parseExpression("+ABC01 -XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    expect(isBinaryExpr(result.expression!)).toBe(true);
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.And);
    }
  });

  it("should parse newline-separated groups as OR", () => {
    const result = parseExpression("+ABC01\n-XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should parse multi-line multi-variable expression", () => {
    const result = parseExpression("-ABC01 -AXB02 +XYZB1\n-ADEXX +ABC02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    // Top-level should be OR (two lines)
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
      // Left should be AND chain of 3 variables
      expect(isBinaryExpr(result.expression.left)).toBe(true);
      // Right should be AND chain of 2 variables
      expect(isBinaryExpr(result.expression.right)).toBe(true);
    }
  });

  it("should skip blank lines", () => {
    const result = parseExpression("+ABC01\n\n-XYZ02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
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
    const result = parseExpression("ABC:01 and XYZ!02");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.And);
    }
  });

  it("should return lexer diagnostics without parsing when tokenization fails", () => {
    const result = parseExpression("ABC:01 and @");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("should report unexpected trailing token", () => {
    const result = parseExpression("ABC:01 and XYZ!02 DEF:03");
    expect(result.expression).toBeNull();
    expect(
      result.diagnostics.some((diag) => diag.message.includes("Unexpected trailing token"))
    ).toBe(true);
  });

  it("should report parse error when operator has missing right-hand side", () => {
    const result = parseExpression("ABC:01 and )");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("should parse simple OR expression", () => {
    const result = parseExpression("ABC:01 or XYZ!02");
    expect(result.diagnostics).toHaveLength(0);
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should respect AND > OR precedence", () => {
    const result = parseExpression("ABC:01 or XYZ!02 and DEF:03");
    expect(result.diagnostics).toHaveLength(0);
    // Should parse as: ABC:01 or (XYZ!02 and DEF:03)
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
      expect(isBinaryExpr(result.expression.right)).toBe(true);
      if (isBinaryExpr(result.expression.right)) {
        expect(result.expression.right.operator).toBe(BinaryOperator.And);
      }
    }
  });

  it("should parse parenthesized groups", () => {
    const result = parseExpression("(ABC!01 and AXB!02 and XYZ:B1) or (ADE!XX and ABC:02)");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should handle nested parentheses", () => {
    const result = parseExpression("(ABC:01 and (XYZ:02 or DEF:03))");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
  });

  it("should report error for missing closing paren", () => {
    const result = parseExpression("(ABC:01 and XYZ:02");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("should report error for empty parens", () => {
    const result = parseExpression("()");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("should handle case-insensitive keywords", () => {
    const result = parseExpression("ABC:01 AND XYZ!02 OR DEF:03");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
  });
});

describe("stringifyExpression — explicit mode", () => {
  it("should stringify a single variable", () => {
    const result = parseExpression("ABC:01");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:01");
  });

  it("should stringify AND with lowercase operator", () => {
    const result = parseExpression("ABC:01 and XYZ!02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:01 and XYZ!02");
  });

  it("should stringify OR with lowercase operator", () => {
    const result = parseExpression("ABC:01 or XYZ!02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:01 or XYZ!02");
  });

  it("should add parentheses for OR inside AND", () => {
    const result = parseExpression("ABC:01 and (XYZ:02 or DEF:03)");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:01 and (XYZ:02 or DEF:03)");
  });

  it("should output codes in uppercase", () => {
    const result = parseExpression("abc:01 and xyz!02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:01 and XYZ!02");
  });
});

describe("stringifyExpression — condensed mode", () => {
  it("should stringify a single variable", () => {
    const result = parseExpression("+ABC01");
    const str = stringifyExpression(result.expression!, SyntaxMode.Condensed);
    expect(str).toBe("+ABC01");
  });

  it("should expand OR-inside-AND to DNF when stringifying condensed", () => {
    const expression: BoolExpr = {
      kind: ExprKind.Binary,
      operator: BinaryOperator.And,
      left: {
        kind: ExprKind.Binary,
        operator: BinaryOperator.Or,
        left: {
          kind: ExprKind.Variable,
          sign: VariableSign.Equals,
          code: "ABC",
          value: "01",
          span: { start: 0, end: 0 },
        },
        right: {
          kind: ExprKind.Variable,
          sign: VariableSign.NotEquals,
          code: "XYZ",
          value: "02",
          span: { start: 0, end: 0 },
        },
        span: { start: 0, end: 0 },
      },
      right: {
        kind: ExprKind.Variable,
        sign: VariableSign.Equals,
        code: "DEF",
        value: "03",
        span: { start: 0, end: 0 },
      },
      span: { start: 0, end: 0 },
    };

    const str = stringifyExpression(expression, SyntaxMode.Condensed);
    // DNF expansion: (ABC:01 OR XYZ!02) AND DEF:03 → (ABC:01 AND DEF:03) OR (XYZ!02 AND DEF:03)
    const lines = str.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("+ABC01 +DEF03");
    expect(lines[1]).toBe("-XYZ02 +DEF03");
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
    "ABC:01 and XYZ!02",
    "(ABC:01 or XYZ!02) and DEF:03",
    "(ABC!01 and AXB!02 and XYZ:B1) or (ADE!XX and ABC:02)",
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

describe("parseExpression — IN syntax", () => {
  it("should parse equals IN as OR-chain", () => {
    const result = parseExpression("ABC:(A0 A3 B4)");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    // Top-level should be OR
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should parse not-equals IN as AND-chain", () => {
    const result = parseExpression("ABC!(A0 A3)");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.And);
    }
  });

  it("should parse single-value IN as single variable", () => {
    const result = parseExpression("ABC:(A0)");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isVariableExpr(result.expression!)) {
      expect(result.expression.code).toBe("ABC");
      expect(result.expression.sign).toBe(VariableSign.Equals);
      expect(result.expression.value).toBe("A0");
    }
  });

  it("should parse IN combined with AND operator", () => {
    const result = parseExpression("XYZ:01 and ABC:(A0 A3)");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    // Top-level should be AND (AND binds tighter than the OR inside IN)
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.And);
    }
  });

  it("should emit diagnostic for empty IN", () => {
    const result = parseExpression("ABC:()");
    expect(result.expression).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("stringifyExpression — IN folding", () => {
  it("should fold same-code Equals OR-chain into IN syntax", () => {
    const result = parseExpression("ABC:01 or ABC:A3 or ABC:B4");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:(01 A3 B4)");
  });

  it("should fold same-code NotEquals AND-chain into IN syntax", () => {
    const result = parseExpression("ABC!01 and ABC!A3");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC!(01 A3)");
  });

  it("should not fold OR-chain with mixed codes", () => {
    const result = parseExpression("ABC:01 or XYZ:02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:01 or XYZ:02");
  });

  it("should not fold OR-chain with NotEquals sign", () => {
    const result = parseExpression("ABC!01 or ABC!02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC!01 or ABC!02");
  });

  it("should not fold AND-chain with Equals sign", () => {
    const result = parseExpression("ABC:01 and ABC:02");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("ABC:01 and ABC:02");
  });

  it("should partially fold OR-chain with mixed codes", () => {
    const result = parseExpression("DEF:01 or XYZ:02 or XYZ:03 or XYZ:04");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("DEF:01 or XYZ:(02 03 04)");
  });

  it("should partially fold NOT IN inside AND-chain with mixed codes", () => {
    const result = parseExpression("DEF!01 and XYZ!02 and XYZ!03 and XYZ!04");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("DEF!01 and XYZ!(02 03 04)");
  });

  it("should keep precedence when partially folding OR inside AND", () => {
    const result = parseExpression("(DEF:01 or XYZ:02 or XYZ:03 or XYZ:04) and ABC:01");
    const str = stringifyExpression(result.expression!, SyntaxMode.Explicit);
    expect(str).toBe("(DEF:01 or XYZ:(02 03 04)) and ABC:01");
  });

  it("should preserve IN grouping after factorization with extra OR term", () => {
    const parsed = parseExpression(
      "ABC:01 and XYZ:02 or ABC:01 and XYZ:03 or ABC:01 and XYZ:04 or DEF:01 and ABC:01"
    );

    expect(parsed.diagnostics).toHaveLength(0);
    expect(parsed.expression).not.toBeNull();

    const factorized = factorizeExpression(parsed.expression!);
    const str = stringifyExpression(factorized.expression, SyntaxMode.Explicit);

    expect(str).toBe("(DEF:01 or XYZ:(02 03 04)) and ABC:01");
  });
});

describe("roundtrip: IN syntax", () => {
  const inputs = [
    "ABC:(A0 A3 B4)",
    "ABC!(A0 A3)",
    "XYZ:01 and ABC:(A0 A3)",
    "ABC:(A0 A3) or DEF:01",
  ];

  for (const input of inputs) {
    it(`should roundtrip IN: ${input}`, () => {
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

//---------------------------------
describe("parseExpression internals with mocked lexer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should default missing variable token fields during explicit parse", async () => {
    jest.spyOn(detect, "detectSyntax").mockReturnValue(SyntaxMode.Explicit);
    jest.spyOn(lexer, "tokenize").mockImplementation(() => ({
      tokens: [
        {
          type: TokenType.Variable,
          start: 0,
          end: 1,
        },
        {
          type: TokenType.Eof,
          start: 1,
          end: 1,
        },
      ],
      diagnostics: [],
    }));

    const result = parseExpression("ignored");

    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    expect(result.expression).toMatchObject({
      kind: ExprKind.Variable,
      sign: VariableSign.Equals,
      code: "",
      value: "",
    });
  });

  it("should throw when lexer returns an empty token stream", async () => {
    jest.spyOn(detect, "detectSyntax").mockReturnValue(SyntaxMode.Explicit);
    jest.spyOn(lexer, "tokenize").mockImplementation(() => ({
      tokens: [],
      diagnostics: [],
    }));

    expect(() => parseExpression("ignored")).toThrow();
  });

  it("should default missing IN token fields and emit diagnostic for empty values", () => {
    jest.spyOn(detect, "detectSyntax").mockReturnValue(SyntaxMode.Explicit);
    jest.spyOn(lexer, "tokenize").mockImplementation(() => ({
      tokens: [
        {
          type: TokenType.In,
          start: 0,
          end: 5,
          // code, sign, values intentionally omitted
        },
        {
          type: TokenType.Eof,
          start: 5,
          end: 5,
        },
      ],
      diagnostics: [],
    }));

    const result = parseExpression("ignored");

    expect(result.expression).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: "Empty IN expression." })
    );
  });

  it("should default missing condensed token fields via nullish coalescing", () => {
    jest.spyOn(detect, "detectSyntax").mockReturnValue(SyntaxMode.Condensed);
    jest.spyOn(lexer, "tokenize").mockImplementation(() => ({
      tokens: [
        {
          type: TokenType.Variable,
          start: 0,
          end: 3,
          // sign, code, value intentionally omitted
        },
        {
          type: TokenType.Eof,
          start: 3,
          end: 3,
        },
      ],
      diagnostics: [],
    }));

    const result = parseExpression("ignored");

    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    expect(result.expression).toMatchObject({
      kind: ExprKind.Variable,
      sign: VariableSign.Equals,
      code: "",
      value: "",
    });
  });

  it("should handle consecutive newlines in condensed mode", () => {
    jest.spyOn(detect, "detectSyntax").mockReturnValue(SyntaxMode.Condensed);
    jest.spyOn(lexer, "tokenize").mockImplementation(() => ({
      tokens: [
        {
          type: TokenType.Variable,
          sign: VariableSign.Equals,
          code: "ABC",
          value: "01",
          start: 0,
          end: 6,
        },
        { type: TokenType.Newline, start: 6, end: 7 },
        { type: TokenType.Newline, start: 7, end: 8 },
        {
          type: TokenType.Variable,
          sign: VariableSign.NotEquals,
          code: "XYZ",
          value: "02",
          start: 8,
          end: 14,
        },
        { type: TokenType.Eof, start: 14, end: 14 },
      ],
      diagnostics: [],
    }));

    const result = parseExpression("ignored");

    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    if (isBinaryExpr(result.expression!)) {
      expect(result.expression.operator).toBe(BinaryOperator.Or);
    }
  });

  it("should use fallback when current token index exceeds array bounds", () => {
    jest.spyOn(detect, "detectSyntax").mockReturnValue(SyntaxMode.Explicit);
    jest.spyOn(lexer, "tokenize").mockImplementation(() => ({
      tokens: [
        {
          type: TokenType.Variable,
          sign: VariableSign.Equals,
          code: "ABC",
          value: "01",
          start: 0,
          end: 6,
        },
        // Missing Eof — forces parser to rely on at(-1) fallback
      ],
      diagnostics: [],
    }));

    const result = parseExpression("ignored");

    // Parser reads variable, then tries to get next token.
    // tokens[1] is undefined, fallback to tokens.at(-1) which is the Variable token.
    // Variable token is not And/Or so loop breaks, then checks for Eof which fails.
    expect(result.expression).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: "Unexpected trailing token." })
    );
  });
});
