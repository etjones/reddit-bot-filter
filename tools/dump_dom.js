(() => {
  const attrs = (el) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value.slice(0, 80)]));
  const outline = (el, depth = 0) => depth > 4 ? "…" : {
    tag: el.localName,
    slot: el.getAttribute("slot"),
    cls: String(el.getAttribute("class") ?? "").slice(0, 60),
    shadow: Boolean(el.shadowRoot),
    href: el.getAttribute("href"),
    text: el.children.length ? undefined : el.textContent.trim().slice(0, 40),
    kids: [...el.children].slice(0, 10).map((c) => outline(c, depth + 1)),
  };
  const pick = (sel, n) => [...document.querySelectorAll(sel)].slice(0, n).map((el) => ({
    attrs: attrs(el),
    parent: el.parentElement?.localName,
    insideArticle: Boolean(el.closest("article")),
    tree: outline(el),
  }));
  const out = {
    url: location.pathname,
    counts: {
      posts: document.querySelectorAll("shreddit-post").length,
      comments: document.querySelectorAll("shreddit-comment").length,
      ads: document.querySelectorAll("shreddit-ad-post").length,
    },
    posts: pick("shreddit-post", 2),
    comments: pick("shreddit-comment", 3),
  };
  copy(JSON.stringify(out, null, 1));
  return `copied ${JSON.stringify(out.counts)}`;
})();
