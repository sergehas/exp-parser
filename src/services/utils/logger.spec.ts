import { customLevels, logger, setLogLevel } from "./logger";

describe("customLevels", () => {
  it("should have correct level values", () => {
    expect(customLevels.levels.critical).toBe(0);
    expect(customLevels.levels.error).toBe(1);
    expect(customLevels.levels.warn).toBe(2);
    expect(customLevels.levels.info).toBe(3);
    expect(customLevels.levels.verbose).toBe(4);
    expect(customLevels.levels.debug).toBe(5);
    expect(customLevels.levels.trace).toBe(6);
  });

  it("should have correct color values", () => {
    expect(customLevels.colors.critical).toBe("cyan");
    expect(customLevels.colors.error).toBe("red");
    expect(customLevels.colors.warn).toBe("yellow");
    expect(customLevels.colors.info).toBe("cyan");
    expect(customLevels.colors.verbose).toBe("white");
    expect(customLevels.colors.debug).toBe("gray");
    expect(customLevels.colors.trace).toBe("dim gray");
  });
});

describe("logger", () => {
  it("should have all custom log levels as methods", () => {
    Object.keys(customLevels.levels).forEach((level) => {
      expect(typeof (logger as any)[level]).toBe("function");
    });
  });

  it("should log messages at different levels", () => {
    // Just check that calling does not throw
    expect(() => logger.info("info message")).not.toThrow();
    expect(() => logger.error("error message")).not.toThrow();
    expect(() => logger.debug("debug message")).not.toThrow();
    expect(() => logger.trace("trace message")).not.toThrow();
  });
});

describe("setLogLevel", () => {
  it("should set logger.level to the correct string", () => {
    setLogLevel(5); // debug
    expect(logger.level).toBe("debug");
    setLogLevel(0); // critical
    expect(logger.level).toBe("critical");
    setLogLevel(3); // info
    expect(logger.level).toBe("info");
    setLogLevel(99); // not found, fallback to info
    expect(logger.level).toBe("info");
  });
});
