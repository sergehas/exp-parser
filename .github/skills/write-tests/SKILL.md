---
name: write-tests
description: >
  Test writing guide for the Boolean Expression Parser CLI application.
  Provides strategies, patterns, and commands for writing Jest unit tests
  targeting 90% branch coverage across DSL, controller, and service modules.
  TRIGGER when: "write tests", "add tests", "test coverage", "increase coverage",
  "missing tests", "branch coverage", "unit tests", "spec file", "test this",
  "cover this", "add test cases", or any request to write or improve tests.
  DO NOT TRIGGER for: code review (use code-review), or debugging (use systematic-debugging).
---

# Writing Tests Skill: Test Coverage Strategy for 90% Branch Coverage

## Overview

This skill guide provides comprehensive instructions for writing tests in the Boolean Expression Parser project, with a specific focus on achieving and maintaining **90% branch coverage** across the codebase. This guide incorporates lessons learned from systematically improving test coverage from 73% to 90%+ on critical DSL modules.

**Key Context**:

- Test framework: Jest (v30.0.5) with ts-jest preset
- Language: TypeScript (v5.9.0) with strict null checking
- Branch coverage target: **90%** (minimum)
- Test execution time: Up to 40 seconds
- Test file location: Alongside source files with `.spec.ts` suffix

---

## Test Execution Commands

### Standard Test Commands

#### Run All Tests (Full Suite)

```bash
npm test
```

Runs all tests in watch mode (development). Equivalent to:

```bash
npx jest --watchAll
```

#### Run Tests for Coverage (Production/CI Mode)

```bash
npx jest --coverage --runInBand --watchAll=false
```

**Flags explained**:

- `--coverage`: Generate coverage report
- `--runInBand`: Execute tests sequentially (single process), no parallelization
- `--watchAll=false`: Disable watch mode; exit after one run (CI mode)

**Expected output**: lcov-formatted coverage report to `coverage/` directory

#### Run Tests with Custom Timeout (40 Second Cap)

For slower test suites or CI environments:

```bash
npx jest --coverage --runInBand --watchAll=false --testTimeout=40000
```

#### Run Specific Test File

```bash
npx jest src/dsl/parser.spec.ts --coverage --runInBand --watchAll=false
```

#### Run Multiple Specific Test Files (Branch Coverage Verification)

```bash
npx jest src/dsl/parser.spec.ts src/dsl/transform.spec.ts --coverage --runInBand --watchAll=false --collectCoverageFrom=src/dsl/parser.ts --collectCoverageFrom=src/dsl/transform.ts
```

**Flags explained**:

- `--collectCoverageFrom=src/path/file.ts`: Limit coverage report to specific files (ignores coverage from other files)

#### Run Single Test Case (Debugging)

```bash
npx jest src/dsl/parser.spec.ts -t "should handle lexer errors" --watchAll=false
```

**Flag explained**:

- `-t "test name"`: Run only tests matching the pattern

---

## Test Structure and Organization

### File Naming and Location

```
src/
  dsl/
    parser.ts              ← Source file
    parser.spec.ts         ← Main test file (same directory)
```

**Naming convention**:

- Main test file: `{module}.spec.ts`
- Tests placed alongside source files (not in separate `test/` directory)

### Test File Structure Template

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { myFunction, MyClass } from "./myModule";

describe("MyModule", () => {
  let mockDependency: jest.Mock;

  beforeEach(() => {
    // Setup: Create fresh mocks before each test
    mockDependency = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Teardown: Reset state after each test
    jest.resetAllMocks();
  });

  describe("myFunction", () => {
    it("should return expected result for normal input", () => {
      const result = myFunction("input");
      expect(result).toBe("expected");
    });

    it("should handle edge case: empty string", () => {
      const result = myFunction("");
      expect(result).toEqual({ error: "empty input" });
    });

    it("should throw error when dependency fails", () => {
      mockDependency.mockImplementation(() => {
        throw new Error("Dependency failed");
      });
      expect(() => myFunction("input")).toThrow("Dependency failed");
    });
  });

  describe("MyClass", () => {
    let instance: MyClass;

    beforeEach(() => {
      instance = new MyClass(mockDependency);
    });

    it("should initialize with provided dependencies", () => {
      expect(instance.dependency).toBe(mockDependency);
    });
  });
});
```

### Test Naming Convention

Follow the pattern: **`should [behavior] [when condition]`**

✅ **Good**:

- `should parse condensed syntax expression correctly`
- `should expand AND operator with OR operands on right side`
- `should throw error when required argument is missing`
- `should return empty array when no matches found`
- `should delegate log level change to underlying logger`

❌ **Avoid**:

- `test parser` (vague)
- `works correctly` (non-specific)
- `parse` (not descriptive)
- `error handling` (too broad)

---

## Understanding Branch Coverage

### What is Branch Coverage?

Branch coverage measures the percentage of conditional branches (if/else, switch cases, ternary operators, logical operators) that are exercised by tests.

**Example**:

```typescript
if (condition) {
  // Branch 1: executed when condition is true
  doSomething();
} else {
  // Branch 2: executed when condition is false
  doSomethingElse();
}
```

A test achieving 100% branch coverage must test **both** paths (condition true AND false).

### Branch vs. Line Coverage

- **Line coverage**: Did the line execute? (binary: yes/no)
- **Branch coverage**: Did all conditional paths on this line execute? (more granular)

**Example where they differ**:

```typescript
const result = isValid ? doA() : doB(); // Line coverage: 1 line
```

- **Line coverage**: 100% if either `doA()` OR `doB()` executes
- **Branch coverage**: 100% only if **both** paths execute (tested with `isValid=true` AND `isValid=false`)

**For this project: We target 90% branch coverage**, which is more rigorous than line coverage.

---

## Strategy for Achieving 90% Branch Coverage

### Phase 1: Identify Gaps (Baseline Measurement)

Run coverage to measure starting point:

```bash
npx jest --coverage --runInBand --watchAll=false
```

**Analyze the lcov report** (`coverage/lcov.info`):

- Look for files with branch coverage < 90%
- Prioritize complex logic

**Read branch data from lcov**:

```
BRDA:52,8,0,1        ← Line 52, branch 0 (first condition outcome), hit 1 time
BRDA:52,8,1,0        ← Line 52, branch 1 (second condition outcome), hit 0 times
```

Zero-hit branches indicate untested code paths.

### Phase 2: Test Normal Paths (Happy Path)

Start with the most common, straightforward use cases:

```typescript
describe("parseExpression", () => {
  it("should parse valid condensed syntax: +ABC01 and -XYZ02", () => {
    const result = parseExpression("+ABC01 and -XYZ02");
    expect(result.status).toBe("success");
    expect(result.ast).toBeDefined();
  });

  it("should parse valid explicit syntax: AND(A, B)", () => {
    const result = parseExpression("AND(A, B)");
    expect(result.status).toBe("success");
    expect(result.ast).toBeDefined();
  });

  it("should parse single term: +ABC", () => {
    const result = parseExpression("+ABC");
    expect(result.status).toBe("success");
  });
});
```

### Phase 3: Test Error Paths (Error Handling)

Add tests for invalid inputs, boundary conditions, and expected failures:

```typescript
it("should detect lexer errors and return diagnostics", () => {
  const result = parseExpression("+++ABC"); // Invalid syntax
  expect(result.status).toBe("error");
  expect(result.diagnostics).toBeDefined();
  expect(result.diagnostics.length).toBeGreaterThan(0);
});

it("should reject trailing tokens after valid expression", () => {
  const result = parseExpression("+ABC01 and -XYZ02 +DEF03");
  expect(result.status).toBe("error");
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: expect.stringContaining("Unexpected token") }));
});

it("should reject missing right operand after operator", () => {
  const result = parseExpression("+ABC01 and");
  expect(result.status).toBe("error");
});
```

### Phase 4: Test Complex Conditionals and Branches

Identify multi-path logic and test each branch:

**Transform.ts Distribution Branches**:

```typescript
describe("expandExpression - distribution rules", () => {
  it("should apply DNF (left-side OR with right-side AND): (A or B) and C", () => {
    const expr = parseExpression("(+A or -B) and +C");
    const expanded = expandExpression(expr);
    // Should distribute to: (A and C) or (B and C)
    expect(expanded).toMatchExpression("(+A and +C) or (-B and +C)");
  });

  it("should apply DNF (right-side AND with left OR): A and (B or C)", () => {
    const expr = parseExpression("+A and (-B or +C)");
    const expanded = expandExpression(expr);
    // Should distribute: (A and B) or (A and C)
    expect(expanded).toMatchExpression("(+A and -B) or (+A and +C)");
  });

  it("should apply CNF (right-side OR with left AND): A or (B and C)", () => {
    const expr = parseExpression("+A or (-B and +C)");
    const expanded = expandExpression(expr);
    // Should distribute: (A or B) and (A or C)
    expect(expanded).toMatchExpression("(+A or -B) and (+A or +C)");
  });

  it("should not distribute when OR has no distributable AND operands", () => {
    const expr = parseExpression("(+A or -B) and (+C or -D)");
    const expanded = expandExpression(expr);
    // Both operands are OR; no distribution possible
    expect(expanded).toMatchExpression("(+A or -B) and (+C or -D)");
  });
});
```

### Phase 5: Test Edge Cases with Mocking and spies

When standard tests cannot reach certain branches, use spies dependencies to force those paths:

**Example: `transform.spec.ts`** tests the `expandExpression` function, which has conditional logic based on the structure of the expression. To test branches that depend on specific expression shapes, we can mock the `canonicalizeExpression` function to return controlled outputs.

```typescript
import { jest } from "@jest/globals";

describe("parseExpression internals with mocked lexer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should default missing variable token fields during explicit parse", async () => {
    jest.spyOn(detect, "detectSyntax").mockReturnValue(SyntaxMode.Explicit);
    jest.spyOn(lexer, "tokenize").mockImplementation(() => ({
      tokens: [
        {
          type: TokenType.Variable,
          start: 0,
          end: 1,
        },
        {
          type: TokenType.Eof,
          start: 1,
          end: 1,
        },
      ],
      diagnostics: [],
    }));

    const result = parseExpression("ignored");

    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).not.toBeNull();
    expect(result.expression).toMatchObject({
      kind: ExprKind.Variable,
      sign: VariableSign.Equals,
      code: "",
      value: "",
    });
  });
});
```

### Phase 6: Verify Coverage Gaps

After adding tests, re-measure:

```bash
npx jest src/dsl/transform.spec.ts --coverage --runInBand --watchAll=false --collectCoverageFrom=src/dsl/transform.ts
```

Compare before/after branch percentages. Identify remaining uncovered branches in lcov report and iterate Phase 5 (mocked tests) until 90% target reached.

---

## Effective Mocking Strategies

### Module-Level Mocking with `jest.mock()`

Use for isolating dependencies at module boundaries:

```typescript
// Mock an entire module before importing the dependent module
jest.mock("../../services/utils/logger");

import { ParseController } from "../../controllers/ParseController";
import { logger } from "../../services/utils/logger";

describe("ParseController", () => {
  it("should initialize with mocked logger", () => {
    const controller = new ParseController();
    expect(logger).toHaveBeenCalled();
  });
});
```

**Advantages**:

- Simple syntax
- Affects all imports of the mocked module throughout the test
- Works well for testing cross-cutting concerns (logging, configuration)

**When to use**:

- External API clients
- Logger instances
- Configuration providers
- Database connections

### Spy Mocking with `jest.spyOn()`

Use for selectively mocking specific functions while keeping module structure intact:

```typescript
import * as parser from "../../dsl/parser";

describe("ParseController", () => {
  it("should call parseExpression with correct input", () => {
    const spy = jest.spyOn(parser, "parseExpression").mockReturnValue({
      status: "success",
      ast: { type: "Term", sign: "+", code: "ABC" },
    });

    controller.parse("+ABC");
    expect(spy).toHaveBeenCalledWith("+ABC");
    spy.mockRestore();
  });
});
```

**Advantages**:

- Non-destructive; allows selective mocking
- Can spy on real implementations and verify calls
- Better for testing interactions between modules

**When to use**:

- Complex functions with side effects you want to verify
- When you want to keep some module functionality but mock specific methods
- Testing callbacks and hooks

---

## Common Testing Patterns

### Testing Transformations (Parser, Normalizer, etc.)

```typescript
it("should transform input X to output Y", () => {
  const input = parseExpression("+A and (-B or +C)");
  const output = expandExpression(input);

  // Verify structure
  expect(output.type).toBe("BinaryExpr");
  expect(output.operator).toBe("or");

  // Verify stringification for readability
  expect(stringify(output)).toEqual(expect.stringContaining("and"));
});
```

### Testing Error Cases with Custom Matchers

```typescript
it("should reject invalid syntax with detailed diagnostic", () => {
  const result = parseExpression("+++ABC");

  expect(result.status).toBe("error");
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toEqual(
    expect.objectContaining({
      line: expect.any(Number),
      column: expect.any(Number),
      message: expect.stringMatching(/invalid|unexpected/i),
    })
  );
});
```

### Testing Async Operations

```typescript
it("should handle async operations correctly", async () => {
  const promise = someAsyncFunction();

  // Option 1: Using resolves/rejects matchers
  await expect(promise).resolves.toEqual({ success: true });
});

it("should catch async errors", async () => {
  // Option 2: Using try/catch
  try {
    await failingAsyncFunction();
    fail("Should have thrown"); // Fail test if no error thrown
  } catch (error) {
    expect(error).toBeInstanceOf(CustomError);
  }
});
```

### Testing Null/Undefined Handling

```typescript
it("should handle null logger gracefully", () => {
  const controller = new ParseController(null);
  // Should not crash; may use default logger
  const result = controller.parse("+ABC");
  expect(result).toBeDefined();
});

it("should use nullish coalescing for missing config", () => {
  const config = { timeout: null, retries: undefined };
  const timeout = config.timeout ?? 5000;
  const retries = config.retries ?? 3;

  expect(timeout).toBe(5000);
  expect(retries).toBe(3);
});
```

---

## Debugging and Troubleshooting

### Test Hangs or Timeout Errors

**Problem**: Tests appear frozen or hit timeout limit.

**Solution**: Always use non-watch mode for CI/automated runs:

```bash
npx jest --watchAll=false --runInBand --testTimeout=40000
```

- `--watchAll=false`: Exit after first run (prevents interactive prompt)
- `--runInBand`: Sequential execution (prevents resource contention)
- `--testTimeout=40000`: 40-second timeout per test

### High Coverage Report But Failing Tests

**Problem**: Coverage shows 90% but some tests fail or are skipped.

**Solution**: Ensure all test cases actually run:

```bash
npx jest --listTests  # Verify all test files are discovered
npx jest --verbose   # Show individual test execution
```

Check for:

- Typos in describe/it block names
- `.skip` or `.only` modifiers left on tests
- Mocks not reset between tests (add `jest.resetAllMocks()` in `afterEach`)

### Branch Coverage Not Increasing Despite New Tests

**Problem**: Added test cases but branch % didn't increase.

**Possible causes**:

1. **Not testing the actual branch condition**:
   - Verify test input actually triggers the conditional path
   - Add console.log or debugger to confirm execution path
2. **Branch already covered by different test**:
   - Check existing tests for overlap
   - Use coverage report line references to identify which tests hit each branch

3. **Dead code path**:
   - Some branches may be unreachable (logic error)
   - Review code for contradictory conditions
   - Mark unreachable paths with `/* c8 ignore next */` comment (if acceptable)

**Debugging technique**:

```typescript
it("should test specific branch (debug)", () => {
  const input = "+ABC and -XYZ"; // Verify this triggers desired branch
  const result = parseExpression(input);

  // Add detailed assertions
  console.log("Result:", JSON.stringify(result, null, 2));
  expect(result.status).toBe("success");
});

// Run with: npx jest --verbose --testNamePattern="debug"
```

### Memory Leaks or Resource Exhaustion

**Problem**: Test suite slows down or fails after running many tests.

**Solution**: Properly clean up resources:

```typescript
describe("ResourceHeavyModule", () => {
  let resource: StreamOrConnection;

  beforeEach(() => {
    resource = createExpensiveResource();
  });

  afterEach(() => {
    // CRITICAL: Always clean up
    resource.close();
    resource = null;
    jest.clearAllMocks();
  });

  it("should use resource correctly", () => {
    const result = resource.doSomething();
    expect(result).toBeDefined();
  });
});
```

---

## Branch Coverage Checklist (90% Target)

Use this checklist when targeting 90% branch coverage:

- [ ] **Normal path testing**: All happy-path scenarios execute (user provides valid input, no errors)
- [ ] **Error path testing**: Invalid inputs, missing required args, null/undefined values
- [ ] **Conditional branches**: Every `if/else`, `switch`, ternary operator tested in both directions
- [ ] **Logical operators**: AND (`&&`), OR (`||`) with both true and false outcomes
- [ ] **Optional chaining (`?.`)**: Test with both defined and undefined values
- [ ] **Nullish coalescing (`??`)**: Test with both null and non-null values
- [ ] **Try/catch blocks**: Both success and error branches tested
- [ ] **Guard clauses**: Early returns tested with triggering conditions
- [ ] **Loops**: Test with empty, single, and multiple iterations
- [ ] **Recursion**: Test with base cases and recursive calls
- [ ] **Type guards**: Test paths for each type being narrowed
- [ ] **Mocked dependencies**: If module-level mocks used, test both mock and default behavior
- [ ] **Edge cases**: Boundary values, off-by-one errors, empty collections
- [ ] **Integration points**: Dependencies called with expected arguments and return values verified

---

## Example: Full Test Suite (Parser Module)

Reference implementation showing 90%+ branch coverage:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { parseExpression, stringifyExpression, BinaryOperator } from "./parser";
import type { ParseResult, BinaryExpr, Term } from "./types";

describe("parseExpression", () => {
  describe("Happy Path: Valid Syntax", () => {
    it("should parse single positive term: +ABC", () => {
      const result = parseExpression("+ABC");
      expect(result.status).toBe("success");
      expect((result.ast as Term).sign).toBe("+");
      expect((result.ast as Term).code).toBe("ABC");
    });

    it("should parse single negative term: -XYZ01", () => {
      const result = parseExpression("-XYZ01");
      expect(result.status).toBe("success");
      expect((result.ast as Term).sign).toBe("-");
    });

    it("should parse AND expression: +A and -B", () => {
      const result = parseExpression("+A and -B");
      expect(result.status).toBe("success");
      expect((result.ast as BinaryExpr).operator).toBe(BinaryOperator.And);
    });

    it("should parse OR expression: +A or -B", () => {
      const result = parseExpression("+A or -B");
      expect(result.status).toBe("success");
      expect((result.ast as BinaryExpr).operator).toBe(BinaryOperator.Or);
    });

    it("should parse nested expressions with parentheses", () => {
      const result = parseExpression("(+A and -B) or +C");
      expect(result.status).toBe("success");
      expect((result.ast as BinaryExpr).operator).toBe(BinaryOperator.Or);
    });

    it("should parse explicit syntax: AND(A, B)", () => {
      const result = parseExpression("AND(A, B)");
      expect(result.status).toBe("success");
    });
  });

  describe("Error Path: Invalid Syntax", () => {
    it("should reject expression with lexer errors", () => {
      const result = parseExpression("+++ABC");
      expect(result.status).toBe("error");
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics!.length).toBeGreaterThan(0);
    });

    it("should reject trailing tokens after valid expression", () => {
      const result = parseExpression("+ABC and -XYZ +EXTRA");
      expect(result.status).toBe("error");
      expect(result.diagnostics![0].message).toMatch(/Unexpected token|Trailing/i);
    });

    it("should reject missing right operand after operator", () => {
      const result = parseExpression("+ABC and");
      expect(result.status).toBe("error");
      expect(result.diagnostics![0].message).toMatch(/expected|required/i);
    });

    it("should reject unmatched closing parenthesis", () => {
      const result = parseExpression("+ABC)");
      expect(result.status).toBe("error");
    });
  });

  describe("Stringification and Roundtrip", () => {
    it("should roundtrip: parse → stringify → parse", () => {
      const original = "+A and (-B or +C)";
      const result1 = parseExpression(original);
      const stringified = stringifyExpression(result1.ast!);
      const result2 = parseExpression(stringified);

      expect(result1.status).toBe("success");
      expect(result2.status).toBe("success");
    });

    it("should fallback to condensed syntax when nested OR inside AND", () => {
      const expr = parseExpression("+A and (+B or -C)");
      const stringified = stringifyExpression(expr.ast!);
      // Should use condensed syntax, not explicit syntax
      expect(stringified).toMatch(/\+A and/);
    });
  });
});
```

---

## Performance Considerations

### Test Execution Time Budget: 40 Seconds

For a suite of ~55 tests:

- **Target**: 2-5 seconds (leaves 35-38s buffer)
- **Acceptable**: 10-30 seconds
- **Warning**: > 30 seconds (investigate slow tests)
- **Fail**: > 40 seconds (timeout)

### Optimizing Slow Tests

```typescript
// ❌ SLOW: Creating expensive objects repeatedly
describe("SlowTests", () => {
  it("test 1", () => {
    const parser = new ExpensiveParser(); // Created in each test
    // ...
  });

  it("test 2", () => {
    const parser = new ExpensiveParser(); // Wasteful duplication
    // ...
  });
});

// ✅ FAST: Reuse expensive setup
describe("FastTests", () => {
  let parser: ExpensiveParser;

  beforeEach(() => {
    parser = new ExpensiveParser(); // Created once per test
  });

  afterEach(() => {
    parser.cleanup();
  });

  it("test 1", () => {
    // Use shared parser
  });

  it("test 2", () => {
    // Use shared parser
  });
});
```

### Parallel vs. Sequential Execution

For this project:

- **Use `--runInBand`** (sequential): More reliable coverage, easier to debug mocked tests
- **Avoid parallelization**: Jest's parallel worker mode can interfere with `jest.doMock()` (dynamic mocking)

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "22"
      - run: npm ci
      - run: npx jest --coverage --runInBand --watchAll=false --testTimeout=40000
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Local Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
npm test -- --coverage --runInBand --watchAll=false --bail
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

---

## Summary

**Key Takeaways**:

1. **Use correct test command**: `npx jest --coverage --runInBand --watchAll=false` (40s timeout)
2. **Target 90% branch coverage**: All conditional paths must execute
3. **Test three layers**: happy paths → error paths → edge cases (with mocking)
4. **Mock strategically**: External deps at module level, internal funcs with spyOn
5. **Measure continuously**: Rerun coverage after each test addition to verify progress
6. **Organize tests**: Nested describe blocks, descriptive names, proper setup/teardown
7. **Clean up**: Reset mocks and resources in afterEach hooks

For 90% branch coverage on complex DSL modules, expect to write **1.5-2x as many tests** as for standard modules (to cover all transformation branches and edge cases).
