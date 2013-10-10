/**
 * This implementation is a bit forward thinking since we don't need the
 * versions required yet. However, in bug 925424 we want to limit what we
 * sync to only the versions we need, so we'll grab that info here too.
 *
 * @param {Object} package version object.
 * @return {Object} map from dependencies to array of versions we need.
 */
function resolveDeps(packageVersion) {
  var deps = {};
  [
    'dependencies',
    'devDependencies',
    'peerDependencies'
  ].forEach(function(depType) {
    var depToVersion = packageVersion[depType];
    if (!depToVersion) {
      return;
    }

    Object.keys(depToVersion).forEach(function(dep) {
      if (!(dep in deps)) {
        deps[dep] = {};
      }

      var version = depToVersion[dep];
      deps[dep][version] = true;
    });
  });

  return deps;
}
module.exports = resolveDeps;
