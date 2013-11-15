// TODO(gaye): This is disabled since the npm-server won't die right now?
//     This makes it so this test passes once and fails all subsequent times.

// /**
//  * @fileoverview An integration test that does the following:
//  *     1. Sync packages from http://registry.npmjs.org for our manifest.
//  *     2. Start a webserver to serve the packages.
//  *     3. Run `npm install` from our repo and
//  *     4. Make sure npm exits ok.
//  */
// var exec = require('child_process').exec,
//     path = require('path'),
//     temp = require('temp');


// /**
//  * @type {string}
//  */
// var TEST_MASTER = 'http://registry.npmjs.org';


// /**
//  * @type {number}
//  */
// var TEST_PORT = 8080;


// /**
//  * @type {string}
//  */
// var TEST_HOST = 'http://localhost:' + TEST_PORT;


// suite('install', function() {
//   var mirror, server, manifest, root;

//   // Run the mirror and bring up the npm server.
//   suiteSetup(function(done) {
//     temp.track();
//     manifest = path.resolve(__dirname, '../fixtures', 'package.json');
//     root = temp.mkdirSync('temp');

//     var binary = path.resolve(__dirname, '../../bin/npm-mirror');
//     var cmd = [
//       binary,
//       '--master', TEST_MASTER,
//       '--manifests', manifest,
//       '--hostname', TEST_HOST,
//       '--root', root
//     ].join(' ');

//     mirror = exec(cmd);
//     mirror.once('exit', function() {
//       binary = path.resolve(__dirname, '../../bin/npm-server');
//       cmd = [
//         binary,
//         '--port',
//         TEST_PORT,
//         '--root',
//         root
//       ].join(' ');

//       server = exec(cmd);
//       done();
//     });
//   });

//   // Kill the npm server.
//   suiteTeardown(function(done) {
//     server.once('exit', function() {
//       done();
//     });

//     server.kill();
//   });

//   // Remove the installed packages.
//   suiteTeardown(function(done) {
//     var modules =
//       path.resolve(__dirname, '..', 'fixtures', 'node_modules');
//     var cmd = ['rm', '-rf', modules].join(' ');

//     var rm = exec(cmd);
//     rm.on('exit', function() {
//       done();
//     });
//   });

//   test('npm should exit ok', function(done) {
//     var dir = path.resolve(__dirname, '..', 'fixtures');
//     var cmd = [
//       'cd', dir, '&&',
//       'npm', 'install', '--registry', 'http://localhost:8080'
//     ].join(' ');

//     var install = exec(cmd);
//     install.on('exit', function(event) {
//       assert.strictEqual(event, 0);
//       done();
//     });
//   });
// });
