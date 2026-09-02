# Plan

A client-side daily planner. No backend, no build step, no dependencies —
just `index.html` + `styles.css` + `app.js`, served as static files.

## What it does

Three views inside one widget on the page (`#plan`):

- **Big Goals** — a persistent master list of broad, long-term things the
  user wants to do (e.g. "Learn Spanish"). Add/delete only; goals are never
  marked permanently "complete" here.
- **Weekly Workouts** — a fixed schedule, one line of text per day of the
  week (Mon–Sun), e.g. "Leg day" or blank/"Rest".
- **Today** — auto-generated each calendar day:
  - Today's workout, read from the Weekly Workouts schedule for the
    current weekday.
  - A rotating pick of `GOALS_PER_DAY` (3) goals pulled from Big Goals,
    advanced round-robin so goals cycle through over time (see
    `pickGoalIds` in `app.js`). A "Shuffle" button re-picks randomly
    without disturbing the round-robin pointer.
  - One-off tasks the user types in just for today. Unchecked ones roll
    over to the next day; checked ones are cleared when a new day starts.

## Files

- `index.html` — markup only. No inline styles or scripts beyond the two
  `<link>`/`<script>` tags.
- `styles.css` — all styling. Built from CSS custom properties (`:root`)
  matching the Apple design tokens documented in
  `design-md/apple/DESIGN.md` in the `awesome-design-md` repo (colors,
  type scale, spacing, radii, the single Action Blue accent, pill
  buttons, hairline-bordered cards). Keep new UI within that token set
  rather than introducing new one-off colors or radii.
- `app.js` — all state and interactivity, plain ES5-style JS (`var`,
  function declarations) inside one IIFE, no modules/bundler. Organized
  top-to-bottom as: storage helpers → Big Goals CRUD → Weekly Workouts
  CRUD → Today state (including the daily regenerate/rollover logic) →
  render functions → event wiring → a single `DOMContentLoaded` bootstrap
  at the bottom.

## Data model (`localStorage`)

All data lives in the browser via `localStorage`, plain JSON. No sync
across devices/browsers.

| Key | Shape | Notes |
|---|---|---|
| `plan-goals` | `[{ id, text, createdAt }]` | Big Goals master list. |
| `plan-workouts` | `{ mon?, tue?, wed?, thu?, fri?, sat?, sun? }` | Each value is a plain string; missing/blank means "Rest day". |
| `plan-today` | `{ date, workoutDone, pickedGoalIds, goalDone, extras }` | `date` is `YYYY-MM-DD` local. `pickedGoalIds` are goal ids chosen for that date. `goalDone` maps goal id → bool ("worked on today", not a permanent completion). `extras` is `[{ id, text, done }]`, the one-off tasks. |
| `plan-goal-rotation` | integer (as a string) | Cursor into the Big Goals array so the round-robin pick advances day to day. |

When a page load's stored `plan-today.date` doesn't match today, `app.js`
regenerates it: picks fresh goals, resets `workoutDone`/`goalDone`, and
carries over any unfinished `extras` (see `freshTodayState`).

## Conventions for changes

- Keep it dependency-free and build-step-free unless the user explicitly
  asks for a framework/bundler.
- New colors/type/spacing should reference the existing CSS custom
  properties (`var(--primary)`, `var(--font-text)`, etc.), not new
  literals, to stay consistent with the Apple design tokens.
- `app.js` functions are small and single-purpose by design (load/save
  per data type, one render function per UI block, one setup function per
  interactive area). Follow that shape rather than centralizing state
  into one large object/store.
- This app intentionally does **not** integrate a real calendar or
  fitness tracker — "Weekly Workouts" is a manually-typed schedule, not a
  live sync. If asked to add real calendar/health integration, that needs
  a backend or an OAuth-capable environment; flag that rather than faking
  it client-side.

## Testing changes locally

No test suite. To check a change visually:

```
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

There's no server-side logic, so a static file server is sufficient.
