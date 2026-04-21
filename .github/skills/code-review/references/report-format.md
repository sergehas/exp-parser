# Code Review Report Format

Use this exact structure for every code review output.

## Template

````markdown
# Code Review Report

**Scope**: `{branch/PR/files}`
**Reviewed**: `{date}`
**Files reviewed**: `{count}`
**Generated artifacts excluded**: `{yes/no}`

## Automated Checks

| Check           | Command                                   | Result                |
| --------------- | ----------------------------------------- | --------------------- |
| Tests           | `npm test`                                | `{pass/fail/not-run}` |
| Build           | `npm run build`                           | `{pass/fail/not-run}` |
| Formatting      | `npx prettier --check . --ignore-unknown` | `{pass/fail/not-run}` |
| Lint (optional) | `npx eslint . --ext js,ts,json --quiet`   | `{pass/fail/not-run}` |

---

## 🟣 Critical ({count})

> Must fix before merge.

### CR-{n}: {short title}

- **File**: `{path}:{line}`
- **Rule**: {which axis/rule is violated}
- **Issue**: {description}
- **Fix**:

```{lang}
{corrected code}
```

---

## 🔴 Major ({count})

> Should fix before merge.

### MJ-{n}: {short title}

- **File**: `{path}:{line}`
- **Rule**: {which axis/rule}
- **Issue**: {description}
- **Fix**: {suggestion or code}

---

## 🟡 Minor ({count})

> Nice to fix, not blocking.

### MN-{n}: {short title}

- **File**: `{path}:{line}`
- **Issue**: {description}

---

## 🔵 Nits ({count})

> Style preferences, cosmetic.

- `{path}:{line}` — {description}

---

## 🟢 Good Practices Observed

- {What is done well — reinforces good patterns}

---

## Open Questions / Assumptions

- {Question or assumption that can affect review certainty}

---

## Summary

{1-3 sentence overall assessment focused on merge readiness.}

**Verdict**: `{APPROVE | APPROVE WITH COMMENTS | REQUEST CHANGES}`

---

## Checklist Summary

| Axis            | Status        | Findings |
| --------------- | ------------- | -------- |
| Architecture    | {pass/issues} | {count}  |
| Testing         | {pass/issues} | {count}  |
| TypeScript      | {pass/issues} | {count}  |
| Security / Perf | {pass/issues} | {count}  |

---

## No Findings Template

Use this section only when all finding counts are zero.

```markdown
No blocking or non-blocking issues were identified in reviewed files.

Residual risk:

- {example: limited confidence due to unexecuted checks, missing integration test coverage, or API dependency not mocked}
```

````

## Severity Definitions

| Severity     | Meaning                                                                                         | Action                  |
| ------------ | ----------------------------------------------------------------------------------------------- | ----------------------- |
| **Critical** | Security flaw, data corruption/loss risk, command contract breakage, unsafe transport setting   | Must fix before merge   |
| **Major**    | Incorrect behavior, missing error handling, missing tests for changed logic, architecture drift | Should fix before merge |
| **Minor**    | Maintainability/performance concern with low immediate impact                                   | Fix when convenient     |
| **Nit**      | Style, naming, formatting                                                                       | Optional                |

## Rules

- Every finding MUST cite `file:line`
- Critical and Major MUST include a fix suggestion
- If an axis has zero findings, mark it as "pass" in the summary table
- Do not skip axes in this repository; mark "pass" when no issue is found
- "Good Practices" section is mandatory — always find at least one positive thing
- Total findings count in summary must match the detailed sections
- Findings must be listed before summary/verdict
