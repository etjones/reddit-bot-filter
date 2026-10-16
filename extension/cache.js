(function (root) {
  const DAY_MS = 86400 * 1000;
  const PREFIX = "u:";

  const keyFor = (name) => PREFIX + name.toLowerCase();

  function ttlMs(result) {
    if (result.label === "human" && (result.ageDays ?? 0) > 365) return 30 * DAY_MS;
    if (result.label === "bot") return 14 * DAY_MS;
    return 3 * DAY_MS;
  }

  async function getMany(names) {
    const stored = await browser.storage.local.get(names.map(keyFor));
    const out = new Map();
    for (const name of names) {
      const rec = stored[keyFor(name)];
      if (rec) out.set(name, rec);
    }
    return out;
  }

  function isFresh(rec, result, nowMs) {
    return nowMs - rec.fetchedAt < ttlMs(result);
  }

  async function put(name, profile) {
    const rec = { profile, fetchedAt: Date.now() };
    await browser.storage.local.set({ [keyFor(name)]: rec });
    return rec;
  }

  async function stats() {
    const all = await browser.storage.local.get(null);
    return Object.keys(all).filter((k) => k.startsWith(PREFIX)).length;
  }

  async function clear() {
    const all = await browser.storage.local.get(null);
    await browser.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(PREFIX)));
  }

  root.RBF = Object.assign(root.RBF ?? {}, { cache: { getMany, isFresh, put, stats, clear } });
})(globalThis);
