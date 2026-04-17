import { SyntaxMode } from "./detect";
import { TokenType, tokenize } from "./lexer";
import { VariableSign } from "./types";

describe("tokenize — explicit mode", () => {
  it("should tokenize a simple variable", () => {
    const result = tokenize("ABC:01", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens).toHaveLength(2); // Variable + Eof
    expect(result.tokens[0]).toMatchObject({
      type: TokenType.Variable,
      sign: VariableSign.Equals,
      code: "ABC",
      value: "01",
    });
  });

  it("should tokenize a negated variable", () => {
    const result = tokenize("XYZ!02", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      type: TokenType.Variable,
      sign: VariableSign.NotEquals,
      code: "XYZ",
      value: "02",
    });
  });

  it("should normalize code and value to uppercase", () => {
    const result = tokenize("abc:01", SyntaxMode.Explicit);
    expect(result.tokens[0]).toMatchObject({
      code: "ABC",
      value: "01",
    });
  });

  it("should tokenize 'and' and 'or' keywords (case-insensitive)", () => {
    const result = tokenize("ABC:01 AND XYZ!02 or DEF:03", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.Variable,
      TokenType.And,
      TokenType.Variable,
      TokenType.Or,
      TokenType.Variable,
      TokenType.Eof,
    ]);
  });

  it("should tokenize parentheses", () => {
    const result = tokenize("(ABC:01)", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([TokenType.LParen, TokenType.Variable, TokenType.RParen, TokenType.Eof]);
  });

  it("should skip all whitespace including newlines", () => {
    const result = tokenize("ABC:01\n  and\nXYZ:02", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([TokenType.Variable, TokenType.And, TokenType.Variable, TokenType.Eof]);
  });

  it("should emit diagnostics for unexpected characters", () => {
    const result = tokenize("ABC:01 @ XYZ:02", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("@");
  });

  it("should handle a 2-char value variable", () => {
    const result = tokenize("XYZ:B1", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      code: "XYZ",
      value: "B1",
    });
  });

  it("should handle a 1-char value variable", () => {
    const result = tokenize("ABC:X", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      code: "ABC",
      value: "X",
    });
  });

  it("should tokenize a variable whose code matches a keyword", () => {
    const result = tokenize("AND:01", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      type: TokenType.Variable,
      sign: VariableSign.Equals,
      code: "AND",
      value: "01",
    });
  });
});

describe("tokenize — explicit mode IN expressions", () => {
  it("should tokenize an equals IN expression", () => {
    const result = tokenize("ABC:(A0 A3 B4)", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens).toHaveLength(2); // In + Eof
    expect(result.tokens[0]).toMatchObject({
      type: TokenType.In,
      sign: VariableSign.Equals,
      code: "ABC",
      values: ["A0", "A3", "B4"],
    });
  });

  it("should tokenize a not-equals IN expression", () => {
    const result = tokenize("ABC!(A0 A3)", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      type: TokenType.In,
      sign: VariableSign.NotEquals,
      code: "ABC",
      values: ["A0", "A3"],
    });
  });

  it("should normalize IN code and values to uppercase", () => {
    const result = tokenize("abc:(a0 b1)", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      code: "ABC",
      values: ["A0", "B1"],
    });
  });

  it("should tokenize a single-value IN expression", () => {
    const result = tokenize("ABC:(A0)", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      type: TokenType.In,
      values: ["A0"],
    });
  });

  it("should emit diagnostic for empty IN expression", () => {
    const result = tokenize("ABC:()", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("Empty IN expression");
  });

  it("should tokenize IN expression combined with operators", () => {
    const result = tokenize("ABC:(A0 A3) and XYZ:01", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([TokenType.In, TokenType.And, TokenType.Variable, TokenType.Eof]);
  });

  it("should handle extra whitespace inside IN parentheses", () => {
    const result = tokenize("ABC:(  A0   B1  )", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      values: ["A0", "B1"],
    });
  });
});

describe("tokenize — condensed mode", () => {
  it("should tokenize variables separated by spaces", () => {
    const result = tokenize("+ABC01 -XYZ02", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([TokenType.Variable, TokenType.Variable, TokenType.Eof]);
  });

  it("should emit Newline token for line breaks between non-empty lines", () => {
    const result = tokenize("+ABC01\n-XYZ02", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.Variable,
      TokenType.Newline,
      TokenType.Variable,
      TokenType.Eof,
    ]);
  });

  it("should handle CRLF line endings", () => {
    const result = tokenize("+ABC01\r\n-XYZ02", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.Variable,
      TokenType.Newline,
      TokenType.Variable,
      TokenType.Eof,
    ]);
  });

  it("should skip blank lines", () => {
    const result = tokenize("+ABC01\n\n-XYZ02", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.Variable,
      TokenType.Newline,
      TokenType.Variable,
      TokenType.Eof,
    ]);
  });

  it("should collapse multiple spaces", () => {
    const result = tokenize("+ABC01   +XYZ02", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens.filter((t) => t.type === TokenType.Variable)).toHaveLength(2);
  });

  it("should normalize variable codes to uppercase", () => {
    const result = tokenize("+abc01", SyntaxMode.Condensed);
    expect(result.tokens[0]).toMatchObject({
      code: "ABC",
      value: "01",
    });
  });

  it("should skip leading/trailing blank lines", () => {
    const result = tokenize("\n\n+ABC01\n\n", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    // Leading blank lines skipped, trailing newline after last variable is emitted
    expect(types).toEqual([TokenType.Variable, TokenType.Newline, TokenType.Eof]);
  });

  it("should emit diagnostics for unexpected characters", () => {
    const result = tokenize("+ABC01 $ +XYZ02", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain("$");
  });

  it("should handle multiple lines with multiple variables", () => {
    const result = tokenize("-ABC01 -AXB02 +XYZB1\n-ADEXX +ABC02", SyntaxMode.Condensed);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.Variable,
      TokenType.Variable,
      TokenType.Variable,
      TokenType.Newline,
      TokenType.Variable,
      TokenType.Variable,
      TokenType.Eof,
    ]);
  });
});
