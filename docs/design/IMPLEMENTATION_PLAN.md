# BlindfoldExercises Redesign Implementation Plan (Codex-Executed, Screenshot-Driven)

## Summary
Implement the full redesign defined in `docs/design/TARGET_EXPERIENCE_SPEC.md` and `docs/design/VISUAL_SYSTEM_SPEC.md` by refactoring the current UI shell, training flow surfaces, focused-mode ergonomics, and progress presentation while preserving existing exercise logic and data model.
Execution will be iterative with evidence: automated captures (`npm run audit:design`) plus Playwright MCP manual walkthroughs on desktop, iPhone, and small Android before each polish pass.

## Scope and Boundaries
1. In scope: visual system, layout hierarchy, control grouping, focused overlay UX, progress UX clarity, accessibility polish, responsive behavior, stable `data-testid` hooks, and E2E design assertions.
2. In scope: minimal internal component/API reshaping required for maintainability.
3. Out of scope: adding new exercises, changing puzzle selection rules, changing sync architecture, changing persistence schema.

## Phase Plan

### 1. Baseline and unblockers
1. Run `npm run audit:design` to establish baseline failures and artifacts.
2. Fix current blocking type error in `src/App.tsx` (`currentStreak` undefined-index guard) before redesign work.
3. Re-run `npm run build` to ensure clean compile baseline.

### 2. UI architecture refactor (no behavior regression)
1. Split `src/App.tsx` into orchestration + presentational sections/components to reduce risk during redesign.
2. Introduce focused UI components in `src/components/`:
   1. `TrainingSetupPanel.tsx`
   2. `RunStatusPanel.tsx`
   3. `FocusedTrainingOverlay.tsx`
   4. `TopBar.tsx`
   5. `TabNav.tsx`
3. Keep exercise/session logic in `src/App.tsx` unchanged except wiring.

### 3. Visual system implementation
1. Rebuild `src/styles.css` around explicit design tokens matching the spec:
   1. typography tokens
   2. spacing scale (4/8 rhythm)
   3. semantic colors (`primary`, `danger`, `warning`, `muted`, `surface-*`)
   4. motion tokens and reduced-motion overrides
2. Normalize component primitives:
   1. button variants and sizes (`>=48px` on mobile primary controls)
   2. form field label/focus/disabled states
   3. panel/card elevations and borders
3. Preserve calm, low-noise background treatment and reduce decorative motion in focused mode.

### 4. Training tab redesign
1. Recompose Training into spec-defined sections:
   1. setup rail (mode/settings/start-end/sync/reset)
   2. active run status (mode/settings/attempts/accuracy/streak/avg time)
   3. feedback and explicit system state messages near affected controls
2. Enforce contextual setup:
   1. puzzle controls only for `puzzle_recall`
   2. destructive actions visually isolated from primary flow
3. Ensure state visibility coverage:
   1. boot/loading
   2. catalog loading
   3. sync in progress
   4. delete in progress
   5. no active session
   6. offline fallback

### 5. Focused mode redesign
1. Keep prompt->reveal->grade loop strict and central.
2. Before reveal: maximum prompt readability, clear side-to-move and context.
3. After reveal: compact continuation + board + grading actions, with reachability on short screens.
4. Maintain sticky/reachable stop control and safe-area aware padding.
5. Ensure no critical control is hidden behind overflow or horizontal scrolling.

### 6. Progress tab redesign
1. Keep two-chart structure with unified visual grammar.
2. Rework filter/summary hierarchy for immediate interpretation:
   1. exercise filter
   2. puzzle category filter
   3. selected context pill + points shown/cap
3. Improve empty/insufficient-data messaging so charts never appear misleading.
4. Keep summary tables but tune density/readability for tablet/mobile.

### 7. Accessibility and cross-device hardening
1. Keyboard-first pass on Training, Focused overlay, and Progress controls.
2. High-contrast focus ring consistency across all actionable elements.
3. Verify reduced-motion behavior removes non-essential animation.
4. Tune breakpoints for:
   1. desktop `>=1024`
   2. tablet `768-1023`
   3. iPhone class `<=430`
   4. small Android class `<=412` with short heights

### 8. Automated and manual design audit loop
1. Run `npm run audit:design`.
2. Inspect artifacts in `test-results/` and `playwright-report/` for layout/visibility regressions.
3. Use Playwright MCP manual flow checks:
   1. Training tab setup + start path
   2. Focused puzzle mode before reveal
   3. Focused puzzle mode after reveal (board + grading reachability)
   4. Progress tab filters + charts + empty states
4. Apply fixes prioritized by severity (critical usability/accessibility first).
5. Re-run `npm run e2e:smoke` and `npm run e2e:design` after each fix batch.
6. Repeat until acceptance criteria pass.

### 9. Finalization
1. Confirm compile/test/e2e green:
   1. `npm run test`
   2. `npm run build`
   3. `npm run e2e:smoke`
   4. `npm run e2e:design`
2. Update `docs/JOURNAL.md` with Done/Next and any design implementation decisions.
3. Update `docs/CONTEXT.md` only if conventions/architecture changed materially.

## Public APIs / Interfaces / Types
1. External/public product API: no change.
2. Internal React interfaces to adjust:
   1. Add typed UI state surface contract in `src/types.ts` for explicit state badges/messages (loading/sync/delete/offline/focused).
   2. Narrow component props for new presentation components to avoid prop leakage from `App`.
   3. Preserve existing domain types (`AttemptRecord`, `SessionRecord`, puzzle settings) unchanged.
3. `data-testid` contract:
   1. preserve existing critical IDs
   2. add IDs only where new structure requires stable E2E anchors

## Test Cases and Scenarios
1. Training startup:
   1. Start available quickly with persisted/default settings.
   2. Puzzle controls visible only in puzzle mode.
2. Focused mode:
   1. Stop control always reachable.
   2. Before reveal: prompt-only state, no auto-reveal.
   3. After reveal: continuation, board, right/wrong visible and tappable on iPhone + small Android.
3. Progress:
   1. Filter switching updates context label and charts correctly.
   2. Insufficient-data states show threshold messaging.
4. Accessibility:
   1. Keyboard navigation through core flows.
   2. Visible focus indicators.
   3. Reduced-motion preference respected.
5. Regression:
   1. Session lifecycle unaffected by visual refactor.
   2. Sync/delete feedback remains contextual and actionable.

## Assumptions and Defaults
1. Keep dark premium-minimal direction already present; refine rather than replace with a new brand direction.
2. Keep current font strategy unless licensing/performance forces change.
3. Do not introduce new runtime dependencies unless necessary for accessibility compliance.
4. Maintain current two-tab IA and two-drill scope exactly.
5. Treat existing typecheck failure in `src/App.tsx` as priority-zero unblocker before redesign iterations.
