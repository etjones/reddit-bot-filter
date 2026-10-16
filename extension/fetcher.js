(function (root) {
  const TAG = "[bot-filter]";
  const BASE_DELAY_MS = 2000;
  const MAX_RETRIES = 3;
  const PAUSE_KEY = "rate:pausedUntil";

  let nextDelayMs = BASE_DELAY_MS;
  let onPause = () => {};

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function readRate(res) {
    const n = (h) => Number(res.headers.get(h));
    return { remaining: n("x-ratelimit-remaining"), reset: n("x-ratelimit-reset"), retryAfter: n("retry-after") };
  }

  function adaptDelay(rate) {
    if (Number.isFinite(rate.remaining) && Number.isFinite(rate.reset) && rate.reset > 0) {
      nextDelayMs = Math.max(BASE_DELAY_MS, Math.ceil((rate.reset * 1000) / Math.max(rate.remaining, 1)));
    }
  }

  function waitSecondsFor(rate, attempt) {
    if (rate.retryAfter > 0) return rate.retryAfter;
    if (rate.reset > 0) return rate.reset;
    return 30 * 2 ** attempt;
  }

  async function waitForSharedPause() {
    const until = (await browser.storage.local.get(PAUSE_KEY))[PAUSE_KEY] ?? 0;
    if (until > Date.now()) {
      onPause(until);
      await sleep(until - Date.now());
      onPause(0);
    }
  }

  async function pauseAll(seconds) {
    const until = Date.now() + seconds * 1000 + 500;
    await browser.storage.local.set({ [PAUSE_KEY]: until });
    onPause(until);
    await sleep(until - Date.now());
    onPause(0);
  }

  async function getJson(path) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await waitForSharedPause();
      const res = await fetch(`${location.origin}${path}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const rate = readRate(res);
      adaptDelay(rate);
      if (res.status !== 429) {
        return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
      }
      const wait = waitSecondsFor(rate, attempt);
      console.warn(TAG, `429 on ${path}; pausing ${wait}s`, rate);
      await pauseAll(wait);
    }
    return { ok: false, status: 429, data: null };
  }

  const throttle = () => sleep(nextDelayMs);
  const setPauseListener = (fn) => { onPause = fn; };

  root.RBF = Object.assign(root.RBF ?? {}, { fetcher: { getJson, throttle, setPauseListener } });
})(globalThis);
