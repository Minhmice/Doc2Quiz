# Skill: Google CLI (gws)

## Job (what this skill must do)

Work on Google Workspace CLI (gws): discovery, auth, commands, validation, and related services. Own gws-specific code and behavior; align with contracts and types when needed (use typescript-specialist in parallel if contract-heavy).

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/google-cli-specialist/SKILL.md` — act as **google-cli-specialist**.
- **Context**: gws code paths (e.g. discovery, auth, commands, validate); contracts and CLI surface; repo layout for gws.
- **Specialist search**: `python3 .cursor/agents/specialists/google-cli-specialist/scripts/search.py "<query>"` for local curated gws CLI guidance.

## Guidance (invoke when, critical rules, boundaries)

Invoke when: task involves gws CLI, Google Workspace integration, discovery, auth, or commands. Align with contracts and types; use typescript-specialist in parallel if contract-heavy. Do not use for general backend API or frontend.

## When to use this skill

- Task involves gws CLI, Google Workspace integration, discovery, auth, or commands.
- User mentions gws, google workspace CLI, or related keywords.

## Do not use for

- General backend API (use backend skill); general frontend (use frontend skill). For contract alignment, run typescript-specialist or code-reviewer in parallel as needed.

## Output / done

- gws-related code changes and validation.
- Contract/CLI alignment notes if applicable.

## Handoff

When delegating: "Act as google-cli-specialist per .cursor/agents/specialists/google-cli-specialist/SKILL.md. Job and inputs: .cursor/agents/skills/google-cli.md. Scope: [files/task]."
