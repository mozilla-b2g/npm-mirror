var Download = require('./download'),
    Package = require('./package'),
    UrlCheck = require('./urlcheck'),
    debug = require('debug')('npm-mirror:SyncManager'),
    async = require('async'),
    fs = require('graceful-fs'),
    maybeMkdir = require('./maybemkdir'),
    ncp = require('ncp'),
    path = require('path'),
    semver = require('semver'),
    sha = require('sha'),
    url = require('url');


/**
 * @constructor
 *
 * @param {string} master npm registry to get packages from.
 * @param {Object} packageToVersions map from package name to object with
 *     key list of versions we need for the package.
 * @param {string} hostname new host that will serve mirrored packages.
 * @param {string} root path for mirrored packages.
 */
function SyncManager(master, packageToVersions, hostname, root) {
  this.master = master;
  this.packageToVersions = packageToVersions;
  this.hostname = hostname;
  this.root = root;
}
module.exports = SyncManager;


SyncManager.prototype = {
  /**
   * @type {string}
   */
  master: null,

  /**
   * @type {Object}
   */
  packageToVersions: null,

  /**
   * @type {string}
   */
  hostname: null,

  /**
   * @type {string}
   */
  root: null,

  /**
   * @type {string}
   */
  tempdir: null,

  /**
   * Sync the packages we're watching from the master registry.
   *
   * @param {Function} callback invoke when done.
   */
  sync: function(callback) {
    async.waterfall([
      // 1. Resolve loose package versions.
      function(done) {
        var master = this.master;
        var packageToVersions = this.packageToVersions;
        Package.versions(master, packageToVersions, function(err, result) {
          this.packageToVersions = result;
          done(err, result);
        }.bind(this));
      }.bind(this),

      // 2. Dependency search.
      this.dependencySearch.bind(this),

      // 3. Make sure we have package and package version dirs.
      this.makedirs.bind(this),

      // 4. Download the world.
      this.download.bind(this),

      // 5. Commit the downloads to our package repository.
      this.commit.bind(this)
    ], callback);
  },

  /**
   * Check each package version we're syncing for the master's
   * package version object. Add any new package version dependencies
   * to the in-memory map we're building. Then recursively perform the
   * procedure for all new package version dependencies.
   *
   * @param {Object} packageToVersions map from package name to object with key
   *     list of versions we need for the package.
   * @param {Function} callback invoke when done.
   */
  dependencySearch: function(packageToVersions, callback) {
    var count = Package.versionCount(packageToVersions);

    // Base case.
    if (count === 0) {
      return callback && callback();
    }

    // For each package version, check master package version object.
    // Issue a recursive dependencySearch with all of the "new" deps we find.
    var packages = Object.keys(packageToVersions);
    async.parallel(
      packages
        .map(function(package) {
          var versions = Object.keys(packageToVersions[package]);
          return versions.map(function(version) {
            return this.packageVersionSearch.bind(this, package, version);
          }.bind(this));
        }.bind(this))
        .reduce(function(prev, curr) {
          return prev.concat(curr);
        }),
      function(err) {
        return callback && callback(err);
      }
    );
  },

  packageVersionSearch: function(package, version, callback) {
    // Careful! The version could still be a git/tarball url...
    // Or version could be null if semver couldn't find a match.
    if (!version || version === 'null' || UrlCheck.isWebUrl(version) ||
        UrlCheck.isGitUrl(version)) {
      // TODO(gaye): Eh? What to do?
      delete this.packageToVersions[package][version];
      return callback();
    }

    async.waterfall([
      // GET package version url.
      function(done) {
        var packageVersionUrl = Package.url(this.master, package, version);
        Download.inst.download(packageVersionUrl, done);
      }.bind(this),

      // Parse package version data.
      function(packageVersionData, done) {
        var packageVersion = JSON.parse(packageVersionData);
        var deps = Package.dependencies(
          packageVersion, ['dependencies', 'peerDependencies'] /* types */);
        Package.versions(this.master, deps, function(err, depToVersions) {
          done(err, packageVersion, depToVersions);
        });
      }.bind(this),

      // Issue dependency search for all "new" versions.
      function(packageVersion, depToVersions, done) {
        var newdeps = this.addDependencies(packageVersion.name, depToVersions);
        this.dependencySearch(newdeps, done);
      }.bind(this)
    ], callback);
  },

  /**
   * Add dependencies to our in-memory map from packages to versions.
   *
   * @param {string} parent package that needs these dependencies.
   * @param {Object} depToVersions map from package name to object with key list
   *     of versions we need for the dep package.
   * @return {Object} new deps.
   */
  addDependencies: function(parent, depToVersions) {
    var newdeps = {};
    var packages = Object.keys(depToVersions);
    packages.forEach(function(package) {
      var currVersions = this.packageToVersions[package];
      var depVersions = depToVersions[package];
      newdeps[package] = {};

      // Check if we are watching this package.
      if (!currVersions) {
        // Add all of the versions.
        debug(parent + ' needs ' + package + '@' +
              Object.keys(depVersions).join(', '));
        this.packageToVersions[package] = depVersions;
        newdeps[package] = depVersions;
        return;
      }

      // Check which versions we are watching.
      var versions = Object.keys(depVersions);
      versions
        .filter(function(version) {
          return !(version in currVersions);
        })
        .forEach(function(version) {
          // Add this version.
          debug(parent + ' needs ' + package + '@' + version);
          this.packageToVersions[package][version] = true;
          newdeps[package][version] = true;
        }.bind(this));
    }.bind(this));

    return newdeps;
  },

  /**
   * Make directories for all of the packages and package versions.
   *
   * @param {Function} callback [err] invoke when done.
   */
  makedirs: function(callback) {
    async.waterfall([
      // Make root directory.
      maybeMkdir.bind(null, this.root),

      // Make tmp directory.
      function(done) {
        this.tempdir = path.join(this.root, '.tmp');
        maybeMkdir(this.tempdir, { purge: true }, done);
      }.bind(this),

      // Make directories for each package, package version.
      function(done) {
        var dirs = [];
        for (var package in this.packageToVersions) {
          dirs.push(path.resolve(this.tempdir, package));
          var versions = this.packageToVersions[package];
          for (var version in versions) {
            dirs.push(path.resolve(this.tempdir, package, version));
          }
        }

        async.parallel(dirs.map(function(dir) {
          return maybeMkdir.bind(null, dir);
        }), function(err) {
          return done && done(err);
        });
      }.bind(this)
    ], callback);
  },

  /**
   * Download all the package root objects, package version objects,
   * and tarballs.
   *
   * @param {Function} callback invoke when done.
   */
  download: function(callback) {
    async.series([
      this.downloadPackageRootObjects.bind(this),
      this.downloadPackageVersions.bind(this)
    ], function(err) {
      return callback && callback(err);
    });
  },

  /**
   * Download a package root object for each package.
   *
   * @param {Function} callback invoke when done.
   */
  downloadPackageRootObjects: function(callback) {
    var packages = Object.keys(this.packageToVersions);
    async.parallel(packages.map(function(package) {
      var packageRootUrl = url.resolve(this.master, package);
      return this.downloadPackageRootObject.bind(this, package, packageRootUrl);
    }.bind(this)), function(err) {
      return callback && callback(err);
    });
  },

  downloadPackageRootObject: function(package, packageRootUrl, callback) {
    // TODO(gaye): Use etags here so that we don't download again
    //     if, for instance, no new packages have been published.
    async.waterfall([
      // Download the package root url.
      Download.inst.download.bind(Download.inst, packageRootUrl),

      // Copy it to our mirror.
      function(packageRootData, done) {
        var packageRoot = JSON.parse(packageRootData);
        var copy = {
          name: packageRoot.name,
          _id: packageRoot.name,
          versions: {}
        };
        var versions = Object.keys(this.packageToVersions[package]);
        versions.forEach(function(version) {
          var packageRootVersion = packageRoot.versions[version];
          var copyVersion = {
            name: packageRoot.name,
            version: version,
            dependencies: packageRootVersion.dependencies || {},
            devDependencies: packageRootVersion.devDependencies || {},
            peerDependencies: packageRootVersion.peerDependencies || {}
          };
          if ('dist' in packageRootVersion) {
            copyVersion.dist = {
              shasum: packageRootVersion.dist.shasum,
              tarball: Package.tarballUrl(this.hostname, package, version)
            };
          }
          copy.versions[version] = copyVersion;
        }.bind(this));

        var sorted = versions.sort(semver.compare);
        var latestVersion = sorted[sorted.length - 1];
        copy['dist-tags'] = { latest: latestVersion };

        var latest = packageRoot.versions[latestVersion];
        if (latest && 'dist' in latest) {
          copy.dist = {
            shasum: latest.dist.shasum,
            tarball: Package.tarballUrl(this.hostname, package, latestVersion)
          };
        }

        var dest = path.resolve(this.tempdir, package, 'index.json');
        fs.writeFile(dest, JSON.stringify(copy), done);
      }.bind(this)
    ], function(err) {
      return callback && callback(err);
    });
  },

  /**
   * Download a package version object and tarball for each package version.
   *
   * @param {Function} callback invoke when done.
   */
  downloadPackageVersions: function(callback) {
    var packageToVersions = this.packageToVersions;
    var count = Package.versionCount(packageToVersions);
    if (count === 0) {
      return callback && callback();
    }

    var packages = Object.keys(packageToVersions);
    async.parallel(
      packages
        .map(function(package) {
          var versions = Object.keys(packageToVersions[package]);
          return versions.map(function(version) {
            return this.downloadPackageVersion.bind(this, package, version);
          }.bind(this));
        }.bind(this))
        .reduce(function(prev, curr) {
          return prev.concat(curr);
        }),
      function(err) {
        return callback && callback(err);
      }
    );
  },

  downloadPackageVersion: function(package, version, callback) {
    async.waterfall([
      // Check whether path exists.
      function(done) {
        var dest = path.resolve(this.tempdir, package, version, 'index.json');
        fs.exists(dest, done.bind(this, null));
      }.bind(this),

      // Bail if path exists.
      function(exists, done) {
        if (exists) {
          return callback && callback();
        }

        done();
      },

      // GET package version url.
      function(done) {
        var packageVersionUrl = Package.url(this.master, package, version);
        Download.inst.download(packageVersionUrl, done);
      }.bind(this),

      // Copy it to our mirror.
      function(packageVersionData, done) {
        var packageVersion = JSON.parse(packageVersionData);
        var copy = {
          name: packageVersion.name,
          version: packageVersion.version,
          dependencies: packageVersion.dependencies || {},
          devDependencies: packageVersion.devDependencies || {},
          peerDependencies: packageVersion.peerDependencies || {}
        };
        if ('dist' in packageVersion) {
          copy.dist = {
            shasum: packageVersion.dist.shasum,
            tarball: Package.tarballUrl(this.hostname, package, version)
          };
        }

        var dest = path.resolve(this.tempdir, package, version, 'index.json');
        fs.writeFile(dest, JSON.stringify(copy), function(err) {
          done(err, packageVersion);
        });
      }.bind(this),

      // Download tarball.
      function(packageVersion, done) {
        var tarball = packageVersion.dist.tarball;
        var dest = path.resolve(
          this.tempdir, package, version,
          package + '-' + version + '.tgz');
        Download.inst.downloadToDisk(tarball, dest, done);
      }.bind(this)
    ], function(err) {
      return callback && callback(err);
    });
  },

  /**
   * Check the shasums of all of the downloaded packages and then
   * copy the downloaded data to our server root if there are no issues.
   *
   * @param {Function} callback invoke when done.
   */
  commit: function(callback) {
    var packageToVersions = this.packageToVersions;
    var count = Package.versionCount(packageToVersions);
    if (count === 0) {
      return callback && callback();
    }

    // For each package version, check shasum and copy to server root.
    var packages = Object.keys(packageToVersions);
    async.parallel(
      packages
        .map(function(package) {
          var versions = Object.keys(packageToVersions[package]);
          return versions.map(function(version) {
            return this.verifyPackageVersion.bind(this, package, version);
          }.bind(this));
        }.bind(this))
        .reduce(function(prev, curr) {
          return prev.concat(curr);
        }),
      function(err) {
        if (err) {
          return callback && callback(err);
        }

        ncp(this.tempdir, this.root, callback);
      }.bind(this)
    );
  },

  verifyPackageVersion: function(package, version, callback) {
    var manifest = path.resolve(this.tempdir, package, version, 'index.json');
    var packageVersion = require(manifest);
    if (!('dist' in packageVersion)) {
      return callback(new Error(package + '@' + version + ': no dist'));
    }
    if (!('shasum' in packageVersion.dist)) {
      return callback(new Error(package + '@' + version + ': no shasum'));
    }

    var expected = packageVersion.dist.shasum;
    var tarball = path.resolve(
      this.tempdir, package, version, package + '-' + version + '.tgz');
    sha.check(tarball, expected, callback);
  },
};
