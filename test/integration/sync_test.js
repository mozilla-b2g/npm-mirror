var Package = require('../../lib/package'),
    exec = require('child_process').exec,
    fs = require('graceful-fs'),
    path = require('path');


/**
 * Make sure that the package is synced at some loose version.
 *
 * @param {string} package name of package.
 * @param {string} loose package version (loose).
 * @param {string} root path to packages.
 * @param {Function} done invoke when done.
 */
function assertSynced(package, loose, root, done) {
  function onVersion(e, version) {
    if (e) {
      return done && done(e);
    }

    var packageVersionPath = path.resolve(root, package, version);
    waitFor(function() {
      return fs.existsSync(packageVersionPath);
    }, done);
  }

  Package.version('http://registry.npmjs.org', package, loose, onVersion);
}


/**
 * Make sure that all of the manifest packages of a certain type are synced.
 *
 * @param {string} manifest package manifest.
 * @param {Array.<string>} types dependency types.
 * @param {string} root path to packages.
 * @param {Function} done invoke when done.
 */
function assertAllSynced(manifest, types, root, done) {
  var dependencies = Package.dependencies(require(manifest), types);
  var packages = Object.keys(dependencies);
  var count = packages.length;
  packages.forEach(function(package) {
    var versions = Object.keys(dependencies[package]);
    // There is one and only one version.
    var version = versions[0];
    assertSynced(package, version, root, function(e) {
      if (e) {
        return done(e);
      }

      if (--count === 0) {
        done();
      }
    });
  });
}


suite('sync', function() {
  var childProcess, master, manifest, hostname, root;

  suite('first time', function() {
    suiteSetup(function() {
      master = 'http://registry.npmjs.org';
      manifest = path.resolve(__dirname, '../..', 'package.json');
      hostname = 'http://npm-mirror.pub.build.mozilla.org';
      root = path.resolve(__dirname, '../..', 'tmp');

      var binary = path.resolve(__dirname, '../../bin/npm-mirror');
      var cmd = [
        binary,
        '--master', master,
        '--manifest', manifest,
        '--hostname', hostname,
        '--root', root
      ].join(' ');

      console.log(cmd);
      childProcess = exec(cmd);
    });

    suiteTeardown(function(done) {
      childProcess.once('exit', function() {
        childProcess = exec('rm -rf ' + root);
        childProcess.on('exit', function() {
          done();
        });
      });

      childProcess.kill();
    });

    test('should make sure root exists', function(done) {
      var rootPath = path.resolve(__dirname, '../..', root);
      waitFor(function() {
        return fs.existsSync(rootPath);
      }, done);
    });

    test('should sync all dependencies', function(done) {
      assertAllSynced(manifest, ['dependencies'], root, done);
    });

    test('should sync all devDependencies', function(done) {
      assertAllSynced(manifest, ['devDependencies'], root, done);
    });
  });

  suite('second time', function() {
    // TODO(gaye)
  });
});
