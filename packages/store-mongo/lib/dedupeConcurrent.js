// Coalesce concurrent calls onto a single execution ("single-flight").
//
// While one call to `fn` is in flight, every other call shares its promise
// instead of invoking `fn` again. The shared promise is released as soon as it
// settles (whether it fulfils or rejects), so this deduplicates *concurrency*
// without caching results — the next call after settlement runs `fn` afresh,
// and a rejection is never cached.
//
// Arguments are ignored: all overlapping calls share the first one's execution.
const dedupeConcurrent = (fn) => {
  let inflight = null;

  return function deduped(...args) {
    if (inflight) return inflight;

    const pending = (async () => fn(...args))();
    inflight = pending;

    // only clear if a newer call hasn't already replaced this one
    const release = () => {
      if (inflight === pending) inflight = null;
    };
    pending.then(release, release);

    return pending;
  };
};

module.exports = dedupeConcurrent;
