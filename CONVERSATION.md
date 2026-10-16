# Conversation

## User
Feasibility of a Firefox plugin that filters Reddit posts/comments by: account < 1 week old; non-mod accounts with hidden history; bot-likelihood score above a threshold. Highlight/exclude bot commenters. Existing extensions? What would it take? Search existing bot-detection algorithms first.

## Assistant
**Verdict: feasible, with one soft spot (hidden-history detection) and one fragile dependency (Reddit data access).**

Existing extensions (partial overlap, none do all three filters):
- Redd-Eye (Firefox/Chrome, MIT, v5.2.0, ~31 users): flags only, local heuristics for bot/AI text, sliders. Doesn't hide. https://addons.mozilla.org/firefox/addon/redd-eye/ , https://github.com/RootThePlanet/Redd-Eye
- Bot Hider (Chrome): highlights matches against a community blacklist; ~4 users.
- ShillGuard (Chrome): shows account age, karma, AI-content estimate.

Existing detection approaches (all feature-based; none is a drop-in "score"):
- Botometer is Twitter-only, not usable for Reddit.
- Reddit-spam-bot-detector: 6 features (account age, karma, verified, posting-time variance).
- TrollMagnifier (arXiv 2112.00443): 9 features, account age, comment/submission counts, title/comment overlap.
- UNR "Karma Chameleons" thesis: decision trees, labeled-data shortage.
- Takeaway: build a transparent weighted heuristic score; no maintained trained model.

Criteria:
1. Account < 1 week: trivial. `/user/{name}/about.json` -> `created_utc`. Cache per user.
2. Hidden history: since June 2025 users can hide posts/comments from profile. Mods see full history for 28 days after a user's activity in their sub. Detect: fetch `/user/{name}/submitted.json` + `comments.json`; empty/blocked while `total_karma` is high => hidden. Caveats: brand-new accounts are legitimately empty; can't tell "hidden" from "deleted all"; "non-moderator" is only checkable per-subreddit (compare against `/r/{sub}/about/moderators`, which you may not be allowed to read).
3. Bot score: heuristic from age, karma ratio, post cadence (variance of timestamps), repeated/near-duplicate text, link-spam ratio, subreddit spread, username pattern (Adjective-Noun-1234), hidden history. Text-based AI detection is unreliable; use with low weight.

Biggest risk: data access. Reports (third-party blogs, unverified against Reddit docs) say unauthenticated .json was cut off in 2026 and OAuth app approval is near-closed. A WebExtension content script on reddit.com that makes same-origin fetches with the user's logged-in session is the likely workable path; needs testing. Also: rate limits (batch + cache in IndexedDB), new vs old Reddit DOM (use old.reddit as first target; new Reddit uses shadow DOM web components), per-user lookup cost (50-200 authors per page), ToS gray area for automated profile fetching, false positives (hide-as-collapse/highlight rather than delete).

Build plan: Manifest V3 WebExtension (Firefox supports it), content script + MutationObserver, background script with throttled queue + IndexedDB cache, options page for thresholds/allowlist, collapse-with-reveal UI. Start with old.reddit, ~1-2 weeks for MVP; prototype the profile fetch first to confirm access.

Recommend: spike the fetch from a content script before anything else; fork or study Redd-Eye for DOM handling.

## User
Yes, build a minimal Firefox extension spike that fetches about.json and submitted/comments for authors on old.reddit and logs results.

## Assistant
Built `extension/` (MV3 manifest + `content.js`), `justfile` (`just run`, `just lint`), README, CHANGELOG. Content script collects `a.author` names on old.reddit, fetches `about.json`, `submitted.json?limit=5`, `comments.json?limit=5` same-origin with the logged-in session (1.2s throttle), logs age, karma, mod flag, HTTP statuses, and `likelyHiddenHistory` (empty lists with karma > 0). `web-ext lint`: 0 errors/warnings. Not yet run against live Reddit.

## User
Run `just run` in a terminal tab so I can log in and test.

## Assistant
Ran it in terminal tab c1. Explained how to view logs.

## User
No [bot-filter] messages; got a 429 opening an old.reddit page.

## Assistant
Likely `web-ext run` automation flags + fresh profile. Told user to load the temporary add-on in their normal Firefox via about:debugging and read logs in the page's Web Console (F12).

## User
4 correct objects, then many 429s and null-valued objects.

## Assistant
Access works; failures were cached as results. Rewrote `content.js`: read x-ratelimit headers and adapt delay, honor Retry-After with up to 3 retries, fetch about.json first and skip history on failure, never cache failures, persist cache 24h in browser.storage.local (added `storage` permission).

## User
Naive bot filter: collapse bot posts on listing pages into a subtle text-only stub (subreddit, why flagged, headline, show button); cache user info (local storage or sqlite); show where filtering has reached. On post pages show bot score + reasons, visually distinguish bot comments (no hiding yet).

## Assistant
Built v0.1.0 as modules: `scoring.js` (pure, node-tested), `cache.js` (per-user keys in browser.storage.local, re-score on read, TTL 30d/14d/3d), `fetcher.js` (rate-limit headers, Retry-After, cross-tab shared pause), `ui.js` + `styles.css` (listing stub at 45% opacity, full on hover/focus; red/amber comment tint with score+reasons; `…`/`✓` per-item progress; floating progress pill with clear-cache), `content.js` (MutationObserver, DOM-order queue). Chose storage.local over SQLite (no native SQLite in WebExtensions; storage.local is IndexedDB-backed). Switched to `overview.json` (2 requests/author). Bot ≥ 60, suspect ≥ 30; suspect posts get a badge, not collapsed. Verified UI against a local fake old.reddit fixture in the built-in browser; 6 tests pass, lint clean. Not yet verified on live Reddit.

## User
Pill shows on old.reddit, but no [bot-filter] console messages. Why is old.reddit preferable to reddit.com?

## Assistant
No console output is expected: v0.1.0 only logs 429s and failed lookups, and the pill is the status display. Old vs new: old.reddit is static server HTML with stable `.thing` classes and `data-author`/`data-subreddit-prefixed` attributes, so hiding and inserting elements is trivial, with no SPA navigation and no shadow DOM. New Reddit (shreddit) uses custom elements (`shreddit-post`, `shreddit-comment`) whose host attributes likely expose author/title/subreddit (unverified), but styling inside shadow roots is limited, it is an SPA with client-side navigation and infinite scroll, and the markup changes more often. Risk: Reddit may retire old.reddit. Supporting new Reddit means a second DOM adapter, about the same size as ui.js; scoring, cache, and fetcher are reused. Asked which UI the user uses day-to-day.

## User
I mostly use new reddit. An adapter there would be appreciated. (mid-turn) Can I save some reddit DOM for you?

## Assistant
Built v0.2.0 adapter layer: `adapters.js` (OLD: `.thing`; NEW: `shreddit-post[author]` / `shreddit-comment[author]`, badges in `[slot="credit-bar"]` / `[slot="commentMeta"]`, collapse closest `article`, listing = path without `/comments/`). `ui.js` now adapter-driven; `content.js` logs `adapter=… found N items … without badge anchor`. Manifest covers www.reddit.com. Styles tint light-DOM slotted children (shadow DOM can't be styled from outside). Couldn't inspect live new-Reddit DOM: the built-in browser blocks reddit.com and curl gets a JS challenge page. Selectors are from prior knowledge and unverified. Gave the user `tools/dump_dom.js` to run in the console on a feed and a post page, save with pbpaste into `fixtures/`.

## User
Asked how to save the DOM; ran pbcopy and saved fixtures/newreddit_feed.json.

## Assistant
Gave step-by-step console instructions. Feed dump: shreddit-post has author/post-title/subreddit-prefixed-name; parent is <article>; [slot="credit-bar"] has no /user/ link in feeds, so the badge now anchors after faceplate-timeago. The file was saved as MacRoman (pbpaste with a non-UTF-8 locale); use `LC_ALL=en_US.UTF-8 pbpaste` next time. Waiting on the post-page dump.

## User
Saved new-Reddit feed and post dumps to fixtures/ (after a couple of retries).

## Assistant
Post dump showed shreddit-comment has no shadow root; own meta at `details > summary [slot=commentMeta]`, body at `details [slot=comment]`, replies nested inside. Adapters now resolve a comment's own nodes (checked via closest('shreddit-comment') === el) and expose `tintTargets`; ui adds `rbf-tint-bot/suspect` classes. Verified on mock pages built from the dumped structure: new feed collapse, new comment tint (replies untinted), old comment page still OK, 0 unanchored items. Lint clean, 6 tests pass. Not yet verified on live www.reddit.com.

## User
No pill and no [bot-filter] logs on www.reddit.com after clicking Reload in about:debugging. Anything else needed?

## Assistant
Likely cause: v0.2.0 added www.reddit.com to host_permissions, and Firefox MV3 leaves newly added host permissions off until granted. Steps: grant it in about:addons → Permissions (or via the toolbar extensions button), hard-refresh the tab, then check the unfiltered console for errors and that Info level is on.

## User
So... are you fixing this? It's not working

## Assistant
Switched manifest to MV2 (v0.2.1): Firefox grants MV2 host permissions at install, removing the manual permission toggle that MV3 required for the newly added www.reddit.com. Lint clean, tests pass. User must remove and re-add the temporary add-on (manifest version change), then hard-refresh the Reddit tab. Not yet confirmed on live Reddit.

## User
OK, I'm seeing that now!

## Assistant
Confirmed: v0.2.1 (MV2) runs on www.reddit.com. Asked for the console scan line and the first observations (false positives, layout).
