npm-mirror
==========

[![Build Status](https://travis-ci.org/mozilla-b2g/npm-mirror.png?branch=master)](https://travis-ci.org/mozilla-b2g/npm-mirror)

npm-mirror is a utility for mirroring a subset of npm packages from another npm registry. It syncs all of the dependencies for a particular node module and writes them to the local filesystem so that a simple webserver can behave like a commonjs compliant package registry.

## Notable Caveats

+ Your webserver must be configured to map root requests to index.json files.
+ Git repos will not be synced

## Getting Started

```
npm install -g npm-mirror

DEBUG=npm-mirror:SyncManager npm-mirror \
  --master http://registry.npmjs.org \
  --manifest /path/to/target/package.json \
  --hostname http://secret-npm-mirror.com \
  --root /where/we/put/packages/

// Start webserver rooted in packages directory
cd /path/to/target
npm install --registry http://secret-npm-mirror.com
```

### A Word About Arguments

#### master

a fully qualified url for the master registry's root

### manifest

a fully qualifed path to a manifest file (ie https://npmjs.org/doc/json.html)

#### hostname

a fully qualifed url at which the mirrored packages will be served

#### root

a fully qualifed path for where to put downloaded packages

## Test Suite

`make test` runs the test suite. Unit tests live in `test/unit` and integration tests live in `test/integration`. In order for the integration tests to run successfully, you must be connected to the Internet since packages will be downloaded from http://registry.npmjs.org.
