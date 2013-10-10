var debug = require('debug')('npm-mirror:SyncManager'),
    fs = require('fs'),
    http = require('http'),
    path = require('path'),
    resolveDeps = require('./resolvedeps'),
    url = require('url');


/**
 * @constructor
 *
 * @param {string} host new host that will serve mirrored packages.
 * @param {Array.<string>} packages collection of package names.
 * @param {string} registry npm registry to get packages from.
 * @param {string} packageDir path for mirrored packages.
 */
function SyncManager(host, packages, registry, packageDir) {
  this.host = host;
  this.packages = packages;
  this.registry = registry;
  this.packageDir = packageDir;
}
module.exports = SyncManager;

/**
 * Download http response to memory.
 *
 * @param {string} url to fetch.
 * @param {Function} callback invoke when done.
 */
SyncManager.download = function(url, callback) {
  http.get(url, function(res) {
    if (res.statusCode !== 200) {
      return callback && callback(
        new Error('Bad status ' + res.statusCode + ' for ' + url));
    }

    res.setEncoding('utf-8');
    var result = '';
    res.on('data', function(data) {
      result += data;
    });
    res.on('end', function() {
      return callback && callback(null, result);
    });
  }).on('error', function(e) {
    return callback && callback(e);
  });
};

/**
 * Download http response and save to disk.
 *
 * @param {string} url to fetch.
 * @param {string} loc where to write the tarball.
 * @param {Function} callback invoke when done.
 */
SyncManager.downloadToDisk = function(url, loc, callback) {
  var stream = fs.createWriteStream(loc);
  http.get(url, function(res) {
    if (res.statusCode !== 200) {
      return callback && callback(
        new Error('Bad status ' + res.statusCode + ' for ' + url));
    }

    res.pipe(stream);
    stream.on('finish', callback);
  });
};

/**
 * Make the directory if it doesn't exist.
 *
 * @param {string} path to directory.
 * @param {Function} callback invoke when done.
 */
SyncManager.maybeMkdir = function(path, callback) {
  fs.exists(path, function(exists) {
    if (exists) {
      return callback && callback();
    }

    fs.mkdir(path, callback);
  });
};

SyncManager.prototype = {
  /**
   * @type {string}
   */
  host: null,

  /**
   * @type {Array.<string>}
   */
  packages: null,

  /**
   * @type {string}
   */
  registry: null,

  /**
   * @type {string}
   */
  packageDir: null,

  /**
   * Collection of packages we're syncing during this run.
   * @type {Object}
   */
  syncing: null,

  /**
   * Sync the packages we're watching from the master registry.
   *
   * @param {Function} callback invoke when done.
   */
  sync: function(callback) {
    debug('sync');

    this.syncing = {};

    // Sync each package.
    var count = this.packages.length;
    this.packages.forEach(function(packageName) {
      this.syncPackage(packageName, function(e) {
        if (e) {
          return callback && callback(e);
        }

        if (--count !== 0) {
          return;
        }

        return callback && callback();
      });
    }.bind(this));
  },

  /**
   * Sync the named package.
   *
   * @param {string} packageName name of package to sync.
   * @param {Function} callback invoke when done.
   */
  syncPackage: function(packageName, callback) {
    debug('sync ' + packageName);

    this.syncing[packageName] = true;
    var packagePath = path.resolve(this.packageDir, packageName);
    SyncManager.maybeMkdir(packagePath, function(e) {
      if (e) {
        return callback && callback(e);
      }

      // Download package root object.
      var packageRootUrl = url.resolve(this.registry, packageName);
      SyncManager.download(packageRootUrl, function(e, packageRootData) {
        if (e) {
          return callback && callback(e);
        }

        var packageRoot = JSON.parse(packageRootData);
        var versions = Object.keys(packageRoot.versions);
        this.syncPackageVersions(packageName, versions, function() {
          this.savePackageRoot(packageName, versions, callback);
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },

  /**
   * Helper to sync package versions.
   *
   * @param {string} packageName name of package to sync.
   * @param {Array.<string>} versions available package versions.
   * @param {Function} callback invoke when done.
   */
  syncPackageVersions: function(packageName, versions, callback) {
    var count = versions.length;
    versions.forEach(function(version) {
      this.syncPackageVersion(packageName, version, function(e) {
        if (e) {
          return callback && callback(e);
        }

        if (--count !== 0) {
          return;
        }

        callback();
      }.bind(this));
    }.bind(this));
  },

  /**
   * Write the package root object to disk.
   *
   * @param {string} packageName name of the package.
   * @param {Array.<string>} versions available package versions.
   * @param {Function} callback invoke when done.
   */
  savePackageRoot: function(packageName, versions, callback) {
    var packageRoot = {};
    packageRoot.name = packageName;
    packageRoot._id = packageName;
    packageRoot.versions = {};
    versions.forEach(function(version) {
      packageRoot.versions[version] = this.getTarballUrl(packageName, version);
    }.bind(this));
    var sorted = versions.sort();
    packageRoot['dist-tags'] = {};
    packageRoot['dist-tags'].latest = sorted[sorted.length - 1];

    var filename = path.resolve(this.packageDir, packageName, 'index.json');
    fs.writeFile(filename, JSON.stringify(packageRoot), callback);
  },

  /**
   * Sync package at the specified version.
   *
   * @param {string} packageName name of package to sync.
   * @param {string} version package version.
   * @param {Function} callback invoke when done.
   */
  syncPackageVersion: function(packageName, version, callback) {
    debug('sync ' + packageName + '@' + version);

    var packageVersionPath =
      path.resolve(this.packageDir, packageName, version);
    SyncManager.maybeMkdir(packageVersionPath, function(e) {
      if (e) {
        return callback && callback(e);
      }

      // Download package version object.
      var packageVersionUrl =
        url.resolve(this.registry, packageName + '/' + version);
      SyncManager.download(packageVersionUrl, function(e, packageVersionData) {
        if (e) {
          return callback && callback(e);
        }

        var packageVersion = JSON.parse(packageVersionData);
        this.syncPackageDeps(packageName, version, packageVersion, function() {
          this.savePackageVersion(
            packageName, version, packageVersion, function() {
            // Lookup where to download package at version.
            var tarball = packageVersion.dist.tarball;
            var tarballPath = path.resolve(
              this.packageDir, packageName, version,
              packageName + '-' + version + '.tgz');

            fs.exists(tarballPath, function(exists) {
              if (exists) {
                return callback && callback();
              }

              SyncManager.downloadToDisk(tarball, tarballPath, callback);
            });
          }.bind(this));
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },

  /**
   * Helper to sync package dependencies.
   *
   * @param {string} packageName name of package to sync.
   * @param {string} version package version.
   * @param {Object} packageVersion package version object.
   * @param {Function} callback invoke when done.
   */
  syncPackageDeps: function(packageName, version, packageVersion, callback) {
    var depToVersions = resolveDeps(packageVersion);
    var dependencies = Object.keys(depToVersions);
    var count = dependencies.length;
    if (count === 0) {
      return callback && callback();
    }

    dependencies.forEach(function(dependencyName) {
      function onDependency() {
        if (-- count !== 0) {
          return;
        }

        return callback && callback();
      }

      if (this.syncing[dependencyName]) {
        return onDependency();
      }

      this.syncPackage(dependencyName, function(e) {
        if (e) {
          return callback && callback(e);
        }

        return onDependency();
      });
    }.bind(this));
  },

  /**
   * Write the package version object to disk.
   *
   * @param {string} packageName name of the package.
   * @param {string} version package version.
   * @param {Object} packageVersion package version object.
   * @param {Function} callback invoke when done.
   */
  savePackageVersion: function(packageName, version, packageVersion, callback) {
    var copy = {};
    copy.name = packageName;
    copy.version = version;
    copy.dependencies = packageVersion.dependencies;
    copy.devDependencies = packageVersion.devDependencies;
    copy.peerDependencies = packageVersion.peerDependencies;
    copy.dist = {
      tarball: this.getTarballUrl(packageName, version)
    };

    var filename =
      path.resolve(this.packageDir, packageName, version, 'index.json');
    fs.writeFile(filename, JSON.stringify(copy), callback);
  },

  /**
   * Map a package name and version to a url for our mirror.
   *
   * @param {string} packageName name of the package.
   * @param {string} version package version.
   * @return {string} url for tarball.
   */
  getTarballUrl: function(packageName, version) {
    var tarball = packageName + '-' + version + '.tgz';
    return url.resolve(this.host, [packageName, version, tarball].join('/'));
  }
};
