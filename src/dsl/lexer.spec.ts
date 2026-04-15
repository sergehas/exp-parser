import { SyntaxMode } from "./detect";
import { TokenType, tokenize } from "./lexer";
import { VariableSign } from "./types";

describe("tokenize — explicit mode", () => {
  it("should tokenize a simple variable", () => {
    const result = tokenize("+ABC01", SyntaxMode.Explicit);
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
    const result = tokenize("-XYZ02", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      type: TokenType.Variable,
      sign: VariableSign.NotEquals,
      code: "XYZ",
      value: "02",
    });
  });

  it("should normalize code and value to uppercase", () => {
    const result = tokenize("+abc01", SyntaxMode.Explicit);
    expect(result.tokens[0]).toMatchObject({
      code: "ABC",
      value: "01",
    });
  });

  it("should tokenize 'and' and 'or' keywords (case-insensitive)", () => {
    const result = tokenize("+ABC01 AND -XYZ02 or +DEF03", SyntaxMode.Explicit);
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
    const result = tokenize("(+ABC01)", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([TokenType.LParen, TokenType.Variable, TokenType.RParen, TokenType.Eof]);
  });

  it("should skip all whitespace including newlines", () => {
    const result = tokenize("+ABC01\n  and\n+XYZ02", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    const types = result.tokens.map((t) => t.type);
    expect(types).toEqual([TokenType.Variable, TokenType.And, TokenType.Variable, TokenType.Eof]);
  });

  it("should emit diagnostics for unexpected characters", () => {
    const result = tokenize("+ABC01 @ +XYZ02", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain("@");
  });

  it("should handle a 1-char value (5 char total variable)", () => {
    const result = tokenize("+XYZB1", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    // body is XYZB1 → code=XYZ, value=B1 (2 chars since body is 5)
    // Wait — +XYZB1 is 6 chars total, body is 5 chars → code=XYZ, value=B1
    expect(result.tokens[0]).toMatchObject({
      code: "XYZ",
      value: "B1",
    });
  });

  it("should handle a 1-char value variable (4 char body)", () => {
    const result = tokenize("+ABCX", SyntaxMode.Explicit);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.tokens[0]).toMatchObject({
      code: "ABC",
      value: "X",
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

  it("should handle \\r\\n line endings", () => {
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
    expect(result.diagnostics[0]!.message).toContain("$");
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
