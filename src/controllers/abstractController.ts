import { setLogLevel } from "../services/utils/logger";

/** Context required for controller request handling, including verbosity level. */
export interface AbstractControllerContext {
  verbose: number;
}

/**
 * Abstract base class for controllers that handle requests within a specific context.
 *
 * @template C - The type of the controller context, extending {@link AbstractControllerContext}.
 *
 * @remarks
 * This class provides common functionality such as log level management.
 * Subclasses must implement the {@link handleRequest} method to define specific request handling logic.
 *
 * @property context - The controller context, provided via the constructor.
 *
 * @constructor
 * Initializes the controller with the given context and sets the log level.
 *
 * @method setLogLevel
 * Sets the logging level based on the provided verbosity value.
 *
 * @method handleRequest
 * Abstract method that must be implemented by subclasses to handle requests.
 */
export abstract class AbstractController<C extends AbstractControllerContext> {
  /**
   * Initializes the controller with the given context and sets the log level.
   *
   * @param context - The controller context.
   */
  constructor(protected context: C) {
    this.setLogLevel(context.verbose);
  }

  /**
   * Sets the logger's log level based on the provided numeric verbosity value.
   *
   * @param verbose - The numeric value representing the desired log level.
   * @returns The name of the log level that was set.
   */
  setLogLevel(verbose: number): string {
    return setLogLevel(verbose);
  }

  /**
   * Abstract method to handle the request.
   * This method should be implemented by subclasses to define the specific behavior.
   *
   * @returns {Promise<void>} A promise that resolves when the request has been handled.
   */
  abstract handleRequest(): Promise<void>;
}
