(function (root) {
  const DAY_S = 86400;
  const BOT_THRESHOLD = 60;
  const SUSPECT_THRESHOLD = 30;
  const DEFAULT_NAME = /^[A-Z][a-z]+[-_]?[A-Z][a-z]+[-_]?\d{1,4}$/;
  const KARMA_FARMS = new Set(["freekarma4u", "freekarma4you", "karmaroulette", "freekarmaforyou", "upvote"]);

  function extractProfile(name, aboutStatus, about, overview) {
    if (aboutStatus === 404) return { name, missing: true };
    const d = about?.data ?? {};
    if (d.is_suspended) return { name, suspended: true };
    const items = (overview?.data?.children ?? []).map((c) => ({
      kind: c.kind === "t3" ? "post" : "comment",
      created: c.data.created_utc,
      subreddit: c.data.subreddit,
      text: c.kind === "t3" ? c.data.title ?? "" : c.data.body ?? "",
    }));
    return {
      name,
      created: d.created_utc,
      linkKarma: d.link_karma ?? 0,
      commentKarma: d.comment_karma ?? 0,
      totalKarma: d.total_karma ?? (d.link_karma ?? 0) + (d.comment_karma ?? 0),
      isMod: Boolean(d.is_mod),
      isEmployee: Boolean(d.is_employee),
      verifiedEmail: d.has_verified_email ?? null,
      items,
    };
  }

  function median(xs) {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }

  function maxDuplicates(items) {
    const counts = new Map();
    for (const it of items) {
      const k = normalize(it.text);
      if (k.length < 8) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Math.max(0, ...counts.values());
  }

  function fmtAge(days) {
    if (days < 1) return `${Math.round(days * 24)}h`;
    if (days < 60) return `${Math.round(days)}d`;
    if (days < 730) return `${Math.round(days / 30)}mo`;
    return `${Math.round(days / 365)}y`;
  }

  function ageSignals(p, ageDays) {
    const out = [];
    if (ageDays < 7) out.push([45, `account ${fmtAge(ageDays)} old`]);
    else if (ageDays < 30) out.push([20, `account ${fmtAge(ageDays)} old`]);
    if (ageDays < 90 && p.linkKarma > 1000) out.push([15, `${p.linkKarma} post karma in ${fmtAge(ageDays)}`]);
    return out;
  }

  function historySignals(p, ageDays) {
    const out = [];
    const exempt = p.isMod || p.isEmployee;
    if (p.items.length === 0 && p.totalKarma > 1 && !exempt) out.push([35, "history hidden"]);
    if (p.items.length >= 10) {
      const times = p.items.map((i) => i.created).sort((a, b) => a - b);
      const gaps = times.slice(1).map((t, i) => t - times[i]);
      const med = median(gaps);
      if (med < 120) out.push([20, `median ${Math.round(med)}s between items`]);
    }
    const dupes = maxDuplicates(p.items);
    if (dupes >= 3) out.push([20, `same text repeated ${dupes}x`]);
    const farm = p.items.filter((i) => KARMA_FARMS.has((i.subreddit ?? "").toLowerCase())).length;
    if (farm > 0) out.push([15, `active in karma-farm subs (${farm})`]);
    if (ageDays < 30 && p.totalKarma < 10 && p.items.length > 0) out.push([10, `low karma (${p.totalKarma})`]);
    return out;
  }

  function identitySignals(p) {
    const out = [];
    if (DEFAULT_NAME.test(p.name)) out.push([10, "auto-generated username"]);
    if (p.verifiedEmail === false) out.push([5, "no verified email"]);
    return out;
  }

  function labelFor(score) {
    if (score >= BOT_THRESHOLD) return "bot";
    if (score >= SUSPECT_THRESHOLD) return "suspect";
    return "human";
  }

  function scoreProfile(p, nowS) {
    if (p.missing) return { score: 90, label: "bot", reasons: ["profile not found (shadowbanned?)"] };
    if (p.suspended) return { score: 100, label: "bot", reasons: ["account suspended"] };
    const ageDays = (nowS - p.created) / DAY_S;
    const signals = [...ageSignals(p, ageDays), ...historySignals(p, ageDays), ...identitySignals(p)];
    const score = Math.min(100, signals.reduce((s, [w]) => s + w, 0));
    return { score, label: labelFor(score), reasons: signals.map(([, r]) => r), ageDays };
  }

  const api = { extractProfile, scoreProfile, labelFor, BOT_THRESHOLD, SUSPECT_THRESHOLD };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RBF = Object.assign(root.RBF ?? {}, { scoring: api });
})(globalThis);
