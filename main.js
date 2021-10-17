/**/;module.exports=(function(){

  // istanbul ignore next
  var parser = require('bash-parser')
    , logger = function(o){/**/("string"===typeof o?console.log(o):console.dir(o,{depth:42}));/**/return o;};

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
   * @property {?Handlers} handlers
   * 
   * @typedef {Object} Context
   * @property {string} source
   * @property {Options} options
   * @property {Handlers} handlers
   * @property {AST} root
   * @property {AST} ast
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
    };
    var result = handle(ast, context);

    return [
      options.shebang,
      result.join(options.EOL),
      "",
    ].join(options.EOL);
  };

  /** @type {Options} */
  r.defaultOptions = {
    shebang: "#!/usr/bin/env pwsh",
    EOL: "\n",
  };

  /** @type {Handlers} */
  r.defaultHandlers = {
    variable: {
      // TODO
    },

    command: {
      // TODO
      'echo': 'Write-Output',
      'cat': 'Get-Content', // XXX: no pipeline input
      'ls': 'Get-ChildItem', // XXX: outputs not comparable
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
          for (var it of node.expansion) if (sanityCheck(it.loc)) {
            s.push(node.text.slice(at, it.loc.start));
            at = it.loc.end+1;

            switch (it.type) {
              case 'ArithmeticExpansion': {
                // @see https://www.gnu.org/software/bash/manual/html_node/Shell-Arithmetic.html
                // note: operators, which are Bash? which are POSIX?
                s.push("$(" + it.expression + ")");
              } break;

              case 'CommandExpansion': {
                var past = context.ast;
                context.ast = it.commandAST;
                s.push("$(" + handle(it.commandAST, context).join("; ") + ")"); // type: 'Script'
                context.ast = past;
              } break;

              case 'ParameterExpansion': {
                var h = context.handlers.variable[it.parameter];
                if (h) { // special-case env variable (eg. $RANDOM)
                  // TODO
                  s.push(h);
                } else s.push("$" + it.parameter);
              } break;
            }
          }
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

        if (node.prefix) {
          for (var it of node.prefix) {
            if ('Redirect' === it.type) {
              // TODO
              //s.push(it.op.text);
              //s.push(handle(it.file, context)[0]); // type: 'Word'
              r.push(`Write-Warning '"prefix redirect": Not implemented yet'`)
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

              var v = handle(word, context)[0];
              // XXX: hacky, does other things than assignment need a word to always be quotted?
              if ("$" !== v.charAt(0) && '"' !== v.charAt(0) && "'" !== v.charAt(0))
                v = "'" + v + "'";

              s.push(v); // type: 'Word'
              r.push(s.join(" "));
            }
          };
        }

        var com = node.name;
        var h = com && context.handlers.command[com.text];

        if (com && com.expansion) // variable as command
          h = "& " + handle(com, context)[0]; // type: 'Word'

        // istanbul ignore else
        if (h) {
          if ("string" === typeof h) { // command has direct translation (eg. echo -> Write-Output)
            var s = [h];
            if (node.suffix) for (var it of node.suffix) { // argument list
              if ('Redirect' === it.type) {
                s.push(it.op.text);
                s.push(handle(it.file, context)[0]); // type: 'Word'
              } else s.push(handle(it, context)[0]); // type: 'Word'
            }
            r.push(s.join(" "));
          } else r.push.apply(r, h(node, context)); // command has specified handler
        } else if (com) r.push(`Write-Error '"${com.text}": Not implemented yet'`);

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

        return [s.join(" | ")];
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
        // istanbul ignore next
        function(){return[`Write-Error 'Node ${node.type || node}: Not implemented yet'`];}
      )(node, context);
  }

  /**
   * @param {{ start: number, end: number }} nodeLoc
   * @returns {boolean}
   */
  function sanityCheck(nodeLoc) {
    return -1 < nodeLoc.start && -1 < nodeLoc.end;
  }

return r;})();
