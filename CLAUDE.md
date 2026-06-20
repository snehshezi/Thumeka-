<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **thumeka** (2583 symbols, 5007 relationships, 213 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/thumeka/context` | Codebase overview, check index freshness |
| `gitnexus://repo/thumeka/clusters` | All functional areas |
| `gitnexus://repo/thumeka/processes` | All execution flows |
| `gitnexus://repo/thumeka/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# Working on this project

## Branch workflow

- Substantive features go on a `feature/<short-name>` branch — not directly on `main`.
- Each branch gets a PR back to `main`. PRs should land green: `npm run lint && npm test && npm run build` clean.
- After review, squash-merge to `main`.
- One-line hotfixes (typos, copy tweaks) can still land directly on `main`, but only with explicit "ship to main" authorisation in the same turn.
- `main` is what's deployed on Plesk; never push half-done work there.

When in doubt: start with `git checkout -b feature/<name>` before the first edit, and finish with a push + PR. Don't ask permission to make the branch — just make it.
