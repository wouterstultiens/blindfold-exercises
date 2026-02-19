# Design Principles (Evidence-Derived)

## 1) Recall First, Reveal Second
- Evidence: S16, S18, S19
- Rule: Every training interaction starts with retrieval effort before any answer exposure.
- UI implication: In puzzle recall, "View Answer" is explicitly gated behind initial mental reconstruction.
- Acceptance signal: No default auto-reveal states in focused training flow.

## 2) Short Sessions Are First-Class
- Evidence: S17, S19
- Rule: Optimize for effective 5-minute sessions, not only long sessions.
- UI implication: Fast start path, persistent settings, and immediate next-item transitions.
- Acceptance signal: User can start and complete at least 3 attempts in under 5 minutes without deep navigation.

## 3) Frictionless Core Loop
- Evidence: S11, S14, S15
- Rule: Answer, feedback, and next-item transitions must feel immediate.
- UI implication: Primary buttons are always visible and responsive in focused mode.
- Acceptance signal: Key interactions stay within responsive latency budgets for modern devices.

## 4) Premium Minimalism, Not Sterile Minimalism
- Evidence: S09, S10, S23
- Rule: Reduce clutter but preserve orientation, confidence, and momentum context.
- UI implication: Keep only critical session metrics visible during drills; defer secondary stats.
- Acceptance signal: Core actions remain obvious without introducing secondary panels during active recall.

## 5) Mobile Ergonomics Is a Hard Constraint
- Evidence: S02, S03, S04, S05, S06
- Rule: Touch reliability and thumb reach define control placement and sizing.
- UI implication: Critical action targets >=48px equivalent on mobile, with safe spacing.
- Acceptance signal: No critical controls require precision tapping or horizontal panning.

## 6) Accessibility Equals Product Quality
- Evidence: S01, S07, S08
- Rule: Keyboard access, focus visibility, contrast, and reduced-motion support are baseline.
- UI implication: Predictable tab/focus order and reduced-motion-aware transitions everywhere.
- Acceptance signal: Critical flows are operable without pointer input and without motion dependence.

## 7) Status Visibility Without Noise
- Evidence: S09, S11
- Rule: Users always know system state (active run, loading, synced/deleted state) with minimal interruption.
- UI implication: Clear state labels and micro-feedback near relevant controls.
- Acceptance signal: No hidden background state changes for sync/session lifecycle.

## 8) Progressive Disclosure for Setup Complexity
- Evidence: S10, S12
- Rule: Show only settings required for the current drill/context.
- UI implication: Puzzle-specific controls appear only in puzzle mode; advanced filters stay contextual.
- Acceptance signal: First-time flow remains understandable in one screen.

## 9) Meaningful Challenge Over Arbitrary Difficulty
- Evidence: S20, S21, S22, S25
- Rule: Difficulty controls should map to meaningful chess structure (piece count, rating bucket, tactical quality).
- UI implication: Keep transparent drill parameters and avoid opaque "difficulty scores."
- Acceptance signal: User can explain why a given puzzle set is easier/harder.

## 10) Competence-Oriented Feedback
- Evidence: S23, S28, S29
- Rule: Feedback should build skill awareness, not vanity metrics.
- UI implication: Progress emphasizes trend quality and training recommendations over raw totals.
- Acceptance signal: Progress screen answers "what is improving" and "what to train next."

## 11) Consistency Across Devices
- Evidence: S06, S12, S13
- Rule: Same mental model across desktop and mobile, with layout adaptation only.
- UI implication: Training and Progress IA remain stable; only component arrangement changes.
- Acceptance signal: User can switch devices without relearning navigation.

## 12) Future Drill Extensibility Without Redesign
- Evidence: S09, S25
- Rule: Interaction framework must allow new drills without IA collapse.
- UI implication: Drill model uses reusable setup, focused loop, and progress categorization patterns.
- Acceptance signal: New drill can reuse existing shell with minimal unique chrome.
