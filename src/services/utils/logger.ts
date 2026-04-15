import winston from "winston";

const winstonFormat = winston.format;

export const customLevels = {
  levels: {
    critical: 0,
    error: 1,
    warn: 2,
    info: 3,
    verbose: 4,
    debug: 5,
    trace: 6,
  } as Record<string, number>,
  colors: {
    critical: "cyan",
    error: "red",
    warn: "yellow",
    info: "cyan",
    verbose: "white",
    debug: "gray",
    trace: "dim gray",
  },
};

/**
 * Return date formatted for display
 * @param date
 * @returns {string}
 */
const formatDateLog = (date: Date | string | number) => {
  return `${new Date(date).toISOString().split("T")[0]} ${
    new Date(date).toISOString().split("T")[1]
  }`;
};

/**
 * Define logger options / format output
 * @type {{transports: [*], level: string, format: Format}}
 */
const loggerOptions = {
  level: process.env.MDR_LOGGER_LEVEL || "verbose",
  levels: customLevels.levels,
  format: winstonFormat.combine(
    winstonFormat.timestamp(),
    winstonFormat((info: { level: string; message: unknown }) => {
      info.level = info.level.substring(0, 5).toUpperCase();
      return info;
    })(),
    winston.format.colorize(),
    winstonFormat.printf(({ level, message, timestamp }) => {
      return `[${formatDateLog(timestamp as Date | string | number)}] [${level}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
};

winston.addColors(customLevels.colors);
export const logger = winston.createLogger(loggerOptions) as winston.Logger &
  Record<keyof (typeof customLevels)["levels"], winston.LeveledLogMethod>;
export const setLogLevel = (verbose: number): string => {
  logger.level =
    Object.keys(customLevels.levels).find((k) => customLevels.levels[k] === verbose) || "info";
  logger.verbose(`Log level set to: ${logger.level}`);
  return logger.level;
};
