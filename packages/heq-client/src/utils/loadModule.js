export default function esmInteropImport(rulePath) {
  const rules = require(rulePath);

  return rules.default || rules;
}
