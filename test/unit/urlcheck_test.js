var UrlCheck = require('../../lib/urlcheck');


suite('UrlCheck', function() {
  var subject;

  setup(function() {
    subject = UrlCheck;
  });

  suite('#isGitUrl', function() {
    test('given git url', function() {
      assert.ok(subject.isGitUrl('git://github.com/gaye/gaia.git'));
    });

    test('given not git url', function() {
      assert.ok(!subject.isGitUrl('~0.0.1'));
    });
  });

  suite('#isWebUrl', function() {
    test('given web url', function() {
      assert.ok(subject.isWebUrl('https://mozilla.org'));
    });

    test('given not web url', function() {
      assert.ok(!subject.isWebUrl('>=1.0.0'));
    });

    test('given a file path', function() {
      assert.ok(!subject.isWebUrl('/path/to/package'));
    });
  });
});
