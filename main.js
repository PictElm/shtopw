/**/;module.exports=(function(){

  /**
   * @typedef {Object} Options
   * @property {string} hey
   * 
   * @param {string} _source
   * @param {Options} _options
   * @return {string}
   */
  var r = function(_source, _options) {
    _source = _source.toString();
    if (!_options) _options = r.defaultOptions;

    /*-*/ console.dir(require('bash-parser')(_source), { depth: 42 });

    return "";
  };

  /** @type {Options} */
  r.defaultOptions = {};

return r;})();
