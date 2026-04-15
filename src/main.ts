import * as CLI from "./services/utils/cli";
import { logger } from "./services/utils/logger";

(async () => {
  try {
    await CLI.CliParser.parseAsync();
  } catch (e) {
    logger.error("Fail to execute command", e);
  }
})();
