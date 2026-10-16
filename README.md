# Reddit Bot Filter

Firefox extension for new Reddit (www.reddit.com) and old.reddit.com that scores post and comment authors for bot likelihood using a transparent heuristic, then:

- **Listing pages:** collapses likely-bot posts into a faint one-line stub (subreddit · headline · score and reasons · show/hide).
- **Comment pages:** tints bot (red) and suspect (amber) comments and shows the score and reasons beside the author.
- A floating pill shows progress (authors checked, bots, suspects, cache size, rate-limit pauses). Unchecked items show `…` beside the author; checked humans show `✓`.

Profiles are fetched through your logged-in session (`about.json` + `overview.json`, about 2s apart, honoring Reddit's rate-limit headers), cached in `browser.storage.local`, and re-scored on read, so repeat visits get faster.

Scoring lives in `extension/scoring.js` (thresholds: bot ≥ 60, suspect ≥ 30). Page-specific DOM handling lives in `extension/adapters.js`, with one adapter for old.reddit `.thing` elements and one for new Reddit `shreddit-*` elements.

If Reddit changes its markup, the page console logs `[bot-filter] adapter=… N without badge anchor`. Run `tools/dump_dom.js` in the console on the affected page to capture the new structure into `fixtures/`.

## Run

Load it into your normal, logged-in Firefox. `web-ext run` launches an automation-flagged profile that Reddit rate-limits.

1. Open `about:debugging#/runtime/this-firefox`, then click **Load Temporary Add-on…** and select `extension/manifest.json`.
2. Browse old.reddit.com. After editing files, click **Reload** on the add-on.

```
just test
just lint
```

See [CHANGELOG.md](CHANGELOG.md).
