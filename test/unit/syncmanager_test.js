/*global path, url*/
var mockfs = require('../mock/fs'),
    proxyquire = require('proxyquire');
var SyncManager = proxyquire('../../lib/syncmanager', {
  'fs': mockfs.fs
});


suite('SyncManager', function() {
  var subject, host, packages, registry, packageDir;

  setup(function() {
    host = 'http://localhost';
    packages = ['a', 'b'];
    registry = 'https://registry.npmjs.org';
    packageDir = 'tmp';
    subject = new SyncManager(host, packages, registry, packageDir);
  });

  suite('#sync', function() {
    var syncPackage;

    setup(function(done) {
      syncPackage = sinon.stub(subject, 'syncPackage');
      syncPackage.callsArgAsync(1);
      subject.sync(done);
    });

    teardown(function() {
      subject.syncPackage.restore();
    });

    test('should issue a sync for every package', function() {
      assert.calledWith(syncPackage, 'a');
      assert.calledWith(syncPackage, 'b');
    });

    test('should reset syncing', function() {
      assert.deepEqual(subject.syncing, {});
    });
  });

  suite('#syncPackage', function() {
    var maybeMkdir, download, syncPackageVersions, savePackageRoot;
    var packageName = 'a';
    var versions = ['0.0.1', '1.0.0'];
    var packageRootData = JSON.stringify({
      versions: {
        '0.0.1': {},
        '1.0.0': {}
      }
    });

    setup(function(done) {
      subject.syncing = {};
      maybeMkdir = sinon.stub(SyncManager, 'maybeMkdir');
      maybeMkdir.callsArgAsync(1);
      download = sinon.stub(SyncManager, 'download');
      download.callsArgWithAsync(1, null, packageRootData);
      syncPackageVersions = sinon.stub(subject, 'syncPackageVersions');
      syncPackageVersions.callsArgAsync(2);
      savePackageRoot = sinon.stub(subject, 'savePackageRoot');
      savePackageRoot.callsArgAsync(2);

      subject.syncPackage(packageName, done);
    });

    teardown(function() {
      SyncManager.maybeMkdir.restore();
      SyncManager.download.restore();
      subject.syncPackageVersions.restore();
      subject.savePackageRoot.restore();
    });

    test('should mark the package as syncing', function() {
      assert.strictEqual(subject.syncing[packageName], true);
    });

    test('should maybe mkdir for package', function() {
      var dir = path.resolve(subject.packageDir, packageName);
      assert.calledWith(maybeMkdir, dir);
    });

    test('should download package root object', function() {
      var packageRootUrl = url.resolve(subject.registry, packageName);
      assert.calledWith(download, packageRootUrl);
    });

    test('should sync package versions', function() {
      assert.calledWith(syncPackageVersions, packageName, versions);
    });

    test('should save package root object', function() {
      assert.calledWith(savePackageRoot, packageName, versions);
    });
  });

  suite('#syncPackageVersions', function() {
    var syncPackageVersion;
    var packageName = 'a';
    var versions = ['0.0.1', '1.0.0'];

    setup(function(done) {
      syncPackageVersion = sinon.stub(subject, 'syncPackageVersion');
      syncPackageVersion.callsArgAsync(2);
      subject.syncPackageVersions(packageName, versions, done);
    });

    test('should issue package version sync for each version', function() {
      assert.calledWith(syncPackageVersion, packageName, '0.0.1');
      assert.calledWith(syncPackageVersion, packageName, '1.0.0');
    });
  });

  suite('#savePackageRoot', function() {
    var writeFile;
    var packageName = 'a';
    var versions = ['0.0.1', '1.0.0'];

    setup(function(done) {
      writeFile = sinon.stub(mockfs.fs, 'writeFile');
      writeFile.callsArgAsync(2);
      subject.savePackageRoot(packageName, versions, done);
    });

    teardown(function() {
      mockfs.fs.writeFile.restore();
    });

    test('should write package root object', function() {
      var filename =
        path.resolve(subject.packageDir, packageName, 'index.json');
      var packageRootData = JSON.stringify({
        name: packageName,
        _id: packageName,
        versions: {
          '0.0.1': 'http://localhost/a/0.0.1/a-0.0.1.tgz',
          '1.0.0': 'http://localhost/a/1.0.0/a-1.0.0.tgz'
        },
        'dist-tags': {
          latest: '1.0.0'
        }
      });

      assert.calledWith(writeFile, filename, packageRootData);
    });
  });

  suite('#syncPackageVersion', function() {
    var maybeMkdir, download, syncPackageDeps, savePackageVersion,
        downloadToDisk;
    var packageName = 'a';
    var version = '1.0.0';
    var packageVersion = {
      name: 'a',
      version: '1.0.0',
      dependencies: {
        'b': '2.0.0'
      },
      dist: {
        tarball: ''
      }
    };
    var packageVersionData = JSON.stringify(packageVersion);

    setup(function(done) {
      maybeMkdir = sinon.stub(SyncManager, 'maybeMkdir');
      maybeMkdir.callsArgAsync(1);

      download = sinon.stub(SyncManager, 'download');
      download.callsArgWithAsync(1, null, packageVersionData);

      syncPackageDeps = sinon.stub(subject, 'syncPackageDeps');
      syncPackageDeps.callsArgAsync(3);

      savePackageVersion = sinon.stub(subject, 'savePackageVersion');
      savePackageVersion.callsArgAsync(3);

      downloadToDisk = sinon.stub(SyncManager, 'downloadToDisk');
      downloadToDisk.callsArgAsync(3);

      subject.syncPackageVersion(packageName, version, done);
    });

    teardown(function() {
      SyncManager.maybeMkdir.restore();
      SyncManager.download.restore();
      subject.syncPackageDeps.restore();
      subject.savePackageVersion.restore();
      SyncManager.downloadToDisk.restore();
    });

    test('should maybe mkdir for package version', function() {
      var dir = path.resolve(subject.packageDir, packageName, version);
      assert.calledWith(maybeMkdir, dir);
    });

    test('should download package version object', function() {
      var packageVersionUrl =
        url.resolve(subject.registry, packageName + '/' + version);
      assert.calledWith(download, packageVersionUrl);
    });

    test('should sync package version deps', function() {
      assert.calledWith(syncPackageDeps, 'a', '1.0.0', packageVersion);
    });

    test.skip('should not download tarball if we have it', function() {

    });

    test.skip('should download tarball if we lack it', function() {
    });
  });

  suite('#syncPackageDeps', function() {
    var syncPackage;
    var packageName = 'a';
    var version = '1.0.0';
    var packageVersion = {
      name: 'a',
      version: '1.0.0',
      dependencies: {
        'b': '2.0.0',
        'c': '3.0.0'
      }
    };

    setup(function(done) {
      syncPackage = sinon.stub(subject, 'syncPackage');
      syncPackage.callsArgAsync(1);
      subject.syncing = { 'c': true };
      subject.syncPackageDeps(packageName, version, packageVersion, done);
    });

    teardown(function() {
      subject.syncPackage.restore();
    });

    test('should issue package sync for each dep not syncing', function() {
      assert.calledWith(syncPackage, 'b');
    });

    test('should not issue package sync for any syncing dep', function() {
      assert.strictEqual(syncPackage.calledWith('c'), false);
    });
  });

  suite('#savePackageVersion', function() {
    var writeFile;
    var packageName = 'a';
    var version = '1.0.0';
    var dependencies = {
      'b': '2.0.0',
      'c': '3.0.0'
    };
    var devDependencies = {
      'd': '4.0.0'
    };

    setup(function(done) {
      writeFile = sinon.stub(mockfs.fs, 'writeFile');
      writeFile.callsArgAsync(2);
      subject.savePackageVersion(
        packageName, version, {
          dependencies: dependencies,
          devDependencies: devDependencies
        }, done);
    });

    teardown(function() {
      mockfs.fs.writeFile.restore();
    });

    test('should write package version object', function() {
      var filename =
        path.resolve(subject.packageDir, packageName, version, 'index.json');
      var packageVersionData = JSON.stringify({
        name: packageName,
        version: version,
        dependencies: dependencies,
        devDependencies: devDependencies,
        dist: {
          tarball: 'http://localhost/a/1.0.0/a-1.0.0.tgz'
        }
      });

      assert.calledWith(writeFile, filename, packageVersionData);
    });
  });

  suite('#getTarballUrl', function() {
    test('should build the url', function() {
      assert.strictEqual(
        subject.getTarballUrl('a', '0.0.1'),
        'http://localhost/a/0.0.1/a-0.0.1.tgz');
    });
  });
});
