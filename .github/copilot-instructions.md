# Sonarqube Report Generator: Copilot Instructions

## Project Architecture & Data Flow

- The project generates code quality reports from Sonarqube and GitHub PRs, supporting multiple output formats (JSON, Markdown, CSV, XLSX).
- Main entry points: `src/main.ts` (Sonarqube reports) and `src/main.gh.ts` (GitHub reports).
- Core services:
  - `src/services/data/SonarqubeService.ts`: Fetches and processes Sonarqube data, handles authentication via environment variables or CLI args.
  - `src/services/data/ReportService.ts`: Aggregates and flattens report data for rendering.
- Data model: See `src/models/models.ts` for `Report`, `Module`, `Branch`, and `Metrics` types.

## Developer Workflows

- **Install:**
  - `npm i` (Node >= 16 required)
- **Run:**
  - Use CLI: `npx ts-node .\src\main.ts `
- **Debug:**
  - VS Code launch config uses `src/main.ts` with runtime args and environment variables.
- **Build:**
  - TypeScript compilation via `tsc` (see `tsconfig.json`).
- **Test:**
  - Jest is used for unit tests (see `jest.config.js`).

## Coding Conventions & Patterns

- TypeScript is required for all new code.
- Use interfaces for data structures; prefer immutable data (`const`, `readonly`).
- Use optional chaining (`?.`) and nullish coalescing (`??`).
- Avoid `any`; use `unknown` if type is not known.
- Renderer pattern: Add new output formats by extending `RendererService` and updating `buildRenderers`.


---

For more details, see `README.md` and coding standards in `.github/instructions/`.
