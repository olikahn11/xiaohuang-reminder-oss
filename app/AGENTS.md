# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product and visual decisions

- The app is part of the user's “小黄系列” and is named “小黄提醒管家”; all user-facing product names must use this brand.
- The brand icon uses the yellow reminder-manager mascot with a bell, calendar, and checkmark on the existing ink-indigo/cyan/violet/magenta visual system.
- Desktop and mobile must share one responsive PWA; desktop prioritizes dense readable lists and mobile uses compact cards and bottom navigation.
- Use the selected spectral liquid-glass design: deep ink-indigo/petrol surfaces with cobalt, ultraviolet, magenta, cyan, coral, and mint semantic accents. Do not use a black-and-gold theme.
- Motion is a core requirement. Pointer hover, click, drawer opening, renewal urgency, and confirmation must each receive meaningful neon/light/morph feedback. Avoid decorative motion that obscures information.
- Sensitive fields are masked by default. The first prototype uses privacy-safe fake data and local persistence only.
- Production builds must open with a clean, empty local data set. Never seed demo/test records into an installed app.
- Every record type supports create, detail view, edit, and delete. Project detail also offers adding a related record.
- All date interactions are Chinese-localized; avoid relying on an English system date input for core workflows.
- The overview includes a cinematic, animated month calendar with dated reminders and drill-down into each record.
- On mobile, the top-right add action is the single global quick-add entry; the former duplicated center bottom add action is a calendar shortcut.
