var check = require('validator').check;


var UrlCheck = {
  /**
   * @param {string} str string to check.
   * @return {boolean} whether or not it's a git url.
   */
  isGitUrl: function(str) {
    // TODO(gaye): This is a terrible implementation.
    if (str.indexOf('git://') !== -1) {
      return true;
    }

    return UrlCheck.isWebUrl(str);
  },

  /**
   * @param {string} str string to check.
   * @return {boolean} whether or not it's a web url.
   */
  isWebUrl: function(str) {
    // TODO(gaye): This is a terrible implementation.
    try {
      check(str).isUrl();
      return true;
    } catch (e) {
      return false;
    }
  }
};
module.exports = UrlCheck;
