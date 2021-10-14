/**/;module.exports=(function(){

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

    /*-* / console.dir(require('bash-parser')(_source, _options), { depth: 42 });
     */

    return [
      _options.shebang,
      "Write-Error 'Not implemented yet'",
      ""
    ].join(_options.EOL);
  };

  /** @type {Options} */
  r.defaultOptions = {
    shebang: "#!/usr/bin/env pwsh",
    EOL: "\n"
  };

return r;})();
