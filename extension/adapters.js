(function (root) {
  const OLD = {
    name: "old",
    selector: "div.thing[data-author]:not(.promoted)",
    isPostListing: () => !document.body.classList.contains("comments-page"),
    describe(el) {
      return {
        author: el.dataset.author,
        kind: el.classList.contains("link") ? "post" : "comment",
        sub: el.dataset.subredditPrefixed ?? "",
        title: el.querySelector(":scope > .entry a.title")?.textContent.trim() ?? "",
      };
    },
    placeBadge(el, badge) {
      const link = el.querySelector(":scope > .entry a.author");
      if (!link) return false;
      link.after(badge);
      return true;
    },
    tintTargets: (el) => [el.querySelector(":scope > .entry")].filter(Boolean),
    collapseTarget: (el) => el,
  };

  function ownComment(el, selector) {
    const node = el.querySelector(selector);
    return node && node.closest("shreddit-comment") === el ? node : null;
  }

  function newMeta(el) {
    if (el.localName === "shreddit-post") return el.querySelector('[slot="credit-bar"]');
    return ownComment(el, ':scope > details > summary [slot="commentMeta"]');
  }

  const NEW = {
    name: "new",
    selector: "shreddit-post[author], shreddit-comment[author]",
    isPostListing: () => !/\/comments\//.test(location.pathname),
    describe(el) {
      return {
        author: el.getAttribute("author"),
        kind: el.localName === "shreddit-post" ? "post" : "comment",
        sub: el.getAttribute("subreddit-prefixed-name") ?? "",
        title: el.getAttribute("post-title") ?? "",
      };
    },
    placeBadge(el, badge) {
      const meta = newMeta(el);
      if (!meta) return false;
      const anchor = meta.querySelector('a[href*="/user/"]') ?? meta.querySelector("faceplate-timeago");
      if (anchor) anchor.after(badge);
      else meta.append(badge);
      return true;
    },
    tintTargets(el) {
      if (el.localName === "shreddit-post") return [el];
      return [newMeta(el), ownComment(el, ':scope > details [slot="comment"]')].filter(Boolean);
    },
    collapseTarget: (el) => el.closest("article") ?? el,
  };

  const current = () => (location.hostname.startsWith("old.") ? OLD : NEW);

  root.RBF = Object.assign(root.RBF ?? {}, { adapters: { OLD, NEW, current } });
})(globalThis);
