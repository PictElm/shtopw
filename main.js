/**/;module.exports=(function(){

  // istanbul ignore next
  var parser = require('bash-parser')
    , logger = function(o){/**/('string'===typeof o?console.log(o):console.dir(o,{depth:42}));/**/return o;};

  var assign = Object.assign
    , create = Object.create;

  /**
   * @typedef {Object} Handlers
   * @property {?Object.<string, string | function({type:string}, Context): string[]>} variable
   * @property {?Object.<string, string | function({type:string}, Context): string[]>} command
   * @property {?Object.<string, function({type:string}, Context): string[]>} node
   * 
   * @typedef {Object} Options
   * @property {?string} mode 'bash' | 'posix', default 'posix'
   * @property {?string} shebang default "#!/usr/bin/env pwsh"
   * @property {?string} EOL default "\n"
   * @property {?string} indent sequence used to indent, default 4 spaces
   * @property {?Handlers} handlers
   * 
   * @typedef {Object} Context
   * @property {string} source
   * @property {Options} options
   * @property {Handlers} handlers
   * @property {AST} root
   * @property {AST} ast
   * @property {string} indent
   */

  /**
   * @param {string} source
   * @param {?Options} options
   * @param {?Handlers} handlers
   * @return {string}
   */
  var r = function(source, options, handlers) {
    source = source.toString();
    options = assign(create(r.defaultOptions), options);
    handlers = assign(create(r.defaultHandlers), handlers);

    var ast = parser(source, options);
    var context = {
      source: source,
      options: options,
      handlers: handlers,
      root: ast,
      ast: ast,
      indent: "",
    };
    var result = handle(ast, context);

    return [
      options.shebang,
      result.join(options.EOL),
      "",
    ].join(options.EOL);
  };

  // istanbul ignore next
  var defaultSymbol = r.defaultSymbol = 'function' === typeof Symbol
    ? Symbol('default')
    : '[[default]]';

  /** @type {Options} */
  r.defaultOptions = {
    shebang: "#!/usr/bin/env pwsh",
    EOL: "\n",
    indent: "    ",
  };

  /** @type {Handlers} */
  r.defaultHandlers = {
    variable: {
      // TODO
      'RANDOM': "$(Get-Random -Maximum 32768)",
      [defaultSymbol]: function(node, context) {
        var asNumber = +node.parameter;
        if (!isNaN(asNumber))
          return !asNumber
            ? "$($myInvocation.MyCommand.Path)" // XXX: absolute path
            : "$($args[" + (asNumber-1) + "])";
        return null;
      },
    },

    command: {
      // TODO
      'echo': 'Write-Output', // XXX: new lines between words (instead of spaces)
      'cat': 'Get-Content', // XXX: no pipeline input
      'ls': 'Get-ChildItem -Name',
      'source': '.',
      '[': function(node, context) {
        var niw = {
          type: 'Command',
          name: { type: 'Word', text: 'test' },
          suffix: node.suffix.slice(0, -1), // remove trailing ']'
        };
        return context.handlers.command['test'](niw, context);
      },
      'test': function(node, context) { 
        // @see https://pubs.opengroup.org/onlinepubs/9699919799/utilities/test.html
        var s = [], args = node.suffix;
        function ensureQuotes(p) {
          if ("'\"".indexOf(p.charAt(0)) < 0)
            p = "'" + p + "'";
          return p;
        }
        for (var k = 0, it; k < args.length; k++) switch ((it = args[k]).text) {
          case '-d': {
            s.push('Test-Path -PathType Container -Path');
            s.push(handle(args[++k], context)[0]);
          } break;

          case '-f': {
            s.push('Test-Path -PathType Leaf -Path');
            s.push(handle(args[++k], context)[0]);
          } break;

          case '-z': {
            s.push("0 -eq");
            s.push(ensureQuotes(handle(args[++k], context)[0]) + ".Length");
          } break;

          case '-n': {
            s.push("0 -ne");
            s.push(ensureQuotes(handle(args[++k], context)[0]) + ".Length");
          } break;

          case '=': {
            s[s.length-1] = ensureQuotes(s[s.length-1]);
            s.push("-ceq");
            s.push(ensureQuotes(handle(args[++k], context)[0]));
          } break;

          case '!=': {
            s[s.length-1] = ensureQuotes(s[s.length-1]);
            s.push("-cne");
            s.push(ensureQuotes(handle(args[++k], context)[0]));
          } break;

          case '!': s.push("-not"); break;
          case '-o': s.push("-or"); break;
          case '-a': s.push("-and"); break;
          case '-eq': case '-ne': case '-gt': case '-ge': case '-lt': case '-le': s.push(it.text); break;

          default: s.push(handle(it, context)[0]);
        }
        return [s.join(" ")];
      },
      [defaultSymbol]: function(node, context) {},
    },

    node: {
      /**
       * the `Script` node is the AST root: a list of `Command`s
       *  .commands: Array<Node>
       */
      Script: function(node, context) {
        var r = [];
        for (var com of node.commands)
          r.push.apply(r, handle(com, context));
        return r;
      },

      /**
       * a `Word` node is any sequence of character subject to expansions/substitutions/...
       *  .text: string
       *  .expansion?: Array<ArithmeticExpansion | CommandExpansion | ParameterExpansion>
       * 
       * ArithmeticExpansion = {
       *   expression: string,
       *   arithmeticAST: (AST)
       * }
       * CommandExpansion = {
       *   command: string,
       *   commandAST: (AST)
       * }
       * ParameterExpansion = {
       *   parameter: string,
       *   kind?: string,
       *   word?: string,
       *   op?: string
       * }
       */
      Word: function(node, context) {
        if (node.expansion) {
          var s = [], at = 1;
          var pindent = context.indent;
          context.indent = "";
          for (var ex of node.expansion) {
            s.push(node.text.slice(at, ex.loc.start));
            at = ex.loc.end+1;

            switch (ex.type) {
              case 'ArithmeticExpansion': {
                // @see https://www.gnu.org/software/bash/manual/html_node/Shell-Arithmetic.html
                // note: operators, which are Bash? which are POSIX?
                s.push("$(" + ex.expression + ")");
              } break;

              case 'CommandExpansion': {
                var past = context.ast;
                context.ast = ex.commandAST;
                s.push("$(" + handle(ex.commandAST, context).join("; ") + ")"); // type: 'Script'
                context.ast = past;
              } break;

              case 'ParameterExpansion': {
                var h = context.handlers.variable[ex.parameter] || context.handlers.variable[defaultSymbol];
                if ('function' === typeof h) h = h(ex, context);
                if (h) {
                  // TODO?
                  s.push(h);
                } else s.push("$" + ex.parameter);
              } break;
            }
          }
          context.indent = pindent;
          s.push(node.text.slice(at, -1));

          return ['"' + s.join("") + '"'];
        } else {
          if (node.text.match(/\W/g))
            return ["'" + node.text + "'"];
          return [node.text];
        }
      },

      /**
       * a `Command` node is a builtin or external command to execute with an optional
       * list of arguments and stream redirection
       *  .name?: Word
       *  .prefix: Array<AssignmentWord | Redirect>
       *  .suffix: Array<Word | Redirect>
       * 
       * Redirect = {
       *   op: { text: '>' | '<', type: 'great' | 'less' },
       *   file: Word
       * }
       */
      Command: function(node, context) {
        var r = [];
        function newline(line) { r.push(context.indent + line); }
        function newlines(lines) { for (var ln of lines) newline(ln); }

        if (node.prefix) {
          for (var it of node.prefix) {
            // istanbul ignore if
            if ('Redirect' === it.type) {
              // TODO
              //s.push(it.op.text);
              //s.push(handle(it.file, context)[0]); // type: 'Word'
              newline(`Write-Warning '"prefix redirect": Not implemented yet'`)
            } else {
              var k = it.text.indexOf("=");
              var s = ["$" + it.text.slice(0, k), "="];

              // treat the expression as a `Word` of sort
              var word = {
                type: 'Word',
                text: it.text.slice(k+1),
                expansion: [],
              };
              if (it.expansion) {
                for (var ex of it.expansion) {
                  var re = { loc: {
                    start: ex.loc.start - k,
                    end: ex.loc.end - k,
                  } };
                  word.expansion.push(assign({}, ex, re));
                }
              } else delete word.expansion;

              var v = handle(word, context)[0]; // type: 'Word'
              if ("$'\"".indexOf(v.charAt(0)) < 0)
                v = "'" + v + "'";

              s.push(v);
              newline(s.join(" "));
            }
          };
        }

        var com = node.name;
        var h;

        if (com) {
          if (com.expansion) // variable as command
            h = "& " + handle(com, context)[0]; // type: 'Word'
          else
            h = context.handlers.command[com.text] || context.handlers.command[defaultSymbol];
            if ('function' === typeof h) h = h(node, context); // command has specified handler
        }

        // istanbul ignore else
        if (h) {
          if ('string' === typeof h) { // command has direct translation
            var s = [h];
            if (node.suffix) for (var it of node.suffix) { // argument list
              if ('Redirect' === it.type) {
                s.push(it.op.text);
                s.push(handle(it.file, context)[0]); // type: 'Word'
              } else s.push(handle(it, context)[0]); // type: 'Word'
            }
            newline(s.join(" "));
          } else newlines(h); // XXX: type checking would not hurt
        } else if (com) newline(`Write-Error '"${com.text}": Not implemented yet'`);

        return r;
      },

      /**
       * `Pipeline` represents a list of commands concatenated with pipes
       *  .commands: Array<Node>
       */
      Pipeline: function(node, context) {
        var s = [];

        for (var com of node.commands)
          s.push(handle(com, context));

        return [context.indent + s.join(" | ")];
      },

      /**
       * a `LogicalExpression` represents two commands concateneted with a && a ||
       *  .left: Node
       *  .right: Node
       *  .op: '&&' | '||'
       */
      LogicalExpression: function(node, context) {
        var s = [
          handle(node.left, context),
          "or" === node.op ? "||" : "&&",
          handle(node.right, context),
        ];
        return [context.indent + s.join(" ")];
      },

      /**
       * the `If` conditional statement
       *  .clause: Array<Node>
       *  .then: Array<Node>
       *  .else: Array<Node>
       */
      If: function(node, context) {
        var r = [];

        var s = [];
        for (var com of node.clause.commands)
          s.push.apply(s, handle(com, context));
        r.push("if (" + s.join(" ") + ") {"); // TODO/XXX

        var pindent = context.indent;
        context.indent+= context.options.indent;

        for (var com of node.then.commands)
          r.push.apply(r, handle(com, context));

        if (node['else']) {
          r.push("} else {");
          for (var com of node['else'].commands)
            r.push.apply(r, handle(com, context));
        }

        r.push("}");
        r.push("");
        context.indent = pindent;

        return r;
      },

      /**
       * somehow unknown node type
       */
      [defaultSymbol]: /* istanbul ignore next */ function(node, context) {
        return [`Write-Error 'Node ${node.type || node}: Not implemented yet'`];
      },
    },
  };

  /**
   * @param {{type: ?string}} node
   * @param {Context} context
   * @returns {string[]}
   */
  function handle(node, context) {
    return (node.type && context.handlers.node[node.type] ||
        /* istanbul ignore next */ context.handlers.node[defaultSymbol]
      )(node, context);
  }

return r;})();
