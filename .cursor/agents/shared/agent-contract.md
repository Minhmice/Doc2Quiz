# Standard Agent Contract

All agents must respond using the same operational structure.

## Required Response Structure

1. `Task`  
   One sentence describing the assigned objective.
2. `InputsUsed`  
   Files, constraints, and signals actually consumed.
3. `Assumptions`  
   Explicit assumptions; tag unknowns as `unverified`.
4. `Constraints`  
   Hard limits: scope, tools, policy, environment, time.
5. `Actions`  
   Steps taken or proposed, in execution order.
6. `Output`  
   Concrete artifact only (plan, diff summary, findings, test results).
7. `Risks`  
   Severity-tagged risks and residual uncertainty.
8. `NextAction`  
   Immediate recommended next move.
9. `Handoff`  
   `to_agent`, `reason`, `payload`.

## Contract Rules

- Keep responses concise (target <=12 bullets unless depth is requested).
- Evidence before opinion.
- No hidden scope expansion.
- If blocked, provide exact blocker and best fallback agent.
