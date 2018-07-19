const pug = require('pug');
const path = require('path');
const ipAddress = require('ip').address();

const template = pug.compileFile(
  path.resolve(__dirname, './documentation.pug')
);

module.exports = config => req => template({ ...config, ipAddress });
