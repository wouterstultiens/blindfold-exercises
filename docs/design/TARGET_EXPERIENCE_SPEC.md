# Target Experience Spec (Magnum Opus - Design Target)

## Product Intent
BlindfoldExercises should feel like a premium training instrument for serious improvers:
- fast to enter
- cognitively focused
- confidence-building
- repeatable daily

Scope remains two drills:
- `square_color`
- `puzzle_recall`

The spec is extensible to future drills by reusing the same UX framework.

## North-Star Experience Qualities
1. Immediate: Start training in seconds.
2. Focused: No irrelevant UI during recall.
3. Trustworthy: Clear state, no ambiguity.
4. Competence-oriented: Progress reveals skill development, not vanity.
5. Cross-device reliable: Same model, optimized per viewport.

## Information Architecture

## Top Level
- `Training`
- `Progress`

No additional top-level sections in this phase.

## Training Substructure
1. Setup rail
- mode selector
- contextual puzzle settings
- start/end/sync/reset controls

2. Active run status
- concise momentum metrics
- explicit run mode/settings

3. Focused mode overlay
- isolated active exercise loop
- stop control always reachable

## Progress Substructure
1. Trend filters
- exercise type
- puzzle category filter

2. Trend charts
- accuracy trend
- speed trend

3. Summary tables
- attempts/sessions/category breakdowns

## Canonical User Journeys

## Journey A: 5-Minute Session
1. Open app.
2. Training setup already pre-populated from last run.
3. Press `Start`.
4. Complete 3-8 attempts quickly in focused mode.
5. Stop and see immediate competence snapshot.

Success criteria:
- no setup confusion
- no hidden state transitions
- no control reachability issues on phone

## Journey B: 20-Minute Session
1. Choose drill and puzzle settings.
2. Run multiple recall cycles.
3. End session intentionally.
4. Open Progress and verify trend direction.

Success criteria:
- stable rhythm with minimal interaction overhead
- progress screen clarifies trend without deep drill-down

## Journey C: 45-Minute Deep Practice
1. Enter focused mode and sustain long run.
2. Maintain clarity on momentum without leaving drill flow.
3. End session and inspect category-specific trends.

Success criteria:
- no visual fatigue from excessive motion/noise
- clear metric interpretation over long run

## Training Experience Specification

## Setup Zone
- Mode control is first decision and highest visual priority.
- Puzzle-specific controls only appear for `puzzle_recall`.
- Start CTA remains prominent and stable in location.
- Destructive controls (`Delete`, reset) are visually separated from primary flow.

## In-Run Behavior
- Enter focused overlay on start.
- Always show:
  - run mode
  - attempts, accuracy, streak, avg response time
  - stop control
- Keep training card central with maximal readability and touchability.

## Puzzle Recall Loop
1. Prompt state:
- side to move
- piece list
- puzzle context (piece/rating bucket)
- single `View Answer` CTA

2. Reveal state:
- continuation text
- board view
- two grading CTAs (right/wrong)

3. Post-grade state:
- immediate transition to next prompt
- optional micro-feedback without modal interruption

## Square Color Loop
1. Prompt question in high legibility.
2. Two answer CTAs with symmetric prominence.
3. Immediate correctness feedback and next item.

## Progress Experience Specification

## Filters
- Default filter respects current training mode context when possible.
- Puzzle category list sorted by piece count then rating bucket.
- "All categories" remains available as global summary baseline.

## Charts
- Accuracy and speed are paired, consistent visual structure.
- Show trailing moving average context and point counts.
- If insufficient data:
  - display explicit threshold message
  - never show misleading empty chart scaffolds

## Interpretation Layer
Progress screen must always answer:
1. Are you improving?
2. In what category?
3. What should you train next?

Current phase focuses on (1) and (2) in-product; (3) is reserved as future enhancement hook.

## Interaction and Motion Rules
- Motion is supportive, never decorative-first.
- Use subtle entrance/transition only where it preserves orientation.
- Reduced-motion preference disables non-essential animation.
- No heavy parallax or persistent animated backgrounds during focused training.

## State Model Requirements

## Required Explicit States
- boot/loading
- catalog loading
- sync in progress
- delete in progress
- focused run active
- no active session
- network offline fallback

Each state must have visible user-facing feedback near affected controls.

## Error Behavior
- Errors are contextual and actionable.
- Never trap user in focused mode on load failure.
- Preserve user control: allow retry/start over without reload.

## Cross-Device Specifications

## Desktop (>=1024px)
- two-column density acceptable for progress summaries
- focused shell centered with clear max width
- maintain one-glance state visibility

## Tablet (768-1023px)
- preserve hierarchy but reduce side-by-side density
- avoid tiny labels and overly compressed control bars

## iPhone Class (<=430px)
- thumb-reachable primary actions
- no critical control below unsafe scroll trap
- safe-area aware spacing at top/bottom

## Small Android Class (<=412px and short heights)
- maintain >=48dp primary targets
- ensure reveal + board + grading controls remain reachable
- avoid horizontal overflow in critical training controls

## Future Drill Extensibility Contract
Any new drill should plug into:
1. Setup pattern (contextual controls)
2. Focused loop pattern (prompt -> user action -> feedback -> next)
3. Progress categorization pattern (drill + category filters)

No new drill should require introducing a third top-level navigation area in current IA.

## Acceptance Criteria (Design Target)
1. Primary training loop can be completed one-handed on phones.
2. Focused mode controls remain reachable before and after reveal.
3. Training state and sync/deletion state are always visible.
4. Progress charts communicate trend direction without explanation text from support docs.
5. Visual style reads as premium/professional, with minimal distraction and consistent hierarchy.
