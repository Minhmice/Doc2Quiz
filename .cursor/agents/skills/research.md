# Skill: Research

## Job (what this skill must do)

Research external or open-ended questions: compare options, best practices, tradeoffs, or unknowns. Produce evidence-based summaries and recommendations. Do not implement; only research and report.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/research-analyst/SKILL.md` — act as **research-analyst**.
- **Context**: Research question; constraints (stack, timeline); what is already known in the repo.
- **Specialist search**: `python3 .cursor/agents/specialists/research-analyst/scripts/search.py "<query>"` for local curated research and tradeoff guidance.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: User asks to compare, evaluate, or find best practice; open-ended or external question needing structured research; analytics, SEO, trends, tools, content/channel strategy when research (not implementation) is the ask.
- **Do not invoke when**: Implementation (use specialists); planning (use planner); scope (use product-manager).
- **Critical rules**: (1) Evidence-based: summarize findings with sources or evidence; recommendations and tradeoffs; residual unknowns. (2) Do not implement; only research and report. (3) Consider constraints (stack, timeline) and what is already in the repo.
- **Boundaries**: Research and report only; hand off to planner or specialists for execution.

## When to use this skill

- User asks to compare, evaluate, or find best practice.
- Question is external or unknown and needs structured research.

## Do not use for

- Implementation (use specialists); planning (use planner); scope (use product-manager).

## Output / done

- Summary of findings with sources or evidence.
- Recommendations and tradeoffs; residual unknowns.

## Handoff

When delegating: "Act as research-analyst per .cursor/agents/specialists/research-analyst/SKILL.md. Job and inputs: .cursor/agents/skills/research.md. Question: [research question]."
