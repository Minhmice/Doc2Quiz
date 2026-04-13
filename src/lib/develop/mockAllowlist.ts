export const DEVELOP_MOCK_SLUGS = [
  "doc2quiz_action_focused_dashboard",
  "doc2quiz_ai_connection_settings",
  "doc2quiz_refined_selection",
  "refined_ai_processing_workspace",
  "doc2quiz_professional_review_workspace",
  "doc2quiz_flashcard_review_workspace",
  "doc2quiz_immersive_quiz_play_mode",
  "doc2quiz_advanced_results_recovery_workspace",
] as const;

export type DevelopMockSlug = (typeof DEVELOP_MOCK_SLUGS)[number];

const SLUG_SET = new Set<string>(DEVELOP_MOCK_SLUGS);

export function isAllowedDevelopMockSlug(
  slug: string,
): slug is DevelopMockSlug {
  return SLUG_SET.has(slug);
}

export type DevelopMockGroup = {
  tabId: string;
  tabLabel: string;
  mocks: { slug: DevelopMockSlug; label: string }[];
};

/** Tab order and mocks per `23-UI-SPEC.md` §3 */
export const DEVELOP_MOCK_GROUPS: readonly DevelopMockGroup[] = [
  {
    tabId: "dashboard",
    tabLabel: "Dashboard",
    mocks: [
      {
        slug: "doc2quiz_action_focused_dashboard",
        label: "Action-focused dashboard",
      },
    ],
  },
  {
    tabId: "settings",
    tabLabel: "Settings",
    mocks: [
      {
        slug: "doc2quiz_ai_connection_settings",
        label: "AI connection settings",
      },
    ],
  },
  {
    tabId: "study",
    tabLabel: "Study flows",
    mocks: [
      { slug: "doc2quiz_refined_selection", label: "Refined selection" },
      {
        slug: "refined_ai_processing_workspace",
        label: "AI processing workspace",
      },
      {
        slug: "doc2quiz_professional_review_workspace",
        label: "Professional review",
      },
      {
        slug: "doc2quiz_flashcard_review_workspace",
        label: "Flashcard review",
      },
    ],
  },
  {
    tabId: "play",
    tabLabel: "Play",
    mocks: [
      {
        slug: "doc2quiz_immersive_quiz_play_mode",
        label: "Immersive quiz play",
      },
    ],
  },
  {
    tabId: "other",
    tabLabel: "Other",
    mocks: [
      {
        slug: "doc2quiz_advanced_results_recovery_workspace",
        label: "Results & recovery",
      },
    ],
  },
] as const;

export function defaultSlugForTab(tabId: string): DevelopMockSlug | null {
  const g = DEVELOP_MOCK_GROUPS.find((x) => x.tabId === tabId);
  return g?.mocks[0]?.slug ?? null;
}

export function groupForSlug(slug: DevelopMockSlug): DevelopMockGroup | null {
  return (
    DEVELOP_MOCK_GROUPS.find((g) => g.mocks.some((m) => m.slug === slug)) ??
    null
  );
}
