---
name: code-review
description: >
  Pro code review for the report generator Node.js CLI application.
  Performs a structured, repository-specific review across architecture,
  testing, TypeScript, and security/performance.
  TRIGGER when: "code review", "review this", "review my code", "review PR",
  "review the changes", "check my code", "CR", "pre-PR review", "review before merge",
  "what's wrong with this code", "audit this feature", "review this component",
  or any request to review code quality before merge.
  DO NOT TRIGGER for: writing new code, or debugging (use systematic-debugging).
---

# Code Review for the Generator application

Structured, multi-axis code review tailored to this TypeScript CLI project.

## Workflow

### 1. Identify Scope

Determine what to review:

- If the user provides a **branch or PR**: get changed files with `git diff --name-only develop...HEAD`
- If `develop` does not exist locally/remotely: use merge-base with the default branch available in the repo
- If the user points to **specific files**: review those files
- If the user says **"review everything"**: review all files changed since branching from `develop`

List all changed files grouped by type (`.ts`, `.spec.ts`, `.json`, config/docs).

Exclude generated artifacts unless explicitly requested: `build/`, `coverage/`, `reports/`, `reports-test/`, generated log snapshots.

### 2. Read All Changed Files

Read every changed file in full. Do not skip any file. For large diffs, read file by file.

### 3. Run Automated Checks

Run in parallel:

```bash
npm test
npm run build
npx prettier --check .
# optional when needed for review clarity
npx eslint . --ext js,ts,json --quiet
```

Report results before the manual review.

### 4. Manual Review — 4 Axes

Review each changed file against the checklist in `references/review-checklist.md`. The checklist covers:

1. **Architecture** — CLI command flow, controller/service/renderer boundaries, complexity and cohesion
2. **Testing** — Jest reliability, deterministic tests, coverage of success and failure paths
3. **TypeScript** — type safety, narrowing, `any` usage policy aligned with repo lint rules
4. **Security / Performance** — credential safety, network/TLS safety, API pagination, report generation performance

### 5. Produce the Review Report

Use the format in `references/report-format.md`.

## Key Principles

- **Be precise**: cite file path and line number for every finding
- **Severity matters**: Critical (must fix) > Major (should fix) > Minor (nice to fix) > Nit (style)
- **No false positives**: only flag real violations of rules, not personal preferences
- **Suggest fixes**: for Critical and Major, include a code snippet showing the fix
- **Acknowledge good patterns**: list what is done well (reinforces good habits)
- **Findings first**: list issues ordered by severity before summary text

## Reference Files

- **Full review checklist** (all 4 axes with detailed rules): see `references/review-checklist.md`
- **Report output format** (structured markdown template): see `references/report-format.md`
