# Boolean Expression Parser: Copilot Instructions

## Project Overview

CLI parser for boolean expressions in condensed and explicit syntaxes. It builds an AST and outputs parsed, expanded, and factorized forms.

- Main entry point: `src/main.ts`
- Core parse flow: input expression -> syntax detection -> tokenization -> parsing -> normalize/transform -> logger output

## Architecture & Data Flow

- Parse pipeline: input expression -> syntax detect -> tokenize -> parse -> normalize/transform -> logger output
- `src/services/utils/cli.ts`: command parsing and input resolution (`-e` inline expression, `-f` file input)
- `src/controllers/ParseController.ts`: orchestration for parsing and transformations
- `src/dsl/detect.ts`: syntax detection (condensed vs explicit)
- `src/dsl/lexer.ts`: tokenization
- `src/dsl/parser.ts`: expression parsing and stringify helpers
- `src/dsl/normalize.ts`: canonicalization and term normalization helpers
- `src/dsl/transform.ts`: expression expansion and factorization
- `src/services/utils/logger.ts`: Winston logger and verbosity control

## Developer Workflows

- Install: `npm i` (Node >= 22)
- Run help: `npx ts-node .\src\main.ts -h`
- Parse inline expression: `npx ts-node .\src\main.ts parse -e "+ABC01 and -XYZ02"`
- Parse from file: `npx ts-node .\src\main.ts parse -f .\expr.txt`
- Increase verbosity: add `-v` up to `-vvvvv`
- Start script: `npm start`
- Build: `npm run build`
- Test: `npm test`
- Coverage: `npm run test:coverage`
- Lint: `npm run lint`
- Lint with fixes: `npm run lint:fix`

## Coding Guidance Source of Truth

- General standards: `.github/instructions/general-coding.instructions.md`
- TypeScript standards: `.github/instructions/typescript-coding.instructions.md`

Keep this file focused on project architecture and workflows. Place language-specific implementation rules in the corresponding instruction file.

---

For command examples and CLI behavior details, see `README.md`.
