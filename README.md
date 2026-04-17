# Boolean Expression Parser

> Requirements: **Node >= 22**

## What this it does

### DSL

DSL stands for Domain-Specific Language.

This DSL is used to express business logic as boolean rules, such as inclusion/exclusion criteria, in either compact or explicit wording.

The parser:

- accept rules in two equivalent input styles (condensed and explicit)
- confirm a consistent interpretation of the rule
- view the rule in normalized business-readable forms for validation and discussion

### Expression syntax

It parse expressions representing conditions which can be organized with `AND` and `OR`, written in a custom simple language. Then, when parsed, I want to be able to expand of factorize them
hint: using a DSL, parser/lexer/normalize/transform , building an AST, may be a good option

example expression to parse (condensed syntax)

```text
-ABC01 -AXC02 +XYZB1 +AAA01 +AAA02 -ADEXX +ABC02
```

which means:

```python
(not(ABC="01") and not(AXC="02") and XYZ="B1" and AAA="02") or (not(ADE="XX") and  ABC="02")
```

Same expression, but explicit syntax :

```text
(ABC:01 and AXC!02 and XYZ:B1 and AAA:01 and AAA:02) or (ADE!XX and ABC:02)
```

in condensed syntax :

- `-` means `not equals`
- `+` means `equals`
- `' '` means `and`
- `\r` means `or`
- each line is implicitly a group as if it was surrounded with parenthesis

in explicit syntax

- `:` means `not equals`
- `!` means `equals`
- and `and` and `or` operator are mandatory
- parenthesis are explicit
- grouping is done with explicit parenthesis
- `' '` is a separator
- `\n` is also a separator and has no meaning specific meaning

the 2 syntaxes cannot be mixed

### Acronyms used in outputs

- `CLI`: Command-Line Interface
- `DNF`: Disjunctive Normal Form
- `CNF`: Conjunctive Normal Form

#### Examples

- `+ABC01 and -XYZ02`
- `(ABC:01 or XYZ:02) and DEF:03`
- multi line

    ```text
    +ABC01 -XYZ02
    +DEF03 +GHI04
    +ABC01 -XYZ03
    +ABC01 -XYZ04
    +DEF03 +GHI08 +BOE00 -B0K22 +BOJ44
    ```

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

> "\n" are literals in the expression. They are substituted by `\n` char before processing

#### Explicit syntax

Uses `and` / `or` keywords and parentheses:

```powershell
npx ts-node .\src\main.ts parse -vvvv -e "ABC:01 and XYZ!02"
npx ts-node .\src\main.ts parse -vvv -e "(ABC:01 or XYZ!02) and DEF:03"
```

#### Verbose output

Add `-v` flags to increase verbosity (up to `-vvvvv`):

```powershell
npx ts-node .\src\main.ts parse -e "ABC:01 and XYZ:02" -vvv
```

The output shows the parsed expression in both syntaxes, the expanded Disjunctive Normal Form (DNF), and the factorized form.

#### Read expression from a file

Use `-f` to pass a file containing the expression instead of `-e`. The file may use real newlines for multi-line (OR-group) condensed syntax:

```powershell
# expr.txt contains:
#   +ABC01 -XYZ02
#   +DEF03 +GHI04
npx ts-node .\src\main.ts parse -f .\test\exp1.txt
npx ts-node .\src\main.ts parse -vvv -f .\test\exp1.txt
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
