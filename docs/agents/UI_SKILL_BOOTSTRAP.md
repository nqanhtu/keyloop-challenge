# UI Agent Skill Bootstrap

This file is the authoritative bootstrap for specialized UI skills used by the autonomous redesign workflow.

The skills are project-local procedural guidance. They do not supersede repository design authority.

## Required Skills

Install only these four unless a later accepted decision changes the set.

### 1. Design-system and frontend architecture

Purpose:

- convert the approved UI System Design into reusable tokens, components, layout rules, state behavior, and maintainable frontend architecture;
- review component boundaries and CSS/system consistency.

Install:

    npx skills add https://github.com/hueyexe/frontend-agent-skills --skill design-systems-frontend-architecture

### 2. Frontend visual design

Purpose:

- execute a distinctive, production-grade visual redesign;
- avoid generic AI/SaaS visual defaults;
- improve typography, spacing, composition, semantic color, and interaction polish.

Install:

    npx skills add https://github.com/anthropics/skills --skill frontend-design

### 3. Accessibility audit and fixes

Purpose:

- independently audit and fix WCAG-oriented frontend accessibility issues;
- cover keyboard, focus, semantics, validation, responsive accessibility, and screen-reader behavior.

Install:

    npx skills add https://github.com/neha/check-fix-accessibility --skill check-fix-accessibility

### 4. Web-app/browser testing

Purpose:

- support real-browser local-app reconnaissance and interaction;
- complement the repository Playwright suite with exploratory browser verification.

Install:

    npx skills add https://github.com/anthropics/skills --skill webapp-testing

## Bootstrap Procedure

From the repository root:

1. Inspect skills-lock.json and .agents/skills/.
2. Install only missing required skills using the exact commands above.
3. Allow the skills CLI to update project-local skill files and skills-lock.json.
4. Do not manually invent or edit lock hashes.
5. Inspect the resulting diff.
6. Reject unexpected skills, unrelated files, global installation, or source-code changes from bootstrap.
7. Commit the bootstrap changes separately from product UI changes.

If an install command or CLI behavior has changed, consult the current npx skills --help / npx skills add --help rather than guessing flags.

## Progressive Disclosure

Do not load all UI skills into every role.

Use:

    UI architecture/planning
      -> design-systems-frontend-architecture

    visual implementation/review
      -> frontend-design

    accessibility audit
      -> check-fix-accessibility

    browser exploratory verification
      -> webapp-testing

Load a second skill only when the current role genuinely needs both.

## Authority

Read before applying skill guidance:

    docs/system-design/system-design-v1.md
    docs/ui-system-design/ui-system-design-v1.md
    docs/decisions/0003-ui-system-design-authority.md

If generic skill advice conflicts with repository authority, repository authority wins.

## Browser Use

If the current Codex/desktop environment exposes native Browser Use or Chrome control, use it for exploratory visual QA when useful.

If it is unavailable, do not block solely for that reason. Use the repository Playwright suite and the web-app testing skill for browser proof.

Native browser/manual-like exploration never replaces the deterministic Playwright release gate.
