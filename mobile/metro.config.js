// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");
const webSrc = path.resolve(repoRoot, "src");

const config = getDefaultConfig(projectRoot);

/**
 * This app lives inside the website's repo, which has its own `node_modules`
 * one directory up — including a different React (19.2.8, against the app's
 * 19.2.3). Metro walks up the tree looking for modules, so the website's copy
 * is reachable from here, and binding to it would produce "Invalid hook call"
 * at runtime, long after a build has gone green.
 *
 * Anchoring the search to this project's `node_modules` is enough: the app has
 * its own React, so the upward walk finds that first and never reaches the
 * website's.
 *
 * `disableHierarchicalLookup` looks like the thorough version of this and is a
 * trap — npm nests packages (`expo/node_modules/expo-asset`), and turning the
 * walk off entirely makes those unresolvable.
 */
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

/**
 * A few modules are genuinely shared with the website — the door's access
 * levels and deny reasons, which the server also validates against. Importing
 * them rather than copying is what stops the buttons on the phone and the
 * values the database accepts from drifting apart.
 *
 * TypeScript already resolves `~/` to the website's `src` (see tsconfig), so
 * Metro is taught the same alias and given the directory to watch. Without
 * this the app type-checks and then fails to bundle, because a *type* import
 * is erased but a *value* import has to actually be there.
 *
 * Only `src` is exposed, not the repo root, so the app cannot reach the
 * website's `node_modules`. Anything under `~/server` remains off limits in
 * practice: those files import `server-only`, which throws if it is ever
 * pulled into a client bundle.
 */
config.watchFolders = [projectRoot, webSrc];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "~": webSrc,
};

module.exports = config;
