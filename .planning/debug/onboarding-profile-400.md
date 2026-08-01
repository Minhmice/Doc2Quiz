---
status: verifying
trigger: "Investigate current bug: PATCH /api/profile returns 400 when onboarding saves preferences, UI says Could not save your preferences. Work in C:\\Users\\minhmice\\Documents\\projects\\Doc2Quiz."
created: 2026-07-31T18:02:00+07:00
updated: 2026-07-31T18:31:00+07:00
---

## Current Focus

hypothesis: Skipping onboarding identity or commitment leaves empty-string fields in form; PATCH route rejects those empty strings as invalid enum values.
test: Compare skip behavior with route enum validation, then omit empty optional selections from onboarding payload.
expecting: Payload after skipping identity/commitment no longer contains invalid empty enum values; route accepts request.
next_action: Run typecheck and focused profile tests after replacing client-side navigation with a full reload.
reasoning_checkpoint:
  hypothesis: "Onboarding returns 400 because skip leaves studyIdentity or commitment as empty strings, and profile route rejects empty strings against its enum validation."
  confirming_evidence:
    - "Form initializes studyIdentity and commitment to empty strings."
    - "Skip advances steps without assigning values; final request spreads entire form."
    - "PATCH route rejects any provided studyIdentity/commitment not in enum, including empty string."
  falsification_test: "Send final onboarding payload after skipping identity and commitment; if route accepts empty strings or 400 comes from another branch, hypothesis is wrong."
  fix_rationale: "Omit unselected optional onboarding choices from request; route then sees only valid selected values and existing completion fields."
  blind_spots: "Could not execute authenticated Supabase route end-to-end; database schema errors would return 500, not reported 400."

## Symptoms

expected: Onboarding saves preferences and redirects to /create.
actual: PATCH /api/profile returns 400; UI shows Could not save your preferences.
errors: PATCH /api/profile 400; Could not save your preferences.
reproduction: Complete onboarding name, identity, commitment, coach steps; click Start studying. Also skip identity or commitment to trigger empty-string payload.
started: Current bug.

## Eliminated

- hypothesis: Client sends invalid selected enum values by default.
  evidence: Defaults coachMode to balanced; selected identity and commitment values match route enums. Failure requires skipped steps, which preserve empty strings.
  timestamp: 2026-07-31T18:09:00+07:00

## Evidence

- timestamp: 2026-07-31T18:02:00+07:00
  checked: OnboardingClient.tsx payload
  found: Form initializes studyIdentity and commitment to empty strings; skip only advances step; final request spreads form.
  implication: Skipped choices are sent as empty strings.
- timestamp: 2026-07-31T18:02:00+07:00
  checked: src/app/api/profile/route.ts validation
  found: studyIdentity and commitment must match non-empty enum lists when defined.
  implication: Empty skipped values produce 400 Invalid study identity or Invalid commitment.
- timestamp: 2026-07-31T18:09:00+07:00
  checked: Route status branches
  found: Validation failures return 400; Supabase upsert failures return 500.
  implication: Empty enum value is consistent with observed 400 and UI's generic error.
- timestamp: 2026-07-31T18:28:00+07:00
  checked: onboarding success navigation and app route gate
  found: PATCH persists onboarding_completed_at, then router.replace("/create") performs client navigation while layout gate can reuse stale server-rendered profile data; browser hard navigation reloads profile state before /create gate evaluates.
  implication: A successful PATCH can be followed by stale layout redirect to /onboarding even though persistence succeeded.

## Resolution

root_cause: Onboarding PATCH persistence succeeds, but router.replace("/create") uses client navigation immediately after a server layout gate read. The gate can evaluate stale profile data with onboarding_completed_at still null and redirect back to /onboarding. Current client already omits empty skipped enum fields, so prior 400 hypothesis does not explain reported 200.
fix: Replace client-side router navigation with window.location.assign("/create") so the post-PATCH route gate performs fresh server evaluation against persisted profile state.
verification: Typecheck passed. Focused profile route suite passed 27 tests. Browser-authenticated end-to-end verification remains required to confirm no redirect loop in deployed Supabase environment.
test: []
files_changed: [src/app/onboarding/OnboardingClient.tsx]
