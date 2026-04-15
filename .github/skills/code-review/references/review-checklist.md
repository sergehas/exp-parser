# Review Checklist — CLI App (4 Axes)

## 1. Architecture

- [ ] CLI command contract is coherent (commands, aliases, required options, help text)
- [ ] Entry points are respected (`src/main.ts` and command parser flow in `src/services/utils/cli.ts`)
- [ ] Layer boundaries are preserved: controllers orchestrate, services fetch/transform, renderers format/output
- [ ] No cross-layer leakage (for example, renderer logic in data services, transport details in models)
- [ ] Renderer selection and unknown renderer handling are explicit and deterministic
- [ ] New code avoids duplicated orchestration logic; shared behavior is extracted to helpers/services when relevant
- [ ] Cognitive complexity is reasonable per function (target <= 15)

## 2. Testing

- [ ] Tests use Jest conventions (`*.spec.ts`) and run with `npm test`
- [ ] New behavior has tests for nominal and failure paths
- [ ] Tests are deterministic (mock network calls, time, randomness, and filesystem side effects)
- [ ] Unit tests avoid writing persistent artifacts unless isolated and cleaned up
- [ ] Assertions validate behavior, not only snapshots/logs
- [ ] Performance/load tests are bounded and do not create unstable CI timing
- [ ] Debug-only test output (`console.log`, `console.time`) is removed unless explicitly justified
- [ ] Test names and messages are in English

## 3. TypeScript

- [ ] No `any` in source code (`src/**`) unless strictly unavoidable
- [ ] In tests, `any` usage follows repository lint policy and is justified when present
- [ ] No `eslint-disable` used to bypass type-safety rules without clear rationale
- [ ] `unknown` is narrowed with type guards before property access
- [ ] Avoid unsafe non-null assertions (`!`) unless locally proven safe
- [ ] Public methods/classes are documented per project guidance
- [ ] Names, comments, and error messages are in English

## 4. Security / Performance

- [ ] No secrets/tokens/credentials in source, logs, or generated reports
- [ ] TLS and transport safety is preserved (flag `NODE_TLS_REJECT_UNAUTHORIZED = "0"` as critical unless justified)
- [ ] External API requests encode dynamic query values and handle non-2xx responses safely
- [ ] Pagination/limits are considered for APIs returning large datasets
- [ ] Error logs provide context without leaking sensitive data
- [ ] No leftover `console.log` in production code; use centralized logger
- [ ] Report generation paths avoid unnecessary memory-heavy operations on large payloads
