#!/usr/bin/env node
/** @param {string[]} argv */
function main(argv) {
  /**
   * @typedef {Object} Arguments
   * @property {string[]} $
   * @property {string?} source
   * @property {string?} file
   */
  /** @type {Arguments} */
  const args = { $: [] };
  var tmp = null;
  argv.slice(1).forEach(it => {
    if (it.startsWith("--")) {
      if (-1 < it.indexOf("=")) {
        tmp = it.split("=");
        args[tmp[0]] = tmp[1];
        tmp = null;
      } else tmp = it.slice(2);
    } else if (it.startsWith("-")) {
      for (tmp = 1; tmp < it.length; tmp++)
        if (isNaN(+it[tmp])) args.$.push(it[tmp]);
        else if ("-" === it[tmp-1]) args.$.push(it);
        else {
          args[args.$.pop()] = it.slice(tmp);
          break;
        }
      if (tmp === it.length && isNaN(+it[tmp-1])) tmp = { $: args.$ };
      else tmp = null;
    } else if (null != tmp) {
      if (tmp.$) tmp = args.$.pop();
      args[tmp] = it;
      tmp = null;
    } else args.$.push(it);
  });
  delete tmp;
  /*---*/
  var file = args.file || args.$[0] || "";
  (file
    ? require('fs/promises').readFile(file).then(bf => bf.toString())
    : Promise.resolve(args.source || " ")
  )
  .then(sh => {
    try {
      console.log(require('..')(sh));
    } catch {
      console.log(require('shtopw')(sh));
    }
  });
}

const fs = require('fs/promises');
const path = require('path');
const EOL = require('os').EOL;

fs.access("bin")
  .then(() => void 0, () => fs.mkdir("bin"))
  .then(() => fs
    .writeFile(
      path.join("bin", "shtopw"),
      [
        "#!/usr/bin/env node",
        main.toString().replace(/\r?\n/g, EOL),
        "main(process.argv.slice(1/*?*/));",
        ""
      ].join(EOL)
    )
  );
