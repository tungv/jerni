const path = require("path");

exports.NAMESPACE = "local-dev";
exports.DEV_DIR = path.resolve(process.cwd(), "./.jerni-dev");

exports.getDevFile = f => path.resolve(exports.DEV_DIR, f);
