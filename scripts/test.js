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
 * @returns {Promise<Result>}
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

function concat() {
  const r = [];
  for (const it of arguments)
    if (it && it.length)
      r.push.apply(r, it);
  return r;
}

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

            const received = await runWith("pwsh", concat(["-nop", "-f", path.win32.join("..", ps1)], opts.args), opts.env);
            const expected = await runWith("sh", concat([path.posix.join("..", sh)], opts.args, ["--noprofile", "--norc"]), opts.env);

            if (opts.ignore) for (const what of opts.ignore) received[what] = expected[what] = null;

            if (opts.hasPaths) {
              const extractAndRemovePath = (obj, key, pattern) => {
                const res = RegExp(pattern).exec(obj[key]);
                obj[key] = [
                  obj[key].slice(0, res.index),
                  res[0].replace(res[1], "(path)"),
                  obj[key].slice(res.index + res[0].length),
                ].join("");
                const absolute = path.resolve(theCwd, res[1]);
                const extension = path.extname(absolute);
                return !extension ? absolute : absolute.slice(0, -extension.length);
              };
              for (const pattern of opts.hasPaths) {
                const receivedPath = extractAndRemovePath(received, "stdout", pattern);
                const expectedPath = extractAndRemovePath(expected, "stdout", pattern);
                expect(receivedPath).toEqual(expectedPath);
              }
            }

            expect(received).toEqual(expected);
          });
        });
    });
  });
