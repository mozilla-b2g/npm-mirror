/*global cache*/
var debug = require('debug')('npm-mirror:Download'),
    fs = require('graceful-fs'),
    http = require('http');


/**
 * Use a global cache so that consumers don't have to pass around a Download.
 * Bad programmer! Bad!
 */
if (!global.cache) {
  global.cache = {};
}
var Download = {
  /**
   * Download http response to memory.
   *
   * @param {string} url to fetch.
   * @param {Function} callback invoke when done.
   */
  download: function(url, callback) {
    if (cache[url]) {
      return callback && callback(null, cache[url]);
    }

    debug('GET ' + url);
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
        cache[url] = result;
        return callback && callback(null, result);
      });
    }).on('error', function(e) {
      return callback && callback(e);
    });
  },

  /**
   * Download http response and save to disk.
   *
   * @param {string} url to fetch.
   * @param {string} dest where to write the tarball.
   * @param {Function} callback invoke when done.
   */
  downloadToDisk: function(url, dest, callback) {
    if (cache[url]) {
      return fs.writeFile(dest, cache[url], callback);
    }

    fs.exists(dest, function(exists) {
      if (exists) {
        // No need to download :).
        return callback && callback();
      }

      var stream = fs.createWriteStream(dest);
      debug('GET ' + url);
      http.get(url, function(res) {
        if (res.statusCode !== 200) {
          return callback && callback(
            new Error('Bad status ' + res.statusCode + ' for ' + url));
        }

        res.pipe(stream);
        stream.on('finish', callback);
      });
    });
  }
};
module.exports = Download;
