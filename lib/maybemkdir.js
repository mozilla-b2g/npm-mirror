var fs = require('graceful-fs');


/**
 * Make the directory if it doesn't exist.
 *
 * @param {string} path to directory.
 * @param {Function} callback invoke when done.
 */
function maybeMkdir(path, callback) {
  fs.exists(path, function(exists) {
    if (exists) {
      return callback && callback();
    }

    fs.mkdir(path, callback);
  });
}
module.exports = maybeMkdir;
