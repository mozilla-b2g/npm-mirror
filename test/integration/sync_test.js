/*global __dirname, path, fs, require, test, suite, suiteSetup, suiteTeardown,
         waitFor*/
var exec = require('child_process').exec;


suite('first time sync', function() {
  var childProcess, manifestFile, packageDir;

  suiteSetup(function() {
    manifestFile = path.resolve(__dirname, '../../package.json');
    packageDir = path.resolve(__dirname, '../../tmp');

    var binary = path.resolve(__dirname, '../../bin/npm-mirror');
    var args = [
      '--host', 'http://localhost',
      '--manifestFile', manifestFile,
      '--registry', 'http://registry.npmjs.org',
      '--packageDir', 'tmp'
    ];

    childProcess = exec(binary + ' ' + args.join(' '));
  });

  suiteTeardown(function() {
    exec('rm -rf ' + packageDir);
    childProcess.kill();
  });

  test('should make a package dir', function(done) {
    waitFor(function() {
      return fs.existsSync(packageDir);
    }, done);
  });

  suite('for each package', function() {
    var manifest, packages;

    suiteSetup(function() {
      manifest = require(manifestFile);
      packages = Object.keys(manifest.dependencies);
    });

    test('should make a subdirectory', function(done) {
      var count = packages.length;
      packages.forEach(function(packageName) {
        var packagePath = path.resolve(packageDir, packageName);
        waitFor(function() {
          return fs.existsSync(packagePath);
        }, function() {
          count -= 1;
          if (count === 0) {
            done();
          }
        });
      });
    });

    test('should write package root object', function(done) {
      var count = packages.length;
      packages.forEach(function(packageName) {
        var packageRoot = path.resolve(packageDir, packageName, 'index.json');
        waitFor(function() {
          return fs.existsSync(packageRoot);
        }, function() {
          count -= 1;
          if (count === 0) {
            done();
          }
        });
      });
    });

    suite('for each version', function() {
      test.skip('should make a subdirectory', function() {
      });

      test.skip('should write package version object', function() {
      });

      test.skip('should download tarball', function() {
      });
    });
  });
});
