#!/usr/bin/env node
const shtopw = require('..');

const fs = require('fs/promises');
const readdir = require('fs').readdirSync;
const path = require('path');
const EOL = require('os').EOL;
const cp = require('child_process');

process.chdir(__dirname);
const base = path.relative(__dirname, path.join("..", "tests"));
process.chdir(base);

var theCwd = path.resolve(base, "playground");
var theEnv = {};
var theOpts = {};

/**
 * @typedef {Object} Result
 * @property {number} code
 * @property {string} stdout
 * @property {string} stderr
 * 
 * @returns {Result}
 */
function runWith(shell, args, env) {
  return new Promise((resolve, reject) => {
    try {
      const sp = cp.spawn(
        shell, args,
        {
          cwd: theCwd,
          env: Object.assign(Object.create(theEnv), env),
        }
      );

      let stdout = "";
      let stderr = "";
      sp.stdout.on('data', data => stdout+= data);
      sp.stderr.on('data', data => stderr+= data);

      sp.on('close', code => resolve({
        code: code,
        stdout: stdout.replace(/\r?\n/g, EOL),
        stderr: stderr.replace(/\r?\n/g, EOL),
      }));
    } catch (err) {
      reject(err);
    }
  });
}

if (!globalThis.describe) globalThis.describe = (_, cb) => cb();
if (!globalThis.test) globalThis.test = async (_, cb) => await cb();
if (!globalThis.expect) globalThis.expect = new Proxy(o => {console.dir(o);return globalThis.expect}, { get: (_,p) => {console.log(p);return globalThis.expect} });

readdir("snippets")
  .map(folder => {
    describe(folder, () => {
      readdir(path.join("snippets", folder))
        .filter(it => it.endsWith(".sh"))
        .map(file => {
          test(file.replace(".sh", ""), async () => {
            const ps1 = path.win32.join("snippets", folder, file.replace(".sh", ".ps1"));
            const sh = path.posix.join("snippets", folder, file);

            const src = (await fs.readFile(sh)).toString();
            const json = src.split("\n", 2)[1].trim().slice(2);
            const opts = Object.assign(Object.create(theOpts), JSON.parse(json));

            const res = shtopw(src, opts);
            await fs.writeFile(ps1, res);

            const received = runWith("pwsh", ["-nop", "-f", path.win32.join("..", ps1)], opts.env);
            const expected = runWith("sh", [path.posix.join("..", sh), "--noprofile", "--norc"], opts.env);
            expect(received).toEqual(expected);
          });
        });
    });
  });
