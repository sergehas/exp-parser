import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ParseController } from "../../controllers/parseController";
import { CliParser } from "./cli";
import { logger } from "./logger";

const handleRequestMock = jest.fn<Promise<void>, []>(async () => {
  return;
});

jest.mock("../../controllers/parseController", () => ({
  ParseController: jest.fn().mockImplementation(() => ({
    handleRequest: handleRequestMock,
  })),
}));

jest.mock("./logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
  setLogLevel: jest.fn(() => "info"),
}));

describe("CliParser", () => {
  let tmpDir: string;

  beforeAll(() => {
    CliParser.exitProcess(false);
  });

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cli-parser-spec-"));
  });

  afterEach(() => {
    jest.clearAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should execute parse handler for inline expression and pass normalized args", async () => {
    await CliParser.parseAsync(["parse", "-e", String.raw`+ABC01\n-XYZ02`, "-vv", "-o", "out"]);

    expect(logger.debug).toHaveBeenCalledWith("Handling parser command");
    expect(ParseController).toHaveBeenCalledTimes(1);
    expect(ParseController).toHaveBeenCalledWith(
      expect.objectContaining({
        expression: "+ABC01\n-XYZ02",
        verbose: 2,
        outputFolder: "out",
      })
    );
    expect(handleRequestMock).toHaveBeenCalledTimes(1);
  });

  it("should execute parse handler with file expression content", async () => {
    const filePath = join(tmpDir, "expr.txt");
    writeFileSync(filePath, "+A01\n-B02");

    await CliParser.parseAsync(["parse", "-f", filePath]);

    expect(ParseController).toHaveBeenCalledWith(
      expect.objectContaining({
        expression: "+A01\n-B02",
      })
    );
    expect(handleRequestMock).toHaveBeenCalledTimes(1);
  });

  it("should reject parse command when neither expression nor file is provided", async () => {
    expect(() => CliParser.parse(["parse"])).toThrow(
      "Either --expression (-e) or --file (-f) must be provided."
    );
    expect(ParseController).not.toHaveBeenCalled();
  });

  it("should reject parse command when both expression and file are provided", async () => {
    const filePath = join(tmpDir, "expr.txt");
    writeFileSync(filePath, "+A01");

    expect(() => CliParser.parse(["parse", "-e", "+A01", "-f", filePath])).toThrow();
    expect(ParseController).not.toHaveBeenCalled();
  });
});
