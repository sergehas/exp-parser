import { SyntaxMode } from "../dsl/detect";
import { parseExpression, stringifyExpression } from "../dsl/parser";
import { expandExpression, factorizeExpression } from "../dsl/transform";
import { NormalForm } from "../dsl/types";
import { logger } from "../services/utils/logger";
import { AbstractController, AbstractControllerContext } from "./abstractController";

/** Context for parse request handling, including the expression to parse. */
export interface ParseContext extends AbstractControllerContext {
  expression: string;
}

/** Controller that parses boolean expressions and outputs their transformations. */
export class ParseController extends AbstractController<ParseContext> {
  /**
   * Parses the configured expression and logs parse output, expansion, and factorization results.
   *
   * @returns Promise that resolves when logging and processing are complete.
   */
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

    const expanded2 = expandExpression(ast, NormalForm.Cnf);
    logger.info(
      `Expanded (CNF) : ${stringifyExpression(expanded2.expression, SyntaxMode.Explicit)}`
    );
    logger.info(`  stats: ${JSON.stringify(expanded2.stats)}`);

    const factorized = factorizeExpression(ast);
    logger.info(
      `Factorized (explicit) : ${stringifyExpression(factorized.expression, SyntaxMode.Explicit)}`
    );
    logger.info(
      `Factorized (condensed) : ${stringifyExpression(factorized.expression, SyntaxMode.Condensed)}`
    );
    logger.info(`  stats: ${JSON.stringify(factorized.stats)}`);
  }
}
