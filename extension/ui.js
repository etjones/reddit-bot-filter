(function (root) {
  const badges = new WeakMap();
  const stubs = new WeakMap();

  function ensureBadge(el, adapter) {
    if (badges.has(el)) return badges.get(el);
    const badge = document.createElement("span");
    badge.className = "rbf-badge";
    const placed = adapter.placeBadge(el, badge) ? badge : null;
    badges.set(el, placed);
    return placed;
  }

  function setBadge(el, adapter, label, text, title) {
    const badge = ensureBadge(el, adapter);
    if (!badge) return false;
    badge.dataset.label = label;
    badge.textContent = text;
    badge.title = title;
    return true;
  }

  function markPending(el, adapter) {
    el.classList.add("rbf-pending");
    return setBadge(el, adapter, "pending", "…", "bot-filter: not checked yet");
  }

  function badgeText(result, verbose) {
    if (result.label === "human") return "✓";
    const why = verbose && result.reasons.length ? ` · ${result.reasons.join(", ")}` : "";
    return `${result.label} ${result.score}${why}`;
  }

  function buildStub(info, result, target) {
    const stub = document.createElement("div");
    stub.className = "rbf-stub";
    stub.title = `u/${info.author} · bot score ${result.score}: ${result.reasons.join("; ")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rbf-stub-toggle";
    btn.textContent = "show";
    btn.addEventListener("click", () => {
      const hidden = target.classList.toggle("rbf-collapsed");
      btn.textContent = hidden ? "show" : "hide";
    });
    const span = (cls, text) => Object.assign(document.createElement("span"), { className: cls, textContent: text });
    const top = result.reasons.slice(0, 2).join(", ");
    const more = result.reasons.length > 2 ? ` +${result.reasons.length - 2}` : "";
    stub.append(
      btn, " ",
      span("rbf-stub-sub", info.sub), " · ",
      span("rbf-stub-title", info.title), " · ",
      span("rbf-stub-meta", `bot ${result.score}: ${top}${more} · u/${info.author}`),
    );
    return stub;
  }

  function collapse(el, adapter, info, result) {
    const target = adapter.collapseTarget(el);
    if (stubs.has(target)) return;
    target.classList.add("rbf-collapsed");
    const stub = buildStub(info, result, target);
    target.before(stub);
    stubs.set(target, stub);
  }

  function applyResult(el, adapter, result) {
    const info = adapter.describe(el);
    el.classList.remove("rbf-pending");
    el.classList.add(`rbf-${result.label}`);
    const listingPost = info.kind === "post" && adapter.isPostListing();
    const title = `bot score ${result.score}: ${result.reasons.join("; ") || "no signals"}`;
    setBadge(el, adapter, result.label, badgeText(result, !listingPost), title);
    if (listingPost && result.label === "bot") collapse(el, adapter, info, result);
    if (!listingPost && result.label !== "human") {
      for (const node of adapter.tintTargets(el)) node.classList.add(`rbf-tint-${result.label}`);
    }
  }

  function markError(el, adapter, status) {
    setBadge(el, adapter, "error", "?", `bot-filter: lookup failed (${status}), will retry on next page load`);
  }

  function createPill(onClear) {
    const pill = document.createElement("div");
    pill.className = "rbf-pill";
    const text = document.createElement("span");
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "clear cache";
    clear.addEventListener("click", onClear);
    pill.append(text, " ", clear);
    document.body.append(pill);
    return text;
  }

  function renderPill(el, s) {
    const parts = [`bot-filter ${s.done}/${s.total} authors`, `${s.bots} bots`, `${s.suspects} suspect`];
    if (s.cached !== null) parts.push(`${s.cached} cached`);
    if (s.pausedUntil > Date.now()) parts.push(`paused ${Math.ceil((s.pausedUntil - Date.now()) / 1000)}s (rate limit)`);
    else if (s.current) parts.push(`checking u/${s.current}`);
    else if (s.done === s.total) parts.push("idle");
    el.textContent = parts.join(" · ");
  }

  root.RBF = Object.assign(root.RBF ?? {}, {
    ui: { markPending, applyResult, markError, createPill, renderPill },
  });
})(globalThis);
