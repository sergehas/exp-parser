import { parseExpression, stringifyExpression } from "./parser";

describe("booleanDsl/parser", () => {
  it("should parse AND before OR", () => {
    const parsed = parseExpression("a OR b AND c");
    expect(parsed.diagnostics).toHaveLength(0);
    expect(parsed.expression).not.toBeNull();
    expect(stringifyExpression(parsed.expression!)).toBe("a OR b AND c");
  });

  it("should preserve explicit parentheses", () => {
    const parsed = parseExpression("(a OR b) AND c");
    expect(parsed.diagnostics).toHaveLength(0);
    expect(parsed.expression).not.toBeNull();
    expect(stringifyExpression(parsed.expression!)).toBe("(a OR b) AND c");
  });

  it("should report malformed inputs", () => {
    const parsed = parseExpression("a AND OR b");
    expect(parsed.expression).toBeNull();
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
  });
});
