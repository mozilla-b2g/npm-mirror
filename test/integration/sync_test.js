var Package = require('../../lib/package'),
    exec = require('child_process').exec,
    fs = require('graceful-fs'),
    path = require('path'),
    temp = require('temp');


/**
 * @type {string}
 */
var TEST_MASTER = 'http://registry.npmjs.org';


/**
 * Make sure that the package is synced at some loose version.
 *
 * @param {string} package name of package.
 * @param {string} loose package version (loose).
 * @param {string} root path to packages.
 * @param {Function} done invoke when done.
 */
function assertSynced(package, loose, root, done) {
  Package.version(TEST_MASTER, package, loose, function(e, version) {
    if (e) {
      return done && done(e);
    }

    var packageRoot = path.resolve(root, package);
    var packageObject = path.resolve(root, package, 'index.json');
    var versionRoot = path.resolve(root, package, version);
    var versionObject = path.resolve(root, package, version, 'index.json');
    var tarball =
      path.resolve(root, package, version, package + '-' + version + '.tgz');

    // Wait for all of the appropriate files to exist.
    waitFor(function() {
      return fs.existsSync(packageRoot) &&
             fs.existsSync(packageObject) &&
             fs.existsSync(versionRoot) &&
             fs.existsSync(versionObject) &&
             fs.existsSync(tarball);
    }, done);
  });
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
  var childProcess, manifests, hostname, root;

  suiteSetup(function(done) {
    temp.track();
    manifests = [
      path.resolve(__dirname, '../fixtures', 'gaia.json'),
      path.resolve(__dirname, '../fixtures', 'package.json')
    ];
    hostname = 'http://npm-mirror.pub.build.mozilla.org';
    root = temp.mkdirSync('temp');

    var binary = path.resolve(__dirname, '../../bin/npm-mirror');
    var cmd = [
      binary,
      '--master', TEST_MASTER,
      '--manifests', manifests.join(','),
      '--hostname', hostname,
      '--root', root
    ].join(' ');

    childProcess = exec(cmd);
    childProcess.once('exit', function() {
      done();
    });
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
