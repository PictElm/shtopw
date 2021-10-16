#!/usr/bin/env node
const shtopw = require('..');

const fs = require('fs/promises');
const path = require('path');

const folder = "command";
const file = "variable.sh";
const options = {};

console.clear();
console.log("\n".repeat(42));

fs.readFile(path.join(__dirname, "..", "tests", "snippets", folder, file))
  .then(bf => bf.toString())
  .then(sh => ["", sh, shtopw(sh, options)])
  .then(sh_pwsh => console.log(sh_pwsh.join("\n---------------------\n")));
