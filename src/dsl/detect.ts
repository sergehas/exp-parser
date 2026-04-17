/** Supported syntax modes for parsing boolean expressions. */
export enum SyntaxMode {
  Condensed = "Condensed",
  Explicit = "Explicit",
}

const EXPLICIT_PATTERN = /\b(and|or)\b|[()]|[A-Za-z0-9]{3}[:!][A-Za-z0-9]{1,2}/i;

/**
 * Detects whether input is written in condensed or explicit boolean syntax.
 *
 * @param input Expression text to inspect.
 * @returns Explicit mode when boolean keywords, parentheses, or colon/bang variable syntax are present; otherwise condensed mode.
 */
export function detectSyntax(input: string): SyntaxMode {
  return EXPLICIT_PATTERN.test(input) ? SyntaxMode.Explicit : SyntaxMode.Condensed;
}
