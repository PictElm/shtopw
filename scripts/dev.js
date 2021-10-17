#!/usr/bin/env node
const shtopw = require('..');

const fs = require('fs/promises');
const path = require('path');

if ("-ast" === process.argv[2]) {
  fs.readFile(path.join(__dirname, "..", process.argv[3]))
    .then(bf => bf.toString())
    .then(sh => console.dir(require('bash-parser')(sh), { depth: 42 }));
} else if ("-stp" === process.argv[2]) {
  fs.readFile(path.join(__dirname, "..", process.argv[3]))
    .then(bf => bf.toString())
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
