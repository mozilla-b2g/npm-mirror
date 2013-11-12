var Package = require('../../lib/package');


suite('Package', function() {
  var subject;

  setup(function() {
    subject = Package;
  });

  test('#dependencies', function() {
    assert.deepEqual(
      subject.dependencies({
        dependencies: {
          'a': '1.0.0',
          'b': '1.0.0',
        },
        devDependencies: {
          'a': '2.0.0',
          'c': '1.0.0'
        },
        peerDependencies: {
          'c': '2.0.0',
          'd': '1.0.0'
        }
      }),
      {
        'a': {
          '1.0.0': true,
          '2.0.0': true
        },
        'b': {
          '1.0.0': true
        },
        'c': {
          '1.0.0': true,
          '2.0.0': true
        },
        'd': {
          '1.0.0': true
        }
      }
    );
  });

  test('#mergeDependencies', function() {
    assert.deepEqual(
      subject.mergeDependencies([
        {
          'a': {
            '1.0.0': true,
            '2.0.0': true,
            '3.0.0': true
          },
          'b': {
            '1.0.0': true
          }
        },
        {
          'a': {
            '4.0.0': true
          },
          'c': {
            '1.0.0': true
          }
        },
        {
          'c': {
            '1.0.0': true
          }
        }
      ]),
      {
        'a': {
          '1.0.0': true,
          '2.0.0': true,
          '3.0.0': true,
          '4.0.0': true
        },
        'b': {
          '1.0.0': true
        },
        'c': {
          '1.0.0': true
        }
      }
    );
  });

  suite('#version', function() {
    test('when version is valid', function(done) {
      function onVersion(e, version) {
        assert.ok(!e);
        assert.strictEqual(version, '1.0.0');
        done();
      }

      subject.version('http://mozilla.com', 'a', '1.0.0', onVersion);
    });

    test.skip('when version is range', function() {
    });
  });

  suite('#versions', function() {
    test.skip('should resolve all loose versions', function() {
      // TODO(gaye)
    });
  });
});
