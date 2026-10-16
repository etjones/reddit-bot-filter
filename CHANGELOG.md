# Changelog

## 0.2.1

- Switch to Manifest V2 so Firefox grants old.reddit.com and www.reddit.com access at install; under MV3 the newly added www.reddit.com permission stayed off and the content script never ran.

## 0.2.0

- Support new Reddit (www.reddit.com) through a DOM adapter for `shreddit-post` / `shreddit-comment`, alongside the old.reddit adapter.
- New-Reddit feed posts by bots collapse their enclosing `<article>` into the same one-line stub; comment pages tint only each comment's own header and body, not its replies.
- Tinting is applied through `rbf-tint-*` classes on adapter-chosen elements instead of page-specific CSS selectors.
- Log `[bot-filter] adapter=… found N items … without badge anchor` to the page console on each scan, to diagnose selector drift.
- Add `tools/dump_dom.js`, a console snippet that copies a structural outline of Reddit's post and comment elements.

## 0.1.0

- Collapse likely-bot posts on old.reddit listing pages into a one-line, low-contrast stub with subreddit, headline, score, reasons and a show/hide toggle.
- Tint likely-bot (red) and suspect (amber) comments on comment pages and show score plus reasons next to the author.
- Score accounts with a transparent heuristic (age, hidden history, cadence, repeated text, karma-farm subs, default usernames, 404/suspended); moderators and admins are exempt from the hidden-history signal.
- Cache user profiles per username in `browser.storage.local` and re-score on read; TTL 30d for old humans, 14d for bots, 3d otherwise.
- Use one `overview.json` call instead of separate `submitted`/`comments` calls (2 requests per author).
- Share rate-limit pauses across tabs and show progress (checked/total, bots, suspects, cache size, pauses) in a floating pill with a clear-cache button.

## 0.0.1

- Spike extension that logs author profile data on old.reddit.com.
