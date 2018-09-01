const kleur = require("kleur");

const path = require("path");

const last = require("../utils/last");

const cwd = process.cwd();

exports.wrapError = error => {
  const { name, message, stack } = error;
  if (name === "SyntaxError") {
    const [file, line, column = null] = stack.split("\n")[0].split(":");
    return {
      name,
      message,
      location: { file: path.relative(process.cwd(), file), line, column }
    };
  }

  const firstRelevantLocation = last(
    stack
      .split("\n")
      .filter(str => str.includes(cwd))[0]
      .split(cwd + "/")
  ).slice(0, -1);

  const [file, line, column = null] = firstRelevantLocation.split(":");

  return {
    name,
    message,
    location: { file: path.relative(process.cwd(), file), line, column }
  };
};
exports.formatError = error => {
  let fmt = `${kleur.bold.red(error.name)}: ${kleur.bold(error.message)}`;
  if (error.location) {
    fmt += `\n  ${kleur.dim.italic(
      error.location.column ? "  file" : "file"
    )}: ${kleur.underline.yellow(error.location.file)}`;
    fmt += `\n  ${kleur.dim.italic(
      error.location.column ? "  line" : "line"
    )}: ${kleur.underline.yellow(error.location.line)}`;
    if (error.location.column) {
      fmt += `\n  ${kleur.dim.italic("column")}: ${kleur.underline.yellow(
        error.location.column
      )}`;
    }
  }

  return fmt;
};
