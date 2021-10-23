#!/usr/bin/env node
const shtopw = require('..');

const fs = require('fs/promises');
const path = require('path');

const argv = process.argv;

/** @returns {Promise<string>} */
function someContent(someFile) {
  return !someFile || "-" === someFile
    ? new Promise((resolve, reject) => {
        let data = "";
        process.stdin
          .on('data', bf => data+= bf)
          .on('end', () => resolve(data))
          .on('error', reject)
          .setEncoding('utf8');
      })
    : fs.readFile(path.join(__dirname, "..", someFile), { encoding: 'utf8' })
        .then(bf => bf.toString())
}

if ("-ast" === argv[2]) {
  someContent(argv[3])
    .then(sh => console.dir(require('bash-parser')(sh), { depth: 42 }));
} else if ("-stp" === argv[2]) {
  someContent(argv[3])
    .then(sh => console.log(shtopw(sh)));
} else {
  const folder = process.argv[2] || "command";
  const file = process.argv[3] || "variable.sh";
  const options = {};

  console.clear();
  console.log("\n".repeat(42));

  fs.readFile(path.join(__dirname, "..", "tests", "snippets", folder, file))
    .then(bf => bf.toString())
    .then(sh => ["", sh, shtopw(sh, options)])
    .then(sh_pwsh => console.log(sh_pwsh.join("\n---------------------\n")));
}
