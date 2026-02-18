# BlindfoldExercises Agent Rules

## Default Execution Rule

When the user asks for UI/UX/design evaluation, visual polish, responsiveness checks, or "critically evaluate the design", do the full audit loop automatically without asking for extra setup.

## Full Audit Loop (Run In This Order)

1. Run `npm run audit:design`.
2. Inspect generated Playwright outputs in `test-results/` and `playwright-report/`.
3. Use Playwright MCP tools to manually navigate key flows and verify behavior:
   - Training tab
   - Focused puzzle mode (before/after reveal)
   - Progress tab
4. Apply code/CSS fixes.
5. Re-run `npm run e2e:smoke` and `npm run e2e:design`.
6. Report concrete findings first (severity ordered), then fixes, then any residual risks.

## Key Expectations

- Do not stop at static code review for design requests.
- Always include mobile checks (iPhone + small Android emulation).
- Use `data-testid` selectors for interaction stability.
- Use screenshots/traces as evidence for findings.
