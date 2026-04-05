# Handoff Template

```markdown
Objective:
- <what this child agent must achieve>

ScopeIn:
- <included files/modules/decisions>

ScopeOut:
- <explicit exclusions>

Inputs:
- <docs, diffs, constraints, prior outputs>

Constraints:
- <time/tool/policy/safety limits>

ExpectedOutput:
- <exact artifact format expected>

DueCondition:
- <what makes this handoff complete>
```

## Fan-out handoff (optional)

When using same-skill parallel instances (see SKILL-DETAILS § Fan-out), add:

```markdown
InstanceId: <instance-1 | instance-2 | instance-3>

SharedContext:
- <design tokens / theme name / API contract / shared config — same for all instances; keep minimal>
```

## Multi-subphase handoff (optional)

When using `SKILL-DETAILS.md` § Heavy phase expansion, add:

```markdown
SubphaseId: <subphase-1 | subphase-2 | ...>
SubphaseGoal: <what this subphase must achieve>
DependsOn:
- <prior subphase outputs required (if any)>
```
