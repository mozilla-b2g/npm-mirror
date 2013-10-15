var Download = require('./download'),
    Package = require('./package'),
    UrlCheck = require('./urlcheck'),
    debug = require('debug')('npm-mirror:SyncManager'),
    fs = require('graceful-fs'),
    maybeMkdir = require('./maybemkdir'),
    path = require('path'),
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
   * Sync the packages we're watching from the master registry.
   *
   * 1. Use semver to resolve all loose dependency declarations.
   * 2. Find all of our package version dependencies recursively.
   * 3. Make sure that we have directories for each package version.
   * 4. Download the world.
   *
   * @param {Function} callback invoke when done.
   */
  sync: function(callback) {
    debug('sync');

    // Step 1: Resolve loose package versions.
    Package.versions(
      this.master, this.packageToVersions, function(e, packageToVersions) {
      if (e) {
        return callback && callback(e);
      }

      this.packageToVersions = packageToVersions;

      // Step 2: Dependency search.
      debug('dependency search');
      this.dependencySearch(this.packageToVersions, function(e) {
        if (e) {
          return callback && callback(e);
        }

        // Step 3: Make sure we have package and package version dirs.
        this.makedirs(function(e) {
          if (e) {
            return callback && callback(e);
          }

          // Step 4: Download the world.
          this.download(callback);
        }.bind(this));
      }.bind(this));
    }.bind(this));
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
    packages.forEach(function(package) {
      var versions = Object.keys(packageToVersions[package]);
      versions.forEach(function(version) {
        function process() {
          if (--count <= 0) {
            return callback && callback();
          }
        }

        // Careful! The version could still be a git/tarball url...
        // Or version could be null if semver couldn't find a match.
        if (!version || version === 'null' || UrlCheck.isWebUrl(version) ||
            UrlCheck.isGitUrl(version)) {
          // TODO(gaye): Eh? What to do?
          delete this.packageToVersions[package][version];
          return process();
        }

        var packageVersionUrl = Package.url(this.master, package, version);
        Download.inst.download(
          packageVersionUrl, function(e, packageVersionData) {
          if (e) {
            // If we choke on a package, it's probably something wacky or
            // no longer exists. Let's ignore it for now, but log it just
            // in case.
            debug('error downloading package ' + package + ': ' + e);
            delete this.packageToVersions[package][version];
            return process();
          }

          var packageVersion = JSON.parse(packageVersionData);
          var deps = Package.dependencies(
            packageVersion, ['dependencies', 'peerDependencies'] /* types */);
          Package.versions(this.master, deps, function(e, depToVersions) {
            if (e) {
              return callback && callback(e);
            }

            var newDeps =
              this.addDependencies(packageVersion.name, depToVersions);
            this.dependencySearch(newDeps, function(e) {
              if (e) {
                return callback && callback(e);
              }

              return process();
            });
          }.bind(this));
        }.bind(this));
      }.bind(this));
    }.bind(this));
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
    var newDeps = {};
    for (var package in depToVersions) {
      var currVersions = this.packageToVersions[package];
      var depVersions = depToVersions[package];
      newDeps[package] = {};

      // Check if we are watching this package.
      if (!currVersions) {
        // Add all of the versions.
        debug(parent + ' needs ' + package + '@' +
              Object.keys(depVersions).join(', '));
        this.packageToVersions[package] = depVersions;
        newDeps[package] = depVersions;
        continue;
      }

      // Check which versions we are watching.
      for (var version in depVersions) {
        if (!(version in currVersions)) {
          // Add this version.
          debug(parent + ' needs ' + package + '@' + version);
          this.packageToVersions[package][version] = true;
          newDeps[package][version] = true;
        }
      }
    }

    return newDeps;
  },

  /**
   * Make directories for all of the packages and package versions.
   *
   * @param {Function} callback [err] invoke when done.
   */
  makedirs: function(callback) {
    var dirs = [];
    for (var package in this.packageToVersions) {
      var packagePath = path.resolve(this.root, package);
      dirs.push(packagePath);

      var versions = this.packageToVersions[package];
      for (var version in versions) {
        var packageVersionPath = path.resolve(this.root, package, version);
        dirs.push(packageVersionPath);
      }
    }

    var count = dirs.length;
    debug('maybe make ' + count + ' dirs');
    dirs.forEach(function(dir) {
      maybeMkdir(dir, function onMaybeMkdir(e) {
        if (e) {
          // TODO(gaye): Eventually we should give up.
          debug('error maybemkdir, will try again ' + dir + ': ' + e);
          return maybeMkdir(dir, onMaybeMkdir);
        }

        if (--count <= 0) {
          return callback && callback();
        }
      });
    });
  },

  /**
   * Download all the package root objects, package version objects,
   * and tarballs.
   *
   * @param {Function} callback invoke when done.
   */
  download: function(callback) {
    this.downloadPackageRootObjects(function(e) {
      if (e) {
        return callback && callback(e);
      }

      this.downloadPackageVersions(callback);
    }.bind(this));
  },

  /**
   * Download a package root object for each package.
   *
   * @param {Function} callback invoke when done.
   */
  downloadPackageRootObjects: function(callback) {
    var packages = Object.keys(this.packageToVersions);
    var count = packages.length;
    function process() {
      if (--count <= 0) {
        return callback && callback();
      }
    }

    packages.forEach(function(package) {
      var packageRootUrl = url.resolve(this.master, package);
      // TODO(gaye): Use etags here so that we don't download again
      //     if, for instance, no new packages have been published.
      Download.inst.download(packageRootUrl, function(e, packageRootData) {
        if (e) {
          debug('error downloading package ' + package + ': ' + e);
          return process();
        }

        var packageRoot = JSON.parse(packageRootData);
        var copy = {};
        copy.name = packageRoot.name;
        copy._id = packageRoot.name;
        copy.versions = {};
        var versions = Object.keys(this.packageToVersions[package]);
        versions.forEach(function(version) {
          copy.versions[version] = Package.url(this.hostname, package, version);
        }.bind(this));

        copy['dist-tags'] = {};
        var sorted = versions.sort();
        copy['dist-tags'].latest = sorted[sorted.length - 1];

        var dest = path.resolve(this.root, package, 'index.json');
        fs.writeFile(dest, JSON.stringify(copy), function(e) {
          if (e) {
            return callback && callback(e);
          }

          return process();
        });
      }.bind(this));
    }.bind(this));
  },

  /**
   * Download a package version object and tarball for each package version.
   *
   * @param {Function} callback invoke when done.
   */
  downloadPackageVersions: function(callback) {
    var count = Package.versionCount(this.packageToVersions);
    function process() {
      if (--count <= 0) {
        return callback && callback();
      }
    }

    var packages = Object.keys(this.packageToVersions);
    packages.forEach(function(package) {
      var versions = this.packageToVersions[package];

      var onExists = function(exists) {
        // TODO(gaye): Use etags here to prevent the cases where packages
        //     are modified or deleted after being synced.
        if (exists) {
          return process();
        }

        var packageVersionUrl = Package.url(this.master, package, version);
        Download.download(packageVersionUrl, function(e, packageVersionData) {
          if (e) {
            debug('error downloading package ' + package + ': ' + e);
            return process();
          }

          var packageVersion = JSON.parse(packageVersionData);
          var copy = {};
          copy.name = packageVersion.name;
          copy.version = packageVersion.version;
          copy.dependencies = packageVersion.dependencies;
          copy.devDependencies = packageVersion.devDependencies;
          copy.peerDependencies = packageVersion.peerDependencies;
          copy.dist = {};
          copy.dist.tarball =
            Package.tarballUrl(this.master, package, version);

          fs.writeFile(dest, JSON.stringify(copy), function() {
            var tarball = packageVersion.dist.tarball;
            var dest = path.resolve(
              this.root, package, version,
              package + '-' + version + '.tgz');
            Download.inst.downloadToDisk(tarball, dest, function(e) {
              if (e) {
                return callback && callback(e);
              }

              process();
            });
          }.bind(this));
        }.bind(this));
      }.bind(this);



      for (var version in versions) {
        var dest = path.resolve(this.root, package, version, 'index.json');
        fs.exists(dest, onExists);
      }
    }.bind(this));
  }
};
