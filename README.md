npm-mirror
==========

[![Build Status](https://travis-ci.org/mozilla-b2g/npm-mirror.png?branch=master)](https://travis-ci.org/mozilla-b2g/npm-mirror)

A utility for mirroring a subset of npm packages from another npm registry.

## Getting Started

```
git clone git@github.com:mozilla-b2g/npm-mirror.git
npm install
bin/npm-mirror \
  --host http://localhost \
  --manifestFile package.json \
  --registry http://registry.npmjs.org \
  --packageDir packages/
// Start webserver rooted in packages directory
npm install --registry http://localhost
```

## Test Suite

`make test` runs the test suite. Unit tests live in `test/unit` and integration tests live in `test/integration`. In order for the integration tests to run successfully, you must be connected to the Internet since packages will be downloaded from http://registry.npmjs.org.
