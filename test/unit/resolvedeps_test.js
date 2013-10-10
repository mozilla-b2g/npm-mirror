var resolveDeps = require('../../lib/resolvedeps');


suite('#resolveDeps', function() {
  var packageVersion;

  setup(function() {
    packageVersion = {
      name: 'pi',
      version: '3.1.4',
      dependencies: {
        'a': '1.0.0',
        'b': '1.0.0'
      },
      devDependencies: {
        'a': '2.0.0',
        'c': '2.0.0'
      },
      peerDependencies: {
        'c': '2.0.0'
      }
    };
  });

  test('should find the right deps', function() {
    assert.deepEqual(
      resolveDeps(packageVersion),
      {
        'a': { '1.0.0': true, '2.0.0': true },
        'b': { '1.0.0': true },
        'c': { '2.0.0': true }
      }
    );
  });
});
