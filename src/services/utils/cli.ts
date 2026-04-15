import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { ParseController } from "../../controllers/ParseController";
import { logger } from "./logger";

function parseHandler(argv: any): Promise<void> {
  logger.debug("Handling parser command");
  return new ParseController(argv).handleRequest();
}

export const CliParser = yargs(hideBin(process.argv))
  .usage("Usage: $0 <command> [options] -e [expression] -f  -x  -v")
  .command(
    ["parse"],
    "Parse expression",
    (yargs) =>
      yargs.option("expression", {
        alias: "e",
        description: "The boolean expression to parse",
        type: "string",
        demandOption: true,
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
      alias: "f",
      description: "the output folder for reports",
      requiresArg: true,
      default: "reports",
    },
  })
  .strict()
  .showHelpOnFail(false, "whoops, something went wrong! run with --help");
