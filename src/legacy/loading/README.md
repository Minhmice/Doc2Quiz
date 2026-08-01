# Legacy loading animations

Animated loading UI removed from the main app (quieter pass). Preserved here for reference and demo routes.

## Components

- `doc2quiz-animated-loading.tsx` — full-screen panic loading experience
- `doc2quiz-generation-loading-legacy.tsx` — earlier generation loading variant
- `Doc2QuizTransitionOverlay.tsx` — route transition overlay
- `GlobalNavigationLoadingScreen.tsx` — global nav loading screen
- `PageTransitionProvider.tsx` — framer-motion page transitions + overlay
- `NavigationLoadingProvider.tsx` — link-click loading interceptor
- `PageTransition.tsx` — route segment fade-in

## Styles

- `loading-animations.css` — shimmer, conversion bar, dashboard enter, route transition keyframes

## Demo routes

- `/loading-demo` and `/loading` still import `Doc2QuizAnimatedLoading` from this folder.
