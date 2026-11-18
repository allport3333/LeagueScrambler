# Player Standings mobile gap — completed 2026-11-17

**Root cause:** app.component.css reserves 85px above `.body-content` at widths ≤767px, although the current navigation is in normal flow. The standings card's existing 8px top margin makes the measured gap 93px.

**Correction:** app.component.html applies a standings-route class to that parent container. A small Router-based getter in app.component.ts identifies the route, including query strings, fragments and a trailing slash. The mobile-only rule for this class sets parent padding to 6px. With the unchanged 8px card margin, the final gap is **14px**. No negative margins, positioning offsets, navigation changes or card-interior changes.

Other mobile routes retain their existing padding. Tablet and desktop CSS are unchanged. No standings component, scoring, authentication, API or database changes in this pass.

## Verification

- Angular development build passed using existing Node 10 and installed packages; existing outdated Browserslist warning only.
- **5 focused browser check groups passed, 0 failed.**
- At 375×667 and 390×844, direct loading, refreshing and Angular navigation from FAQ to `/standings?from=faq#players` all gave a 14px gap, with no horizontal overflow. FAQ retained its original 85px parent padding.
- At 768×1024, 1366×768 and 1920×1080, before/after screenshots are byte-identical and measured layout values match exactly.
- Navigation bounds/text and standings card interior padding/top margin match the pre-change baseline at every tested size.
- All browser API GETs used synthetic intercepted responses; all writes/external requests were blocked. Zero API write attempts, browser page errors or database access. No full regression run or additional production build cycle was needed for this small layout correction.

## Screenshots and evidence

- [375px before](standings-gap-evidence/375-before.png) · [375px after](standings-gap-evidence/375-after.png)
- [390px after](standings-gap-evidence/390-after.png)
- [Tablet after — identical](standings-gap-evidence/768-after.png)
- [Desktop 1366 after — identical](standings-gap-evidence/1366-after.png)
- [Desktop 1920 after — identical](standings-gap-evidence/1920-after.png)
- [Measurements and results](standings-gap-evidence/results.json)

Source changes are limited to app.component.css, app.component.html and app.component.ts. Focused checks live in `tests/functional/scripts/standings-gap.cjs`, with baseline/evidence under `standings-gap-evidence`; this report and WORK_LOG record completion. Prior pending work was preserved. No production, IIS, Cloudflare, publish, deploy, commit, push or merge operations. Work stopped at this adjustment.
