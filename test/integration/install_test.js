/**
 * @fileoverview An integration test that does the following:
 *     1. Clone a github repo.
 *     2. Sync packages from http://registry.npmjs.org for its manifest.
 *     3. Start a webserver to serve the packages.
 *     4. Run `npm install` from the github repo.
 *     5. Run the repo's test suite to make sure that it works.
 */
suite('install test', function() {
  // TODO(gaye)
});
