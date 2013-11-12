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
  var childProcess, master, manifests, hostname, root;

  suite('first time', function() {
    suiteSetup(function(done) {
      master = 'http://registry.npmjs.org';
      manifests = [
        path.resolve(__dirname, '../fixtures', 'gaia.json'),
        path.resolve(__dirname, '../fixtures', 'npm-mirror.json')
      ];
      hostname = 'http://npm-mirror.pub.build.mozilla.org';
      root = path.resolve(__dirname, '../..', 'tmp');

      var binary = path.resolve(__dirname, '../../bin/npm-mirror');
      var cmd = [
        binary,
        '--master', master,
        '--manifests', manifests.join(','),
        '--hostname', hostname,
        '--root', root
      ].join(' ');

      console.log(cmd);
      childProcess = exec(cmd);
      childProcess.once('exit', function() {
        done()
      });
    });

    suiteTeardown(function(done) {
      childProcess = exec('rm -rf ' + root);
      childProcess.once('exit', function() {
        done();
      });
    });

    test('should make sure root exists', function(done) {
      var rootPath = path.resolve(__dirname, '../..', root);
      waitFor(function() {
        return fs.existsSync(rootPath);
      }, done);
    });

    test('should sync all gaia devDependencies', function(done) {
      assertAllSynced(manifests[0], ['devDependencies'], root, done);
    });

    test('should sync all npm-mirror dependencies', function(done) {
      assertAllSynced(manifests[1], ['dependencies'], root, done);
    });

    test('should sync all npm-mirror devDependencies', function(done) {
      assertAllSynced(manifests[1], ['devDependencies'], root, done);
    });
  });

  suite('second time', function() {
    // TODO(gaye)
  });
});
