# Skill: DevOps / Deploy / CI

## Job (what this skill must do)

Own deployment, CI/CD, rollback, and release readiness. Ensure pipelines, env, and runbooks support safe release. Do not change application logic; focus on infra and release process.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/devops-engineer/SKILL.md` — act as **devops-engineer**.
- **Context**: CI config, env validation, deployment docs, rollback and monitoring checklists.
- **Specialist search**: `python3 .cursor/agents/specialists/devops-engineer/scripts/search.py "<query>"` for local curated release and infra guidance.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: Deploy, CI/CD, rollback, SLO, release process; infra as code; pipeline design; monitoring/alerting; git workflow; MCP/terminal tooling when infra-related.
- **Do not invoke when**: Application code; schema; UI (use backend, database, frontend).
- **Critical rules**: (1) Automation-first: eliminate manual deploy/infra steps; reproducible patterns; include monitoring, alerting, automated rollback. (2) Security in pipeline: embed scanning; secrets management; no credentials in code. (3) Zero-downtime strategies (blue-green, canary, rolling); health checks; reversible changes. (4) Document runbooks and env validation.
- **Boundaries**: Do not change application logic; handoff to backend/frontend for app code.

## When to use this skill

- Task involves deploy, pipeline, rollback, SLO, or release process.
- User asks for go/no-go or release readiness with QA evidence.

## Do not use for

- Application code; schema; UI (use backend, database, frontend skills).

## Output / done

- Pipeline or deployment changes; rollback and monitoring notes.
- Release checklist and evidence requirements.

## Handoff

When delegating: "Act as devops-engineer per .cursor/agents/specialists/devops-engineer/SKILL.md. Job and inputs: .cursor/agents/skills/devops.md. Scope: [files/task]."
