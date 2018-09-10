const path = require("path");
const pkgDir = require("pkg-dir");
const home = require("home-or-tmp");
exports.NAMESPACE = "local-dev";
const rootDir = pkgDir.sync(process.cwd());
exports.DEV_DIR = `${home}/.jerni-dev/${rootDir.split(/\W+/).join("_")}`;

exports.getDevFile = f => path.resolve(exports.DEV_DIR, f);
