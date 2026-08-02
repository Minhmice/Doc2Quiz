# Spike Conventions

Patterns and stack choices established across spike sessions.

## Stack

- Use existing Next.js + TypeScript application boundaries for integration questions.
- Use Node.js built-ins for protocol simulations when production dependencies are not yet approved.
- Do not install infrastructure dependencies or create deployment contracts inside a feasibility spike.

## Structure

- Each spike lives under `.planning/spikes/NNN-descriptive-name/`.
- `README.md` records Given/When/Then validation, research, run instructions, investigation trail, verdict, and evidence threshold.
- Runnable simulations stay beside the README and must print a stable pass/fail sentinel.

## Patterns

- Treat realtime payloads as invalidation hints. Authenticated HTTP or durable storage remains display authority.
- Test TTL expiry, reconnect/multi-session behavior, failure fallback, privacy boundaries, and rate limiting—not only the happy path.
- Mark infrastructure spikes `PARTIAL` until disposable real-service behavior and load evidence are available.

## Tools & Libraries

- Prefer Node.js standard library for no-dependency simulations.
- Redis production integration remains unselected until the spike proves the key, TTL, batching, and failure contracts.
