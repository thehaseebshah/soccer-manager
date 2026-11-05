# Gaffer

A club manager for soccer coaches **and** owners, on iOS, Android and the web from one codebase
(Expo / React Native + react-native-web, TypeScript, Expo Router).

Most club apps either run the admin (registration, payments, chat) or the analysis (video, GPS).
Gaffer connects the **owner's books** to the **coach's lineup**:

| Feature | What it does |
|---|---|
| **Fair-rotation planner** | Builds a substitution plan for a match so every available player gets a guaranteed minimum share (e.g. 30%) of minutes. Combines a per-player minutes quota (catch-up for under-used players ↔ strength, via a Develop / Balanced / Compete dial) with Hungarian-algorithm position assignment. Keepers share the goal; outfield players never go in it. |
| **Minutes ledger & fairness index** | Season minutes, share of available time, starts, goals/assists, training attendance. Players below the club's minimum are flagged and automatically prioritised in the next plan. |
| **Parent explainer** | One tap writes a plain-language "why did my child play X minutes" message from real data. |
| **Live match mode** | Clock, planned sub windows with one-tap apply, manual subs, goals/assists. Minutes are recorded exactly and feed the season ledger. |
| **Wage budget & contracts** | Annual budget vs committed wages, 24-month roll-off projection, expiry flags, retention-risk ranking (good player × short contract), squad shape vs ideal. |
| **Scenario lab** | Stack releases, renewals and signings; see wage bill, one-off costs, depth warnings, squad rating and the 24-month chart before committing. Optionally apply to the real squad. |
| **Development** | Position-weighted ratings, observation log, trend sparklines, focus goals with progress, age-curve projection, suggested squad training focus, shareable progress reports. |

## Run it

```bash
npm install
npm run web        # browser
npm run ios        # needs macOS / Expo Go
npm run android    # needs Android emulator / Expo Go
npm test           # domain logic (rotation, budget, live clock, fairness)
npm run typecheck
npm run build:web  # static export to dist/
```

On first launch, create a club or tap **Load demo club** for a populated semi-pro club.

## Architecture

- `src/domain/` — pure TypeScript, no React: `lineup.ts` (formations, quotas, Hungarian assignment,
  rotation planner), `live.ts` (match clock), `fairness.ts`, `budget.ts` (+ scenarios), `ratings.ts`,
  `report.ts`, `seed.ts`. Covered by `__tests__/domain.test.ts`.
- `src/store/` — zustand store persisted with AsyncStorage (localStorage on web).
- `src/ui/` — design kit, charts, pitch.
- `src/app/` — Expo Router screens (`(tabs)` = Home, Squad, Matchday, Finance, Develop).

## Known limits

- **Data is local-first.** There is no account system or cloud sync yet; use Settings → Export / Restore
  to move data between devices. A backend (e.g. Supabase) would slot in behind `src/store/useClub.ts`.
- Age-curve projections and retention scores are simple heuristics, not predictions.
- Bundle ids are placeholders (`app.gaffer.club`); set your own before store submission.
- Native iOS/Android builds were not run in CI here; the web build was exercised end-to-end in a browser.
