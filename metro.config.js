const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const exclusionList = require("metro-config/src/defaults/exclusionList");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude server-side Node.js code from the Metro bundle.
// These directories contain mysql2, drizzle-orm, express, net, etc.
// which are not compatible with React Native / the web bundler.
config.resolver.blockList = exclusionList([
  /\/server\/.*/,
  /\/drizzle\/.*/,
  /\/backend\/.*/,
  /\/scripts\/.*/,
]);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});

