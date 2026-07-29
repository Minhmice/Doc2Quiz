# Debug: Transition overlay hydration mismatch

**Status:** resolved  
**Component:** `Doc2QuizTransitionOverlay`  
**Symptom:** Hydration failed — server `STOP SCROLLING. START COOKING.` vs client `NEXT PAGE. MOVE.`

## Root cause

`selectedSlogan` was chosen with `Math.random()` inside `useMemo` during render. The overlay mounts on initial load (`PageTransitionProvider` `showOverlay: true`) and in `loading.tsx`, so it SSRs. Server and client each rolled a different index.

## Fix

- Initialize slogan from `message` prop or a fixed `DEFAULT_SLOGAN` (`TRANSITION_MESSAGES[0]`).
- Pick a random line in `useEffect` after hydration when no `message` override is passed.

## Verify

1. Hard refresh `/dashboard` — no hydration warning in console.
2. Navigate between routes — overlay still shows varied slogans.
3. Dashboard `loading.tsx` with explicit `message` prop — unchanged, stable text.
