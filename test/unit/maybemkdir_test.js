var mockfs = require('../mock/fs'),
    proxyquire = require('proxyquire');
var maybeMkdir = proxyquire('../../lib/maybemkdir', {
  'graceful-fs': mockfs.fs
});


suite('#maybeMkdir', function() {
  var subject, exists, mkdir;

  setup(function() {
    subject = maybeMkdir;
    exists = sinon.stub(mockfs.fs, 'exists');
    mkdir = sinon.stub(mockfs.fs, 'mkdir');
    mkdir.callsArgAsync(1);
  });

  teardown(function() {
    mockfs.fs.exists.restore();
    mockfs.fs.mkdir.restore();
  });

  suite('path already exists', function() {
    setup(function(done) {
      exists.callsArgWithAsync(1, true);
      subject('a', done);
    });

    test('should not mkdir', function() {
      assert.notCalled(mkdir);
    });
  });

  suite('path does not exist', function() {
    setup(function(done) {
      exists.callsArgWithAsync(1, false);
      subject('a', done);
    });

    test('should mkdir', function() {
      assert.calledWith(mkdir, 'a');
    });
  });
});
