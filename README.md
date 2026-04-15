# Boolean Expression Parser

> Requirements: **Node >= 16**

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

The `parse` command accepts a boolean expression via the `-e` flag. Two syntaxes are supported:

#### Condensed syntax

Spaces separate AND terms, newlines separate OR groups:

```powershell
npx ts-node .\src\main.ts parse -e "+ABC01 -XYZ02"
```

Multi-line (OR of AND groups):

```powershell
npx ts-node .\src\main.ts parse -e "+ABC01 -XYZ02
+DEF03 +GHI04"
```

#### Explicit syntax

Uses `and` / `or` keywords and parentheses:

```powershell
npx ts-node .\src\main.ts parse -e "+ABC01 and -XYZ02"
npx ts-node .\src\main.ts parse -e "(+ABC01 or -XYZ02) and +DEF03"
```

#### Verbose output

Add `-v` flags to increase verbosity (up to `-vvvvv`):

```powershell
npx ts-node .\src\main.ts parse -e "+ABC01 and -XYZ02" -vvv
```

The output shows the parsed expression in both syntaxes, the expanded (DNF) form, and the factorized form.

## Debug in VS Code

Use the provided configuration in [`.vscode/launch.json`](.vscode/launch.json).  
The launch config prompts for an expression string at startup.

## Test

```powershell
npx jest
```

## TODO
