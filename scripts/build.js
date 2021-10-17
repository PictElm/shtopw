#!/usr/bin/env node
/** @param {string[]} argv */
function main(argv) {
  const path = require('path');
  /**
   * @typedef {Object} Arguments
   * @property {string[]} $
   * @property {?string} help get help
   * @property {?string} file input file or "-" for stdin
   * @property {?string} source source from parameter
   * @property {?string} dir directory to get files from, looks for relevant shebangs, not recursive
   * @property {?string} out output file, defaults to stdout
   * @property {?string} mode 'bash' | 'posix', default 'posix'
   * @property {?string} shebang default "#!/usr/bin/env pwsh"
   */
  var usage = `Usage: ${path.basename(argv[0])} ([-f] <file.sh> | -s <source> | -d <dir>) [[-o] <out.ps1>] ...
  
  --file    -f: file to read source from
  --source  -s: shell script source
  --dir     -d: run on each files in dir that has a relevant shebangs
                  if specified, out is treated as a dir to dump results to
                  (defaults to the same dir) results will have the same name
                  as their respective sources but with ".ps1" extension
  --out     -o: specify output
  
  --mode      : 'bash' or 'posix', default 'posix'
                  (support for bash syntaxes is not guaranteed)
  --shebang   : default "#!/usr/bin/env pwsh"
  `;
  var relevantShebangs = [
    "#!/bin/sh",
    "#!/usr/bin/env sh",
  ];
  /** @type {Arguments} */
  var args = { $: [argv[0]] };
  var tmp = null;
  argv.slice(1).forEach(it => {
    if (it.startsWith("--") && "--" !== it) {
      if (null != tmp) args[tmp] = true;
      if (-1 < it.indexOf("=")) {
        tmp = it.split("=");
        args[tmp[0].slice(2)] = tmp[1];
        tmp = null;
      } else tmp = it.slice(2);
    } else if (it.startsWith("-") && "-" !== it) {
      for (var k = 1; k < it.length; k++) {
        if (null != tmp) args[tmp] = true;
        if ("'" === it[k]) {
          args[tmp] = it.slice(k+1, -1);
          tmp = null;
          break;
        } else if (isNaN(+it[k])) tmp = it[k];
        else if ("-" === it[k-1]) args.$.push(it);
        else {
          args[tmp] = it.slice(k);
          tmp = null;
          break;
        }
      }
    } else if (null != tmp) {
      args[tmp] = it;
      tmp = null;
    } else args.$.push(it);
  });
  if (null != tmp) args[tmp] = true;
  const fs = require('fs/promises');
  const error = err => process.stderr.write(err && err.message || err || "Error: Unspecified error");
  if (args.help || args.h || args['?'] || '/?' == args.$[1])
    return void process.stdout.write(usage);
  args.out = args.out || args.o || args.$[2] || "";
  if (args.dir = (args.dir || args.d || null))
    return void fs
      .mkdir(args.out = (args.out || args.dir), { recursive: true })
      .then(() => fs
        .readdir(args.dir)
        .then(ls => ls
          .forEach(fn => fs
            .readFile(path.join(args.dir, fn)).then(bf => bf.toString())
            .then(sh => -1 < relevantShebangs.indexOf(sh.split("\n", 1)[0].trim())
              && main([argv[0],
                "--file", path.join(args.dir, fn),
                "--out", path.join(args.out, fn.replace(/\.sh$/, ".ps1")),
                args.mode && "--mode", args.mode,
                args.shebang && "--shebang", args.shebang,
              ].filter(it => it))
            )
          )
        )
      )
      .catch(error);
  args.file = args.file || args.f || args.$[1] || "";
  args.source = args.source || args.s || " ";
  var opts = { file: args.file, EOL: require('os').EOL };
  if (args.mode) opts.mode = args.mode;
  if (args.shebang) opts.shebang = args.shebang;
  return void (args.file
      ? "-" === args.file
        ? new Promise((resolve, reject) => {
            let data = "";
            process.stdin
              .on('data', bf => data+= bf)
              .on('end', () => resolve(data))
              .on('error', reject)
              .setEncoding('utf8');
          })
        : fs.readFile(args.file, { encoding: 'utf8' }).then(bf => bf.toString())
      : Promise.resolve(args.source)
    )
    .then(src => {
      var shtopw;
      try {
        shtopw = require('..');
      } catch {
        shtopw = require('shtopw');
      }
      (args.out
        ? str => fs.writeFile(args.out, str, { encoding: 'utf8' })
        : str => process.stdout.write(str, 'utf8')
      )(shtopw(src, opts));
    })
    .catch(error);
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
        "main(process.argv.slice(1));",
        ""
      ].join(EOL)
    )
  );
