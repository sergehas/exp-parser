import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveExpression, unescapeExpression } from "./cli";

describe("unescapeExpression", () => {
  it("should convert literal backslash-n to real newline", () => {
    expect(unescapeExpression(String.raw`+ABC01\n-XYZ02`)).toBe("+ABC01\n-XYZ02");
  });

  it("should convert literal backslash-r-backslash-n to real CRLF", () => {
    expect(unescapeExpression(String.raw`+ABC01\r\n-XYZ02`)).toBe("+ABC01\r\n-XYZ02");
  });

  it("should convert multiple literal backslash-n to real newlines", () => {
    expect(unescapeExpression(String.raw`+ABC01\n-XYZ02\n+DEF03`)).toBe("+ABC01\n-XYZ02\n+DEF03");
  });

  it("should leave strings without escape sequences unchanged", () => {
    expect(unescapeExpression("+ABC01 -XYZ02")).toBe("+ABC01 -XYZ02");
  });

  it("should handle empty string", () => {
    expect(unescapeExpression("")).toBe("");
  });

  it("should handle mixed backslash-r-backslash-n and backslash-n sequences", () => {
    expect(unescapeExpression(String.raw`+ABC01\r\n-XYZ02\n+DEF03`)).toBe(
      "+ABC01\r\n-XYZ02\n+DEF03"
    );
  });
});

describe("resolveExpression", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cli-spec-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return expression from argv.expression when provided", () => {
    expect(resolveExpression({ expression: "+ABC01 -XYZ02" })).toBe("+ABC01 -XYZ02");
  });

  it("should read expression from file when argv.file is provided", () => {
    const filePath = join(tmpDir, "expr.txt");
    writeFileSync(filePath, "+ABC01\n-XYZ02");
    expect(resolveExpression({ file: filePath })).toBe("+ABC01\n-XYZ02");
  });

  it("should prefer file over expression when both are present (file takes precedence)", () => {
    const filePath = join(tmpDir, "expr.txt");
    writeFileSync(filePath, "+DEF03");
    expect(resolveExpression({ expression: "+ABC01", file: filePath })).toBe("+DEF03");
  });

  it("should preserve real newlines from file without unescaping", () => {
    const filePath = join(tmpDir, "expr.txt");
    writeFileSync(filePath, "+ABC01\n-XYZ02\n+DEF03");
    expect(resolveExpression({ file: filePath })).toBe("+ABC01\n-XYZ02\n+DEF03");
  });

  it("should throw when file does not exist", () => {
    expect(() => resolveExpression({ file: join(tmpDir, "missing.txt") })).toThrow();
  });
});
