# Decision Matrix (Traceability)

## Format
`Decision -> Supporting source IDs -> Product rule -> Expected impact -> Acceptance signal`

| Decision | Source IDs | Product rule | Expected impact | Acceptance signal |
|---|---|---|---|---|
| Keep 2 top-level tabs only (`Training`, `Progress`) | S09, S12 | Maintain shallow IA and clear primary jobs. | Faster orientation and lower navigation cost. | Users reach target task in <=2 taps from app load. |
| Prioritize 5-minute session startup | S17, S19 | Preserve settings and streamline start path. | Higher session completion frequency. | Start-to-first-attempt time remains consistently low. |
| Recall-before-reveal as core loop | S16, S18, S19 | Require mental attempt prior to reveal. | Better long-term retention transfer. | Puzzle flow always begins with prompt-only recall state. |
| Focused mode as default active-run context | S10, S27 | Remove non-essential chrome while running drills. | Lower cognitive noise and better concentration. | During runs, only training-essential controls are visible. |
| Mobile primary controls at >=48px target baseline | S02, S03, S04, S05, S06 | Enforce large touch targets and spacing. | Fewer mis-taps; better one-handed use. | Critical controls pass viewport reachability checks on iPhone and small Android. |
| Keep keyboard-first operability and visible focus | S01, S07 | Define deterministic keyboard order and focus style. | Better accessibility and desktop efficiency. | Training and progress critical actions are reachable and visible via keyboard only. |
| Minimize non-essential motion | S08, S15 | Motion supports orientation, not decoration. | Lower fatigue and motion sensitivity issues. | Reduced-motion mode removes non-critical animation. |
| Preserve explicit state feedback (loading/sync/delete) | S09, S11 | Surface system status near affected controls. | Higher trust and lower confusion. | No hidden state transitions during sync/session lifecycle. |
| Keep puzzle difficulty semantically transparent | S20, S21, S22, S25 | Use interpretable settings (piece count, rating bucket). | Better user control and challenge calibration. | Users can explain selected difficulty in concrete terms. |
| Progress emphasizes trends over vanity totals | S23, S28, S29 | Show direction and category context first. | Better competence perception and training decisions. | Progress screen clearly communicates "improving/not improving" at a glance. |
| Design for cross-device consistency with adaptive layout | S06, S12, S13 | Keep same mental model; adapt arrangement only. | Easier multi-device continuity. | No tab/function mismatch between desktop and mobile. |
| Keep extensibility contract for future drills | S09, S25 | New drills must fit setup -> focused loop -> progress pattern. | Scalable product growth without IA churn. | Future drill can be introduced without adding top-level nav. |

## Priority Stack
1. Accessibility and mobile ergonomics decisions.
2. Learning efficacy decisions.
3. Clarity/performance decisions.
4. Competitive differentiation decisions.
