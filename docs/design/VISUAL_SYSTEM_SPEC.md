# Visual System Spec (Premium Minimal Training Lab)

## Brand Direction
Tone:
- focused
- modern
- high-trust
- calm under pressure

The interface should feel like a precision training tool, not a casual game portal.

## Visual Language
- Strong hierarchy with restrained ornament.
- Dense enough for serious users, never cluttered.
- Contrast-rich for long sessions.
- Motion used for orientation, not spectacle.

## Typography System
- Display/heading family: geometric or humanist sans with personality (non-default system feel).
- Body/UI family: highly legible sans for compact controls and labels.
- Monospace: reserved for notation-like content (move text, technical labels).

Rules:
- Heading scale: clear, predictable steps.
- Body default optimized for prolonged reading on mobile.
- Avoid ultra-light weights in training-critical surfaces.

## Color System
- Neutral deep base surfaces + one primary accent + one danger + one warning.
- Accent is semantic, not decorative:
  - primary action
  - active selection
  - positive state

Requirements:
- Meet WCAG contrast expectations for text and controls.
- Do not rely on color alone for correctness or state.

## Spacing and Layout
- Use 4/8-based spacing rhythm.
- Maintain stable component paddings across states to avoid layout jitter.
- Preserve generous vertical rhythm in focused mode for touch reliability.

## Component Rules

## Buttons
- Primary CTA visually dominant.
- Secondary actions clearly subdued.
- Destructive actions isolated and color-coded consistently.
- Mobile target baseline: >=48px equivalent for primary actions.

## Form Controls
- Labels always visible (no placeholder-only labels).
- Focus ring always visible and high contrast.
- Disabled state is distinct but readable.

## Cards/Panels
- Training card is the visual anchor in focused mode.
- Momentum metrics remain compact, scannable, and low noise.
- Background layers should never fight content readability.

## Data Visualization
- Accuracy and speed charts share visual grammar.
- Axis labels readable on mobile without pinch zoom.
- Empty states explain threshold clearly.

## Motion System
- Micro-transitions for state continuity only.
- Keep durations short and consistent.
- Under reduced-motion preference:
  - remove non-essential animation
  - keep immediate state changes clear

## Content Tone
- Direct, instructional, concise.
- No celebratory bloat during training loop.
- Feedback language should reinforce competence and control.

## Anti-Patterns (Do Not Introduce)
1. Cosmetic complexity that adds no training value.
2. Ambiguous CTA hierarchy in active drills.
3. Hidden critical controls behind gestures or overflow menus.
4. Over-animated backgrounds in focused mode.
5. Progress dashboards that require interpretation training.
6. Color-only correctness signaling.
7. Inconsistent component behavior across tabs/device sizes.

## Visual QA Checklist
1. Is the primary action obvious in under 1 second?
2. Are touch targets reliably tappable on small phones?
3. Does focused mode feel quieter than setup/progress surfaces?
4. Can users identify active state and next action instantly?
5. Does the interface still feel premium with reduced motion enabled?
