# Competitor Teardown (Pattern Benchmark)

## Objective
Extract reusable product patterns for blindfold-chess training UX while avoiding imitation and avoiding low-value complexity.

## Benchmark Set
- Chess.com Vision (S24)
- Lichess puzzle ecosystem/themes (S25)
- Chessable MoveTrainer spacing model (S26)
- Listudy Blind Tactics (S27)
- ChessTempo training workflow (S28)
- Aimchess analytics framing (S29)

## Matrix

| Product | What it does well | Weakness/risk to avoid | Pattern to reuse |
|---|---|---|---|
| Chess.com Vision | Clear drill framing and explicit exercise variants. | Can feel mode-heavy if too many options surface at once. | Keep mode intent obvious; expose options contextually. |
| Lichess Puzzles/Themes | Strong taxonomy and user-understandable tactical categories. | Category density can overwhelm novices. | Use transparent category labels and progressive filter depth. |
| Chessable MoveTrainer | Trusted spaced-review framing and predictable scheduling language. | Scheduling UX can become system-centric instead of user-centric. | Add future-ready cadence cues, but keep user control primary. |
| Listudy Blind Tactics | Extremely focused blindfold interaction with minimal distraction. | Minimalism can under-communicate progress context. | Preserve distraction-free focused loop while retaining essential momentum cues. |
| ChessTempo | Tight feedback loops tied to training outcomes. | Dense interfaces can feel intimidating on mobile. | Keep immediate post-attempt feedback; avoid overloaded layouts. |
| Aimchess | Progress narrative and "what to improve next" value proposition. | Analytics-heavy surfaces risk noise for short sessions. | Keep progress actionable and concise; avoid metric bloat. |

## Synthesis
Patterns to adopt:
1. Intent-first drill framing.
2. Focused recall loop with minimal UI.
3. Immediate feedback and low-friction iteration.
4. Transparent categories for targeted practice.
5. Trend surfaces that guide action.

Patterns to reject:
1. Over-gamification that distracts from deliberate practice.
2. Navigation sprawl or too many first-level modes.
3. Data-dense dashboards without clear "so what?"
4. Complex setup rituals that hurt 5-minute sessions.

## Competitive Positioning Target
BlindfoldExercises should differentiate as:
- the cleanest high-trust blindfold training loop
- best-in-class mobile focused-mode ergonomics
- evidence-backed progress experience for serious improvers
