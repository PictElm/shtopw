#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const parse = require('bash-parser');

function clean(sh) {
  return sh
    //.replace("\r", "")
    //.split("\n")
    //.map(it => it
    //  .trim()
    //)
    //.join("\n")
}

function getSnippets(dir) {
  return fs
    .readdir(dir)
    .then(ls => ls
      .map(fn => fs.readFile(path.join(dir, fn)))
    )
    .then(ps => Promise.all(ps)
      .then(ls => ls
        .flatMap(bf => {
          const st = clean(bf.toString());
          const ln = st.split("\n")[0]
          return ln.startsWith("#!/bin/sh") || ln.startsWith("#!/bin/bash")
            ? [st]
            : [];
        })
      )
    );
}

function getSnippet(dir, name) {
  return fs
    .readFile(path.join(dir, name))
    .then(bf => clean(bf.toString()));
}

/*getSnippets("snippets")
  .then(ls => ls
    .forEach(sh => {
      console.log(sh);
      console.log("---");
    })
  );*/

/*-*/
getSnippet("snippets", "lustre")
    .then(sh => {
      console.log(sh);
      console.log("\n===\n");
      console.dir(parse(sh), { depth: 42 });
    });
