/**
 * @fileoverview An integration test that does the following:
 *     1. Sync packages from http://registry.npmjs.org for our manifest.
 *     2. Start a webserver to serve the packages.
 *     3. Run `npm install` from our repo and check that everything is ok.
 */
var Package = require(__dirname + '/../../lib/package'),
    async = require('async'),
    debug = require('debug')('InstallTest'),
    exec = require('child_process').exec,
    path = require('path'),
    temp = require('temp');


/**
 * @type {string}
 */
var TEST_MASTER = 'http://registry.npmjs.org';


/**
 * @type {number}
 */
var TEST_PORT = 8080;


/**
 * @type {string}
 */
var TEST_HOST = 'http://localhost:' + TEST_PORT;


/**
 * @type {string}
 */
var SEMVER_REGEXP =
  '(0|[1-9]\\d*)' + // major
  '\\.(0|[1-9]\\d*)' + // minor
  '\\.(0|[1-9]\\d*)' + // patch
  '(?:-' + // start prerelease
    '(' + // capture
      '(?:' + // first identifier
        '0|' + // 0, or
        '[1-9]\\d*|' + // numeric identifier, or
        '\\d*[a-zA-Z-][a-zA-Z0-9-]*' + // id with at least one non-number
      ')' + // end first identifier
      '(?:\\.' + // dot-separated
        '(?:0|[1-9]\\d*|\\d*[a-zA-Z-][a-zA-Z0-9-]*)' + // identifier
      ')*' + // zero or more of those
    ')' + // end prerelease capture
  ')?' + // prerelease is optional
  '(?:' + // build tag (non-capturing)
    '\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*' + // pretty much anything goes
  ')?'; // build tag is optional


suite('npm install', function() {
  var binary, server, manifest, root, err, stdout, stderr;

  /**
   * Run npm-mirror.
   */
  function runNpmMirror(done) {
    var binary = path.resolve(__dirname, '../../bin/npm-mirror');
    var cmd = [
      binary,
      '--master', TEST_MASTER,
      '--manifests', manifest,
      '--hostname', TEST_HOST,
      '--root', root
    ].join(' ');

    debug(cmd);
    exec(cmd, function(err) {
      done(err);
    });
  }

  /**
   * Bring up npm server.
   */
  function startNpmServer(done) {
    var binary = path.resolve(__dirname, '../../bin/npm-server');
    var cmd = [
      binary,
      '--port',
      TEST_PORT,
      '--root',
      root
    ].join(' ');

    debug(cmd);
    server = exec(cmd);

    done();
  }

  /**
   * `pkill --signal 9 npm-server`
   */
  function stopNpmServer(done) {
    var cmd = 'fuser -k -n tcp 8080';
    debug(cmd);
    exec(cmd, function(err) {
      done(err);
    });
  }

  /**
   * Run `npm install` against our registry.
   */
  function runNpmInstall(done) {
    var dir = path.resolve(__dirname, '..', 'fixtures');
    var cmd = [
      'cd', dir, '&&',
      'npm', 'install', '--registry', TEST_HOST
    ].join(' ');

    debug(cmd);
    exec(cmd, function(_err, _stdout, _stderr) {
      err = _err;
      stdout = _stdout;
      stderr = _stderr;
      done(err);
    });
  }

  /**
   * Delete installed packages.
   */
  function deletePackages(done) {
    var modules = path.resolve(__dirname, '..', 'fixtures', 'node_modules');
    var cmd = [
      'rm',
      '-rf',
      modules
    ].join(' ');

    debug(cmd);
    exec(cmd, function(err) {
      done(err);
    });
  }

  suiteSetup(function(done) {
    temp.track();
    binary = path.resolve(__dirname, '../..', 'bin', 'npm-mirror');
    manifest = path.resolve(__dirname, '..', 'fixtures', 'package.json');
    root = temp.mkdirSync('temp');

    async.series([
      runNpmMirror,
      startNpmServer,
      runNpmInstall
    ], function() {
      done();
    });
  });

  // Remove the installed packages.
  suiteTeardown(function(done) {
    async.series([
      stopNpmServer,
      deletePackages
    ], function() {
      done();
    });
  });


  test('should not error', function() {
    assert.strictEqual(err, null);
  });

  test('should list the dependencies to console.log', function() {
    var dependencies = Object.keys(Package.dependencies(require(manifest)));
    dependencies.forEach(function(dep) {
      var format = dep + '@' + SEMVER_REGEXP + ' node_modules/' + dep;
      var regex = new RegExp(format, 'g');
      assert.ok(regex.test(stdout));
    });
  });
});
