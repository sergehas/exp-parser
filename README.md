# Boolean Expression Parser

> Requirements: **Node >= 22**

## What this DSL does

DSL stands for Domain-Specific Language.

This DSL is used to express business logic as boolean rules, such as inclusion/exclusion criteria, in either compact or explicit wording.

The parser helps teams:

- accept rules in two equivalent input styles (condensed and explicit)
- confirm a consistent interpretation of the rule
- view the rule in normalized business-readable forms for validation and discussion

Acronyms used in outputs:

- CLI: Command-Line Interface
- DNF: Disjunctive Normal Form
- CNF: Conjunctive Normal Form

## Install

```powershell
npm i
```

## Run

Inline documentation is available from the CLI:

```powershell
npx ts-node .\src\main.ts -h
```

### Parse an expression

The `parse` command accepts a boolean expression either inline via `-e` or from a file via `-f`. The two flags are mutually exclusive. Two syntaxes are supported:

#### Condensed syntax

Spaces separate AND terms, newlines separate OR groups:

```powershell
npx ts-node .\src\main.ts parse -e "+ABC01 -XYZ02"
npx ts-node .\src\main.ts parse -vvvv -e "+ABC01 +ABC02 -XYZ02"
```

Multi-line (OR of AND groups):

```powershell
npx ts-node .\src\main.ts parse -vvvv -e "+ABC01 -XYZ02\n+ABC01 +GHI04\n+DEF03 +GHI04"
```

> "\n" are literals in the expression. They are substituted by '\n' char before processing

#### Explicit syntax

Uses `and` / `or` keywords and parentheses:

```powershell
npx ts-node .\src\main.ts parse -vvvv -e "+ABC01 and -XYZ02"
npx ts-node .\src\main.ts parse -vvv -e "(+ABC01 or -XYZ02) and +DEF03"
```

#### Verbose output

Add `-v` flags to increase verbosity (up to `-vvvvv`):

```powershell
npx ts-node .\src\main.ts parse -e "+ABC01 and -XYZ02" -vvv
```

The output shows the parsed expression in both syntaxes, the expanded Disjunctive Normal Form (DNF), and the factorized form.

#### Read expression from a file

Use `-f` to pass a file containing the expression instead of `-e`. The file may use real newlines for multi-line (OR-group) condensed syntax:

```powershell
# expr.txt contains:
#   +ABC01 -XYZ02
#   +DEF03 +GHI04
npx ts-node .\src\main.ts parse -f .\expr.txt
npx ts-node .\src\main.ts parse -vvv -f .\expr.txt
```

> `-e` and `-f` are mutually exclusive — only one may be provided per invocation.

## Debug in VS Code

Use the provided configuration in [`.vscode/launch.json`](.vscode/launch.json).  
The launch config prompts for an expression string at startup.

## Test

```powershell
npx jest
```

## TODO
