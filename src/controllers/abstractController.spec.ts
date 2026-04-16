import { setLogLevel } from "../services/utils/logger";
import { AbstractController, AbstractControllerContext } from "./abstractController";

jest.mock("../services/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  setLogLevel: jest.fn(() => "info"),
}));

interface TestContext extends AbstractControllerContext {
  readonly value: string;
}

class TestController extends AbstractController<TestContext> {
  async handleRequest(): Promise<void> {
    return;
  }
}

describe("AbstractController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should set log level during construction", () => {
    const controller = new TestController({ verbose: 3, value: "abc" });
    expect(controller).toBeInstanceOf(TestController);
    expect(setLogLevel).toHaveBeenCalledWith(3);
  });

  it("should delegate setLogLevel and return its result", () => {
    const controller = new TestController({ verbose: 0, value: "x" });
    (setLogLevel as jest.Mock).mockReturnValue("warn");

    const result = controller.setLogLevel(4);

    expect(result).toBe("warn");
    expect(setLogLevel).toHaveBeenLastCalledWith(4);
  });
});
