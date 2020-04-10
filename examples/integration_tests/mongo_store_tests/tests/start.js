module.exports = async function start(reporter, initializer, ...params) {
  const journey = await initializer(...params);

  for await (const output of journey.begin()) {
    const brk = await reporter(output);
    if (brk) break;
  }

  await journey.dispose();
};
