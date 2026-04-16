describe("parseExpression internals with mocked lexer", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should default missing variable token fields during explicit parse", async () => {
    jest.doMock("./detect", () => {
      const actual = jest.requireActual("./detect");
      return {
        ...actual,
        detectSyntax: jest.fn(() => actual.SyntaxMode.Explicit),
      };
    });

    jest.doMock("./lexer", () => {
      const actual = jest.requireActual("./lexer");
      return {
        ...actual,
        tokenize: jest.fn(() => ({
          tokens: [
            {
              type: actual.TokenType.Variable,
              start: 0,
              end: 1,
            },
            {
              type: actual.TokenType.Eof,
              start: 1,
              end: 1,
            },
          ],
          diagnostics: [],
        })),
      };
    });

    const { parseExpression } = await import("./parser");
    const { ExprKind, VariableSign } = await import("./types");

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
    jest.doMock("./detect", () => {
      const actual = jest.requireActual("./detect");
      return {
        ...actual,
        detectSyntax: jest.fn(() => actual.SyntaxMode.Explicit),
      };
    });

    jest.doMock("./lexer", () => {
      const actual = jest.requireActual("./lexer");
      return {
        ...actual,
        tokenize: jest.fn(() => ({
          tokens: [],
          diagnostics: [],
        })),
      };
    });

    const { parseExpression } = await import("./parser");

    expect(() => parseExpression("ignored")).toThrow();
  });
});
