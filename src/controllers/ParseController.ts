import { SyntaxMode } from "../dsl/detect";
import { parseExpression, stringifyExpression } from "../dsl/parser";
import { expandExpression, factorizeExpression } from "../dsl/transform";
import { NormalForm } from "../dsl/types";
import { logger } from "../services/utils/logger";
import { AbstractController, AbstractControllerContext } from "./abstractController";

export interface ParseContext extends AbstractControllerContext {
  expression: string;
}

export class ParseController extends AbstractController<ParseContext> {
  override async handleRequest(): Promise<void> {
    const input = this.context.expression;
    logger.info(`Input expression: ${input}`);

    const result = parseExpression(input);
    if (result.expression === null) {
      logger.error("Failed to parse expression:");
      for (const diag of result.diagnostics) {
        logger.error(`  [${diag.span.start}-${diag.span.end}] ${diag.message}`);
      }
      return;
    }

    const ast = result.expression;
    logger.info(`Explicit : ${stringifyExpression(ast, SyntaxMode.Explicit)}`);
    logger.info(`Condensed:\n${stringifyExpression(ast, SyntaxMode.Condensed)}`);

    const expanded = expandExpression(ast, NormalForm.Dnf);
    logger.info(
      `Expanded (DNF) : ${stringifyExpression(expanded.expression, SyntaxMode.Explicit)}`
    );
    logger.info(`  stats: ${JSON.stringify(expanded.stats)}`);

    const factorized = factorizeExpression(ast);
    logger.info(`Factorized : ${stringifyExpression(factorized.expression, SyntaxMode.Explicit)}`);
    logger.info(`  stats: ${JSON.stringify(factorized.stats)}`);
  }
}
