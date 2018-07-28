const tryParse = str => {
  try {
    return JSON.parse(str);
  } catch (ex) {
    return undefined;
  }
};
export default tryParse;
