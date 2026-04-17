import { SyntaxMode, detectSyntax } from "./detect";

describe("detectSyntax", () => {
  it("should detect explicit syntax with 'and' keyword", () => {
    expect(detectSyntax("ABC:01 and XYZ!02")).toBe(SyntaxMode.Explicit);
  });

  it("should detect explicit syntax with 'or' keyword", () => {
    expect(detectSyntax("ABC:01 or XYZ!02")).toBe(SyntaxMode.Explicit);
  });

  it("should detect explicit syntax with 'AND' (case-insensitive)", () => {
    expect(detectSyntax("ABC:01 AND XYZ!02")).toBe(SyntaxMode.Explicit);
  });

  it("should detect explicit syntax with 'Or' (mixed case)", () => {
    expect(detectSyntax("ABC:01 Or XYZ!02")).toBe(SyntaxMode.Explicit);
  });

  it("should detect explicit syntax with parentheses", () => {
    expect(detectSyntax("(ABC:01)")).toBe(SyntaxMode.Explicit);
  });

  it("should detect explicit syntax with closing parenthesis", () => {
    expect(detectSyntax("ABC:01)")).toBe(SyntaxMode.Explicit);
  });

  it("should detect explicit syntax with colon variable format", () => {
    expect(detectSyntax("ABC:01")).toBe(SyntaxMode.Explicit);
  });

  it("should detect explicit syntax with bang variable format", () => {
    expect(detectSyntax("XYZ!02")).toBe(SyntaxMode.Explicit);
  });

  it("should detect condensed syntax without keywords or parens", () => {
    expect(detectSyntax("+ABC01 -XYZ02")).toBe(SyntaxMode.Condensed);
  });

  it("should detect condensed syntax with newlines", () => {
    expect(detectSyntax("+ABC01\n-XYZ02")).toBe(SyntaxMode.Condensed);
  });

  it("should detect condensed syntax for empty string", () => {
    expect(detectSyntax("")).toBe(SyntaxMode.Condensed);
  });

  it("should not false-positive on 'and' inside a variable code", () => {
    // Variable codes are 3 chars after +/-, so 'and' alone is not a variable
    // but 'sand' or 'anderson' could appear — word boundary ensures standalone match
    expect(detectSyntax("+AND01")).toBe(SyntaxMode.Condensed);
  });

  it("should detect explicit when 'and' is standalone word", () => {
    expect(detectSyntax("ABC:01 and DEF:02")).toBe(SyntaxMode.Explicit);
  });
});
