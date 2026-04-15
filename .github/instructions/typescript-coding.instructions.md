---
applyTo: "**/*.ts,**/*.tsx"
---

# Project coding standards for TypeScript

Apply the [general coding guidelines](./general-coding.instructions.md) to all code.

## TypeScript Guidelines

- Use TypeScript for all new code
- Follow functional programming principles where possible
- Use enums for fixed sets of values
- Use type guards for type narrowing
- Avoid using `any` type; prefer specific types or `unknown` if type is not known.
- Use `as const` for literal types when appropriate
- Use JSDoc comments for complex functions and classes. Document parameters, return types, and any important details about behavior.
- Use interfaces for data structures and type definitions
- Prefer immutable data (`const`, `readonly`).
- Use optional chaining (`?.`) and nullish coalescing (`??`).
- Avoid using `var`; use `let` and `const` instead
- Use `async/await` for asynchronous code; avoid callbacks and `.then()`
- Use `try/catch` for error handling in async functions
- Use `Promise.all` for concurrent async operations
- avoid unnecessary type assertions; let TypeScript infer types when possible
- avoid unnecessary '!' assertions

## tests

- Write unit tests using Jest testing framework.
- Test coverage should be at least 80% for all branches.
- Use descriptive test names that explain the expected behavior.

### Test Structure

- Name test files with `.spec.ts` suffix
- Tests should be placed in alongside the code they test.
- Use descriptive test names that explain the expected behavior
- Use nested describe blocks to organize related tests
- Follow the pattern: `describe('Component/Function/Class', () => { it('should do something', () => {}) })`
- Use `beforeEach` and `afterEach` hooks for setup and teardown.
- Use `expect` assertions to verify behavior.

### Effective Mocking

- Mock external dependencies (APIs, databases, etc.) to isolate your tests
- Use `jest.mock()` for module-level mocks
- Use `jest.spyOn()` for specific function mocks
- Use `mockImplementation()` or `mockReturnValue()` to define mock behavior
- Reset mocks between tests with `jest.resetAllMocks()` in `afterEach`

### Testing Async Code

- Always return promises or use async/await syntax in tests
- Use `resolves`/`rejects` matchers for promises
- Set appropriate timeouts for slow tests with `jest.setTimeout()`

### Common Jest Matchers

- Basic: `expect(value).toBe(expected)`, `expect(value).toEqual(expected)`
- Truthiness: `expect(value).toBeTruthy()`, `expect(value).toBeFalsy()`
- Numbers: `expect(value).toBeGreaterThan(3)`, `expect(value).toBeLessThanOrEqual(3)`
- Strings: `expect(value).toMatch(/pattern/)`, `expect(value).toContain('substring')`
- Arrays: `expect(array).toContain(item)`, `expect(array).toHaveLength(3)`
- Objects: `expect(object).toHaveProperty('key', value)`
- Exceptions: `expect(fn).toThrow()`, `expect(fn).toThrow(Error)`
- Mock functions: `expect(mockFn).toHaveBeenCalled()`, `expect(mockFn).toHaveBeenCalledWith(arg1, arg2)`
