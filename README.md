# shtopw

An abandoned attempt at automatic translation of shell scripts to PowerShell scripts.

## Usage

Used as a nodejs module, this exports a function:

```ts
function shtopw(source: string, options?: Options, handlers?: Handlers): string
```

_Ideally_, this function only throws `SyntaxError`s forwarded from the shell parser.

The exported object also has the following properties:
 * `defaultOptions`: the default options, when not specified
 * `defaultHandlers`: the handlers, when not overriden (via the third parameter)
 * `defaultSymbol`: a symbol (is available) to use for a handler's fallback on missing key

### Options

The existing and implemented options are:
 * `shebang`: preprends a line to the output (default: `"#!/usr/bin/env pwsh"`)
 * `EOL`: the end of line sequence, defaults to `"\n"`
 * `indent`: indentation style for the generated script (example: `"\t"`)

---

# Notes

Given the project will probably not move a lot, here is the state of things.

## `bin/shtopw`

A JavaScript script file generated with `npm run build` (uses the [`build.js`](./scripts/build.js) script). It is used to call `shtopw` from the command line:

```
Usage: shtopw ([-f] <file.sh> | -s <source> | -d <dir>) [[-o] <out.ps1>] ...
```

This file is build on postinstall.

## `scripts/test.js`

The test and coverage are done using [`Jest`](https://jestjs.io/) with the [`test.js`](./scripts/test.js) script. Actual tests are in the `tests/snippets` folder which are meant to be run with the `tests/playground/` as current working directory.

To run the test, it will require in the path:
 - `sh` to be a POSIX-compliant shell script interpreter (eg. bash, with the `--posix` flag)
 - `pwsh` to be the [PowerShell](https://github.com/PowerShell/PowerShell) interpreter (not sure the minimal version, 7.1 was used in development)

## `main.js`

The `main.js` scripts uses [this fork](https://github.com/PictElm/bash-parser) of [`bash-parser`](https://github.com/vorpaljs/bash-parser) to build and traverse an AST representation of the source script. Elements are forwarded to the appropriated handlers; there are 3 kinds of handlers: [node](#Node-Handlers), [command](#Command-Handlers) and [variable](#Variable-Handlers).

### Node Handlers

The nodes are as defined by the `bash-parser` (see [here](https://github.com/PictElm/bash-parser/blob/master/documents/ast.md)); a correct handler for a node is expected to build and return a list of lines to emit, taking as parameters the node itself and the current [context](#The-Context).

### Command Handlers

Command handlers should translate when appropriated a shell command to PowerShell equivalent. A valid hander can be either a string (in the case of a direct translation) or a function akin to a node handler. Returning a single string (as in not a list) will let `shtopw` in charge of the command's arguments, as if it was a direct translation of the command.

### Variable Handlers

Variable handers are similar to command handlers (either a string or a function) except if it is a function, it is expected to return a single string (not a list). The [default handler](#Default-Symbol) for variables is used for the shell arguments (`${n}`).

### Default Symbol

For any handler `h`, `h[shtopw.defaultSymbol]` can be set as the default fallback. Note that it does not have priority over defined entries.

### The Context

When calling an any handler, the context is passed around. This context consists of the following properties:
 * `source`: the raw source passed to `shtopw`
 * `options`: the options passed to `shtopw`
 * `handlers`: the current handlers (`node`, `command` and `variable`)
 * `root`: the AST representation of the whole script being processed
 * `ast`: the AST representation of the nearest parent `Script` node (which may differ from `root`)
 * `indent`: the current indentation
