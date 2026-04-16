import { SyntaxMode } from "../dsl/detect";
import { parseExpression, stringifyExpression } from "../dsl/parser";
import { expandExpression, factorizeExpression } from "../dsl/transform";
import { BinaryOperator, BoolExpr, ExprKind, NormalForm, VariableSign } from "../dsl/types";
import { logger } from "../services/utils/logger";
import { ParseController } from "./parseController";

jest.mock("../dsl/parser", () => ({
  parseExpression: jest.fn(),
  stringifyExpression: jest.fn(),
}));

jest.mock("../dsl/transform", () => ({
  expandExpression: jest.fn(),
  factorizeExpression: jest.fn(),
}));

jest.mock("../services/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  setLogLevel: jest.fn(() => "info"),
}));

function createVariableExpr(code: string, value: string): BoolExpr {
  return {
    kind: ExprKind.Variable,
    sign: VariableSign.Equals,
    code,
    value,
    span: { start: 0, end: 1 },
  };
}

describe("ParseController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should log diagnostics and stop when parsing fails", async () => {
    (parseExpression as jest.Mock).mockReturnValue({
      expression: null,
      diagnostics: [{ message: "Invalid token", span: { start: 2, end: 4 } }],
    });

    const controller = new ParseController({ expression: "+ABC01 and", verbose: 1 });
    await controller.handleRequest();

    expect(logger.info).toHaveBeenCalledWith("Input expression: +ABC01 and");
    expect(logger.error).toHaveBeenCalledWith("Failed to parse expression:");
    expect(logger.error).toHaveBeenCalledWith("  [2-4] Invalid token");
    expect(expandExpression).not.toHaveBeenCalled();
    expect(factorizeExpression).not.toHaveBeenCalled();
  });

  it("should parse, expand, factorize, and log all outputs when parsing succeeds", async () => {
    const ast = {
      kind: ExprKind.Binary,
      operator: BinaryOperator.And,
      left: createVariableExpr("ABC", "01"),
      right: createVariableExpr("XYZ", "02"),
      span: { start: 0, end: 12 },
    } as const;

    const expandedExpression = createVariableExpr("EXP", "03");
    const factorizedExpression = createVariableExpr("FAC", "04");

    (parseExpression as jest.Mock).mockReturnValue({ expression: ast, diagnostics: [] });
    (stringifyExpression as jest.Mock).mockImplementation((expr: BoolExpr, mode: SyntaxMode) => {
      if (mode === SyntaxMode.Condensed) {
        return `condensed:${expr.kind}`;
      }
      return `explicit:${expr.kind}`;
    });
    (expandExpression as jest.Mock).mockReturnValue({
      expression: expandedExpression,
      stats: { rewrites: 1, maxDepth: 2, nodeCount: 3 },
    });
    (factorizeExpression as jest.Mock).mockReturnValue({
      expression: factorizedExpression,
      stats: { rewrites: 2, maxDepth: 3, nodeCount: 4 },
    });

    const controller = new ParseController({ expression: "+ABC01 and -XYZ02", verbose: 2 });
    await controller.handleRequest();

    expect(parseExpression).toHaveBeenCalledWith("+ABC01 and -XYZ02");
    expect(expandExpression).toHaveBeenCalledWith(ast, NormalForm.Dnf);
    expect(factorizeExpression).toHaveBeenCalledWith(ast);

    expect(logger.info).toHaveBeenCalledWith("Input expression: +ABC01 and -XYZ02");
    expect(logger.info).toHaveBeenCalledWith("Explicit : explicit:Binary");
    expect(logger.info).toHaveBeenCalledWith("Condensed:\ncondensed:Binary");
    expect(logger.info).toHaveBeenCalledWith("Expanded (DNF) : explicit:Variable");
    expect(logger.info).toHaveBeenCalledWith('  stats: {"rewrites":1,"maxDepth":2,"nodeCount":3}');
    expect(logger.info).toHaveBeenCalledWith("Factorized : explicit:Variable");
    expect(logger.info).toHaveBeenCalledWith('  stats: {"rewrites":2,"maxDepth":3,"nodeCount":4}');
  });
});
