# Delegation Matrix

| Task Type | Primary Agent | Fallback Agent | Split into Multiple Agents When | Keep Single-Agent When |
|---|---|---|---|---|
| Product clarification | `product-manager` | `planner` | requirements and technical constraints are both unclear | request is small and acceptance is explicit |
| Solution planning | `planner` | `orchestrator` | feature spans FE/BE/DB and has rollout risk | one-file or one-module change |
| External or unknown research | `research-analyst` | domain specialist | independent research questions can run in parallel | one narrow question |
| Frontend implementation | `frontend-developer` | `typescript-specialist` or `code-reviewer` | API contract also changes → add `backend-developer` in parallel | API contract is frozen |
| Translations / i18n / locale | `frontend-developer` | — | — | Attach `.cursor/agents/skills/i18n.md` in handoff |
| shadcn/ui (add/customize component, components.json) | `frontend-developer` | — | — | Shadcn in `frontend.md` § Shadcn/ui |
| Backend implementation | `backend-developer` | `typescript-specialist` | DB migration or FE integration → add `database-specialist` or `frontend-developer` | API-only internal change |
| Typing and contract hardening | `typescript-specialist` | `backend-developer` + `frontend-developer` (follow-up) | contracts affect FE and BE together | localized type fix |
| Schema, migration, RLS | `database-specialist` | `backend-developer` (sequential follow-up) | migration needs compatibility sequencing | no schema impact |
| Bug triage and fix | `debugger` | owning specialist | flaky or cross-layer issue | deterministic single-layer defect |
| Code quality review | `code-reviewer` | `orchestrator` | high-risk changes need QA pairing | low-risk documentation-only change |
| Security review / audit | `security-specialist` | `code-reviewer` | when security findings affect multiple components (FE, BE, DB) → add respective developers | isolated security fix can be handled by `code-reviewer` alone
| QA validation | `qa-tester` | implementer (smoke only) | staging or deploy checks are needed | local behavior smoke test only |
| Release and deployment | `devops-engineer` | `orchestrator` | go/no-go decision requires QA evidence | no deploy impact |
| Documentation | `documentation-writer` | owning specialist | API docs, runbook, and changelog all changed | tiny inline doc adjustment |
| gws CLI / Google Workspace CLI | `google-cli-specialist` | `typescript-specialist` or `code-reviewer` | discovery, auth, commands, validation, new services | single-file trivial fix |
