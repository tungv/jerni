const dedupeConcurrent = require("../dedupeConcurrent");

// a controllable async fn: each call returns a promise the test resolves/rejects
function deferredFn() {
  const calls = [];
  const fn = jest.fn((...args) => {
    let settle;
    const promise = new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
    calls.push({ args, ...settle });
    return promise;
  });
  return { fn, calls };
}

describe("dedupeConcurrent", () => {
  it("runs fn once while a call is in flight and shares its result", async () => {
    const { fn, calls } = deferredFn();
    const deduped = dedupeConcurrent(fn);

    const p1 = deduped();
    const p2 = deduped();
    const p3 = deduped();

    expect(fn).toHaveBeenCalledTimes(1);

    calls[0].resolve("value");
    expect(await Promise.all([p1, p2, p3])).toEqual(["value", "value", "value"]);
  });

  it("returns the identical promise to concurrent callers", () => {
    const { fn } = deferredFn();
    const deduped = dedupeConcurrent(fn);

    expect(deduped()).toBe(deduped());
  });

  it("runs fn again for a call made after the previous one settled", async () => {
    const { fn, calls } = deferredFn();
    const deduped = dedupeConcurrent(fn);

    const p1 = deduped();
    calls[0].resolve("first");
    await p1;

    const p2 = deduped();
    expect(fn).toHaveBeenCalledTimes(2);

    calls[1].resolve("second");
    expect(await p2).toBe("second");
  });

  it("does not cache rejections - the next call retries", async () => {
    const { fn, calls } = deferredFn();
    const deduped = dedupeConcurrent(fn);

    const p1 = deduped();
    calls[0].reject(new Error("boom"));
    await expect(p1).rejects.toThrow("boom");

    const p2 = deduped();
    expect(fn).toHaveBeenCalledTimes(2);

    calls[1].resolve("recovered");
    expect(await p2).toBe("recovered");
  });

  it("propagates a rejection to every concurrent caller", async () => {
    const { fn, calls } = deferredFn();
    const deduped = dedupeConcurrent(fn);

    const p1 = deduped();
    const p2 = deduped();
    calls[0].reject(new Error("boom"));

    await expect(p1).rejects.toThrow("boom");
    await expect(p2).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("ignores arguments - overlapping calls share the first execution", async () => {
    const { fn, calls } = deferredFn();
    const deduped = dedupeConcurrent(fn);

    const p1 = deduped("a");
    const p2 = deduped("b");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls[0].args).toEqual(["a"]);

    calls[0].resolve("shared");
    expect(await Promise.all([p1, p2])).toEqual(["shared", "shared"]);
  });

  it("normalises a synchronous throw into a rejected promise", async () => {
    const fn = jest.fn(() => {
      throw new Error("sync boom");
    });
    const deduped = dedupeConcurrent(fn);

    await expect(deduped()).rejects.toThrow("sync boom");
    // slot released, so a retry is possible
    await expect(deduped()).rejects.toThrow("sync boom");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
