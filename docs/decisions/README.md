# Decisions

Decision records preserve lasting product, architecture, data ownership,
security, compatibility, and validation choices that future work must inherit.

Use `docs/templates/decision.md`. Task-local implementation choices remain in
the active execution plan and do not require a separate decision.

An installed consumer begins with no fabricated decisions. Add local decision
documents here as real choices are accepted, then index them in this file.

## Accepted

- [0001 Mock Implementation Baseline](0001-mock-implementation-baseline.md) — current-inventory/action eligibility semantics, optional-note validation boundary, deterministic demo timezone/freshness defaults, and trusted mock authorization context for the frontend challenge.
- [0002 — DeepSeek-Only Autonomous Runtime](0002-deepseek-only-autonomous-runtime.md): makes `deepseek-flash/high` the active provider for all separated workflow roles while preserving evidence, branching, and fresh-session independence.
- [0003 — UI System Design Authority and Autonomous Redesign](0003-ui-system-design-authority.md): establishes a separate UI design authority, specialized UI skill bootstrap, autonomous redesign workflow, and automatic cleanup of completed Herdr child panes.
