const path = require("path");
const pkgDir = require("pkg-dir");

exports.NAMESPACE = "local-dev";
const rootDir = pkgDir.sync(process.cwd());
exports.DEV_DIR = path.resolve(rootDir, "./node_modules/.bin/.jerni-dev");

exports.getDevFile = f => path.resolve(exports.DEV_DIR, f);
