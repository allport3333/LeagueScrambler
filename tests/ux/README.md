# UX audit deliverables

Inspection date: 2026-11-17. **No implementation is authorised or included.**

Start with UX_EXECUTIVE_SUMMARY.md and CONTACT_SHEET.png, then read UX_AUDIT_REPORT.md. SCREENSHOT_INDEX.md and SCREENSHOT_GALLERY.html link every current-design screenshot to its source/state and relevant findings. UX_IMPLEMENTATION_ROADMAP.md proposes staged work, not a new development assignment. mockups/CONCEPTS.html and .png are clearly marked nonfunctional proposals.

The ZIP is a review bundle for attaching to ChatGPT. Local workspace links are not hosted download URLs. The review bundle is not a standalone LeagueScrambler application or a passing functional test suite.

## Evidence boundaries

Production observation was anonymous and read-only. Protected-layout previews use the actual local Angular components with browser-only synthetic data and explicitly modelled client navigation state. No real login, legacy unlock, account/profile creation, score save or administration mutation was completed. All non-GET requests were blocked, including development hot-reload traffic and one local simulated error. No real passwords or authenticated sessions were supplied; shared legacy credentials were never requested or read. No SQL fixtures/queries, IIS/Cloudflare changes, deployments, publishing or regression-suite rerun occurred.

The existing local VS process was started and independently checked through the established read-only inspector (Development / localhost / LeagueScramblerDev / Windows Authentication). No mutation approval was renewed. All custom audit files remain here under tests/ux; application source and styling were not edited.

The 114 screenshots cover the five requested CSS sizes in installed Chromium. They are not real-device/Safari, assistive-technology or 400%-zoom certification. Successful legacy administration, real-session refresh, actual saving, the actual Modify Settings pane and transient loading behavior remain unverified; see the report. Audit locator/change-detection limitations are not reported as application defects.

## Tools and local reproduction notes

Scripts reuse the existing portable Node and Playwright/browser cache under tests/functional without installing packages or touching system Node 10. Standalone axe-core 4.10.3 is isolated in tools with its license. Exploratory scripts are capture tools, not automated functional assertions. Some exploratory entry points stopped at a documented inaccessible tab/overlay; the completed gallery combines broad page captures with separately inspected details. Do not run them against an authenticated production browser or remove their request interception.

make-deliverables.cjs regenerates reports/gallery/contact-sheet/concepts from existing sanitized capture metadata and findings.cjs without accessing the application or SQL. It uses local file rendering only. The archive is explicitly whitelisted to reports, screenshots, sanitized summaries and concepts; no browser profiles, cookies, traces, raw network events, production recovery evidence or database files are included.

## Review questions

Which player actions should be discoverable without logging in? Which phone tasks cause the most real league-night friction? Do the proposed paired scores and progressive scramble controls help experienced administrators? Confirm the session/navigation risk with a real authorized local session before implementing a fix. Select a small first phase together; preserve verified scoring/security behavior and the shared legacy administration workflow.
