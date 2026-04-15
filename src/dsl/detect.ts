export enum SyntaxMode {
  Condensed = "Condensed",
  Explicit = "Explicit",
}

const EXPLICIT_PATTERN = /\b(and|or)\b|[()]/i;

/** Auto-detect whether the input uses condensed or explicit syntax. */
export function detectSyntax(input: string): SyntaxMode {
  return EXPLICIT_PATTERN.test(input) ? SyntaxMode.Explicit : SyntaxMode.Condensed;
}
