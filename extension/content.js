(function () {
  const TAG = "[bot-filter]";
  const { scoring, cache, fetcher, ui, adapters } = globalThis.RBF;
  const SKIP = new Set(["[deleted]", "AutoModerator"]);

  const adapter = adapters.current();
  const elsByAuthor = new Map();
  const results = new Map();
  const queue = [];
  const previouslyStored = new Set();
  const state = { total: 0, done: 0, bots: 0, suspects: 0, cached: null, current: null, pausedUntil: 0 };
  let working = false;

  const pillText = ui.createPill(async () => {
    await cache.clear();
    state.cached = 0;
    render();
  });
  const render = () => ui.renderPill(pillText, state);
  fetcher.setPauseListener((until) => { state.pausedUntil = until; render(); });
  setInterval(() => { if (state.pausedUntil > Date.now()) render(); }, 1000);

  function record(name, result) {
    results.set(name, result);
    state.done += 1;
    if (result.label === "bot") state.bots += 1;
    if (result.label === "suspect") state.suspects += 1;
    for (const el of elsByAuthor.get(name) ?? []) ui.applyResult(el, adapter, result);
    render();
  }

  async function lookup(name) {
    const base = `/user/${encodeURIComponent(name)}`;
    const about = await fetcher.getJson(`${base}/about.json`);
    if (about.status === 404) return { profile: scoring.extractProfile(name, 404, null, null) };
    if (!about.ok) return { error: about.status };
    if (about.data?.data?.is_suspended) return { profile: scoring.extractProfile(name, 200, about.data, null) };
    await fetcher.throttle();
    const overview = await fetcher.getJson(`${base}/overview.json?limit=25`);
    if (!overview.ok) return { error: overview.status };
    return { profile: scoring.extractProfile(name, 200, about.data, overview.data) };
  }

  async function processOne(name) {
    const { profile, error } = await lookup(name);
    if (profile) {
      await cache.put(name, profile);
      if (state.cached !== null && !previouslyStored.has(name)) state.cached += 1;
      record(name, scoring.scoreProfile(profile, Date.now() / 1000));
      return;
    }
    console.warn(TAG, `lookup failed for u/${name}`, error);
    state.done += 1;
    for (const el of elsByAuthor.get(name) ?? []) ui.markError(el, adapter, error);
  }

  async function processQueue() {
    if (working) return;
    working = true;
    while (queue.length) {
      const name = queue.shift();
      state.current = name;
      render();
      try {
        await processOne(name);
      } catch (err) {
        console.error(TAG, name, err);
        state.done += 1;
      }
      state.current = null;
      render();
      await fetcher.throttle();
    }
    working = false;
  }

  function collectNew() {
    const fresh = [];
    let found = 0;
    let unanchored = 0;
    document.querySelectorAll(`:is(${adapter.selector}):not([data-rbf])`).forEach((el) => {
      el.dataset.rbf = "1";
      const name = adapter.describe(el).author;
      if (!name || SKIP.has(name)) return;
      found += 1;
      if (!elsByAuthor.has(name)) {
        elsByAuthor.set(name, []);
        fresh.push(name);
      }
      elsByAuthor.get(name).push(el);
      const known = results.get(name);
      if (known) ui.applyResult(el, adapter, known);
      else if (!ui.markPending(el, adapter)) unanchored += 1;
    });
    if (found) {
      console.info(TAG, `adapter=${adapter.name} found ${found} items, ${fresh.length} new authors, ${unanchored} without badge anchor`);
    }
    return fresh;
  }

  async function scan() {
    const names = collectNew();
    if (!names.length) return;
    state.total += names.length;
    const stored = await cache.getMany(names);
    const nowMs = Date.now();
    for (const name of names) {
      const rec = stored.get(name);
      const result = rec && scoring.scoreProfile(rec.profile, nowMs / 1000);
      if (rec) previouslyStored.add(name);
      if (rec && cache.isFresh(rec, result, nowMs)) record(name, result);
      else queue.push(name);
    }
    render();
    processQueue();
  }

  let scanTimer = null;
  const addsItem = (m) => [...m.addedNodes].some(
    (n) => n.nodeType === 1 && (n.matches(adapter.selector) || n.querySelector(adapter.selector)),
  );
  new MutationObserver((mutations) => {
    if (!mutations.some(addsItem)) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 300);
  }).observe(document.body, { childList: true, subtree: true });

  console.info(TAG, `loaded, adapter=${adapter.name}`);
  cache.stats().then((n) => { state.cached = n; render(); });
  scan();
})();
