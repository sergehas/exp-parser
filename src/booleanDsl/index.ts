import { parseExpression, stringifyExpression } from "./parser";
import { canonicalizeExpression, debugExpression } from "./normalize";
import { expandExpression, factorizeExpression } from "./transform";
import { BoolExpr, NormalForm, RewriteLimits } from "./types";

export * from "./types";
export * from "./parser";
export * from "./normalize";
export * from "./transform";

export interface ParseAndTransformResult {
  readonly expression: BoolExpr;
  readonly text: string;
  readonly debug: string;
}

export function parseAndCanonicalize(input: string): ParseAndTransformResult {
  const parsed = parseExpression(input);
  if (parsed.expression === null || parsed.diagnostics.length > 0) {
    const first = parsed.diagnostics[0];
    const message = first?.message ?? "Failed to parse expression.";
    throw new Error(message);
  }

  const expression = canonicalizeExpression(parsed.expression);
  return {
    expression,
    text: stringifyExpression(expression),
    debug: debugExpression(expression),
  };
}

export function expandInput(
  input: string,
  form: NormalForm,
  limits?: RewriteLimits
): ParseAndTransformResult {
  const base = parseAndCanonicalize(input);
  const result = expandExpression(base.expression, form, limits);
  return {
    expression: result.expression,
    text: stringifyExpression(result.expression),
    debug: `${debugExpression(result.expression)} rewrites=${result.stats.rewrites}`,
  };
}

export function factorizeInput(
  input: string,
  limits?: RewriteLimits
): ParseAndTransformResult {
  const base = parseAndCanonicalize(input);
  const result = factorizeExpression(base.expression, limits);
  return {
    expression: result.expression,
    text: stringifyExpression(result.expression),
    debug: `${debugExpression(result.expression)} rewrites=${result.stats.rewrites}`,
  };
}
