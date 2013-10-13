/*global module, process*/
var fs = {
  exists: function(path, callback) {
    return callback && process.nextTick(function() {
      callback(true);
    });
  },

  mkdir: function(path, callback) {
    return callback && process.nextTick(callback);
  },

  writeFile: function(filename, data, callback) {
    return callback && process.nextTick(callback);
  }
};
module.exports.fs = fs;
