import { canonicalizeExpression } from "./normalize";
import { parseExpression, stringifyExpression } from "./parser";
import { expandExpression, factorizeExpression } from "./transform";
import { NormalForm } from "./types";

function mustParse(input: string) {
  const parsed = parseExpression(input);
  if (parsed.expression === null || parsed.diagnostics.length > 0) {
    throw new Error(`Unable to parse expression: ${input}`);
  }

  return parsed.expression;
}

describe("booleanDsl/transform", () => {
  it("should canonicalize commutative permutations deterministically", () => {
    const left = canonicalizeExpression(mustParse("a OR b"));
    const right = canonicalizeExpression(mustParse("b OR a"));
    expect(stringifyExpression(left)).toBe(stringifyExpression(right));
  });

  it("should expand to DNF", () => {
    const input = mustParse("(a OR b) AND c");
    const output = expandExpression(input, NormalForm.Dnf).expression;
    expect(stringifyExpression(output)).toBe("a AND c OR b AND c");
  });

  it("should expand to CNF", () => {
    const input = mustParse("a OR (b AND c)");
    const output = expandExpression(input, NormalForm.Cnf).expression;
    expect(stringifyExpression(output)).toBe("(a OR b) AND (a OR c)");
  });

  it("should factorize common terms", () => {
    const input = mustParse("(a AND b) OR (a AND c)");
    const output = factorizeExpression(input).expression;
    expect(stringifyExpression(output)).toBe("(b OR c) AND a");
  });

  it("should leave non-factorizable expressions unchanged", () => {
    const input = mustParse("(a AND b) OR (c AND d)");
    const output = factorizeExpression(input).expression;
    expect(stringifyExpression(output)).toBe("a AND b OR c AND d");
  });
});
