var debug = require('debug')('npm-mirror:Download'),
    fs = require('graceful-fs'),
    http = require('http');


/**
 * @constructor
 */
function Download() {
  this.cache = {};
}

/** 
 * @return {Download} singleton download.
 */
Download.__defineGetter__('inst', function() {
  if (Download._inst) {
    return Download._inst;
  }

  var download = new Download();
  Download._inst = download;
  return download;
});

/**
 * @type {Download}
 */
Download._inst = null;

Download.prototype = {
  /**
   * @type {Object}
   */
  cache: null,

  /**
   * Download http response to memory.
   *
   * @param {string} url to fetch.
   * @param {Function} callback invoke when done.
   */
  download: function(url, callback) {
    if (this.cache[url]) {
      return callback && callback(null, this.cache[url]);
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
        this.cache[url] = result;
        return callback && callback(null, result);
      }.bind(this));
    }.bind(this)).on('error', function(e) {
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
    if (this.cache[url]) {
      return fs.writeFile(dest, this.cache[url], callback);
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
