# Validation Runbook

1. Run `npm run agents:validate`.
2. Run `npm run agents:test-search`.
3. Open `.cursor/agents/validation/benchmark-suite.md`.
4. Execute each scenario as a prompt to the orchestrator.
5. Record selected route and whether contract fields were present.
6. Verify review + QA gates were enforced where required.
7. Log outcomes in `.cursor/agents/validation/latest-results.md`.
8. If any scenario fails, update routing rules, mappings, or curated knowledge before rerunning validation.
