---
name: pr
description: >-
  Run this project's pre-PR quality gate (Vitest, oxlint/ESLint, Prettier,
  code review) and then create a pull request with a structured summary.
  Use when the user says "create a PR", "open a PR", "submit for review", or
  "I'm done with this feature".
argument-hint: "[--skip-review] [--draft] [--base <branch>]"
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git *), Bash(gh *), Bash(npm *), Bash(npx *), Skill(code-review *)
---

# Pull Request — eclipse-photo-timer

Project-specific quality gate for this repo. No TypeScript, so there is no
type-check step. Otherwise follows the dev-team `/pr` orchestrator flow
(pre-flight checks, quality gate, PR summary generation, `gh pr create`,
auto-merge).

## Quality gate commands

1. **Tests**: `npm test` (Vitest)
2. **Lint**: `npm run lint:deep` (full ESLint pass — functional/React-hooks
   rules); `npm run lint` (oxlint) is the fast day-to-day check already
   enforced on commit via `lint-staged`
3. **Format check**: `npm run format:check` (Prettier)
4. **E2E** (optional, slower): `npm run test:e2e` (Playwright)
5. **Code review** (unless `--skip-review`): `/code-review --since "$BASE" --json`

No type-check step — this project is plain JavaScript (see
`.claude/project-stack.json`).

For the full pre-PR flow (pre-flight checks, PR summary generation,
Decisions & Assumptions, Evidence Bundle, `gh pr create`, auto-merge), follow
the dev-team `pr` skill's steps, substituting the commands above wherever it
says "detect the project's test/lint/typecheck commands."
