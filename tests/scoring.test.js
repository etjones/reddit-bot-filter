const test = require("node:test");
const assert = require("node:assert/strict");
const { extractProfile, scoreProfile } = require("../extension/scoring.js");

const NOW = 1_800_000_000;
const DAY = 86400;

function about(overrides = {}) {
  return {
    data: {
      created_utc: NOW - 3 * 365 * DAY,
      link_karma: 500,
      comment_karma: 5000,
      total_karma: 5500,
      is_mod: false,
      is_employee: false,
      has_verified_email: true,
      ...overrides,
    },
  };
}

function overview(items) {
  return {
    data: {
      children: items.map(([t, body, sub = "pics"]) => ({
        kind: "t1",
        data: { created_utc: t, body, subreddit: sub },
      })),
    },
  };
}

const humanItems = [
  [NOW - 9000, "I think the second option is better honestly"],
  [NOW - 60000, "Had the same problem last year with my car"],
  [NOW - 200000, "This is a great photo, where was it taken?"],
];

test("old active account scores human", () => {
  const p = extractProfile("longtime_user", 200, about(), overview(humanItems));
  const r = scoreProfile(p, NOW);
  assert.equal(r.label, "human");
  assert.deepEqual(r.reasons, []);
});

test("new account with hidden history scores bot", () => {
  const p = extractProfile("Brave_Otter_4821", 200, about({ created_utc: NOW - 2 * DAY, total_karma: 40 }), overview([]));
  const r = scoreProfile(p, NOW);
  assert.equal(r.label, "bot");
  assert.ok(r.reasons.includes("account 2d old"));
  assert.ok(r.reasons.includes("history hidden"));
  assert.ok(r.reasons.includes("auto-generated username"));
});

test("moderators are exempt from hidden-history signal", () => {
  const p = extractProfile("modperson", 200, about({ is_mod: true }), overview([]));
  const r = scoreProfile(p, NOW);
  assert.equal(r.label, "human");
});

test("404 profile is treated as bot", () => {
  const r = scoreProfile(extractProfile("ghost", 404, null, null), NOW);
  assert.equal(r.label, "bot");
});

test("suspended profile is treated as bot", () => {
  const r = scoreProfile(extractProfile("gone", 200, { data: { is_suspended: true } }, null), NOW);
  assert.equal(r.score, 100);
});

test("rapid repeated comments are flagged", () => {
  const items = Array.from({ length: 12 }, (_, i) => [NOW - i * 30, "Check out this amazing deal!!", "FreeKarma4U"]);
  const p = extractProfile("spammer", 200, about({ created_utc: NOW - 20 * DAY }), overview(items));
  const r = scoreProfile(p, NOW);
  assert.equal(r.label, "bot");
  assert.ok(r.reasons.some((x) => x.startsWith("median 30s")));
  assert.ok(r.reasons.some((x) => x.startsWith("same text repeated 12x")));
});
