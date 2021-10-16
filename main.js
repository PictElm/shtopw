/**/;module.exports=(function(){

  // istanbul ignore next
  var parser = require('bash-parser')
    , logger = function(o){/**/("string"===typeof o?console.log(o):console.dir(o,{depth:42}));/**/return o;};

  /**
   * @typedef {Object} Options
   * @property {string} mode 'bash' | 'posix', default 'posix'
   * @property {string} shebang default "#!/usr/bin/env pwsh"
   * @property {string} EOL default "\n"
   * 
   * @param {string} _source
   * @param {Options} _options
   * @return {string}
   */
  var r = function(_source, _options) {
    _source = _source.toString();
    _options = Object.assign(Object.create(r.defaultOptions), _options);

    var _result = handle(parser(_source, _options));

    return [
      _options.shebang,
      _result.join(_options.EOL),
      ""
    ].join(_options.EOL);
  };

  /** @type {Options} */
  r.defaultOptions = {
    shebang: "#!/usr/bin/env pwsh",
    EOL: "\n"
  };

  var variableHandlers = {
    // TODO
  };

  var commandHandlers = {
    // TODO
    'echo': 'Write-Output',
  };

  var nodeHandlers = {
    /**
     * the `Script` node is the AST root: a list of `Command`s
     *  .commands: []
     */
    Script: function(node) {
      var r = [];
      for (var com of node.commands)
        r.push.apply(r, handle(com));
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
     *   expression: string,
     *   commandAST: (AST)
     * }
     * ParameterExpansion = {
     *   parameter: string,
     *   kind?: string,
     *   word?: string,
     *   op?: string
     * }
     */
    Word: function(node) {
      if (node.expansion) {
        var s = [], it, at = 1;
        for (it of node.expansion) {
          s.push(node.text.slice(at, it.loc.start));
          at = it.loc.end+1;

          switch (it.type) {
            case 'ArithmeticExpansion': {
              // TODO
              ;
            } break;

            case 'CommandExpansion': {
              // TODO
              s.push(handle(it.something).join(" "));
            } break;

            case 'ParameterExpansion': {
              var h = variableHandlers[it.parameter];
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
    Command: function(node) {
      var r = [];

      if (node.prefix) {
        for (var it of node.prefix) {
          if ('Redirect' === it.type) {
            // TODO
            s.push(it.op.text);
            s.push(handle(it.file)[0]); // type: 'Word'
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
                word.expansion.push(Object.assign({}, ex, re));
              }
            } else delete word.expansion;

            s.push(handle(word)[0]); // type: 'Word'
            r.push(s.join(" "));
          }
        };
      }

      var h = node.name.text && commandHandlers[node.name.text];
      // istanbul ignore else
      if (h) {
        if ("string" === typeof h) { // command has direct translation (eg. echo -> Write-Output)
          var s = [h];
          if (node.suffix) for (var it of node.suffix) { // argument list
            if ('Redirect' === it.type) {
              s.push(it.op.text);
              s.push(handle(it.file)[0]); // type: 'Word'
            } else s.push(handle(it)[0]); // type: 'Word'
          }
          r.push(s.join(" "));
        } else r.push.apply(r, h(node)); // command has specified handler
      } else if (node.name.text) r.push(`Write-Error '"${node.name.text}": Not implemented yet'`);

      return r;
    },
  };

  /**
   * @param {{type: string}} node
   * @returns {string[]}
   */
  function handle(node) {
    return (node.type && nodeHandlers[node.type] ||
        // istanbul ignore next
        function(){return["Write-Error 'Not implemented yet'"];}
      )(node);
  }

return r;})();
