import { readFileSync } from "node:fs";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { ParseController } from "../../controllers/parseController";
import { logger } from "./logger";

/**
 * Resolves expression input from CLI arguments.
 *
 * @param argv Parsed CLI arguments.
 * @returns Expression text from `--file` or `--expression`.
 */
export function resolveExpression(argv: { expression?: string; file?: string }): string {
  if (argv.file !== undefined) {
    return readFileSync(argv.file, "utf-8");
  }
  return argv.expression as string;
}

/**
 * Command handler for the `parse` CLI command.
 *
 * @param argv Raw yargs argument object.
 * @returns Promise resolving when parsing and output complete.
 */
function parseHandler(argv: unknown): Promise<void> {
  logger.debug("Handling parser command");
  const expression = resolveExpression(argv as { expression?: string; file?: string });
  return new ParseController({
    ...(argv as { expression?: string; file?: string; verbose: number; outputFolder?: string }),
    expression,
  }).handleRequest();
}

/**
 * Converts escaped newline sequences to real newline characters.
 *
 * @param value Raw expression value possibly containing escaped newlines.
 * @returns Unescaped expression text.
 */
export function unescapeExpression(value: string): string {
  return value.replaceAll(String.raw`\r\n`, "\r\n").replaceAll(String.raw`\n`, "\n");
}

export const CliParser = yargs(hideBin(process.argv))
  .usage("Usage: $0 <command> [options] (-e [expression] | -f [file]) -o -v")
  .command(
    ["parse"],
    "Parse expression",
    (yargs) =>
      yargs
        .option("expression", {
          alias: "e",
          description: "The boolean expression to parse",
          type: "string",
          coerce: unescapeExpression,
        })
        .option("file", {
          alias: "f",
          description: "Path to a file containing the boolean expression to parse",
          type: "string",
          requiresArg: true,
        })
        .conflicts("expression", "file")
        .check((argv) => {
          if (argv.expression === undefined && argv.file === undefined) {
            throw new Error("Either --expression (-e) or --file (-f) must be provided.");
          }
          return true;
        }),
    parseHandler
  )
  .demandCommand()
  .help("help")
  .alias("help", "h")
  .options({
    verbose: {
      alias: "v",
      description: "verbosity",
      type: "count",
      default: 0,
    },
    outputFolder: {
      alias: "o",
      description: "the output folder for reports",
      requiresArg: true,
      default: "reports",
    },
  })
  .strict()
  .showHelpOnFail(false, "whoops, something went wrong! run with --help");
