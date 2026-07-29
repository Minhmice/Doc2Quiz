export const locales = ["en", "vi"] as const;
export type Locale = (typeof locales)[number];

export const slangContexts = [
  "loading", "upload", "conversion", "quizGeneration", "flashcardGeneration",
  "correct", "wrong", "retry", "success", "empty", "warning", "streak", "score",
  "navigation", "toast", "progress", "result", "badge", "secondaryLabel",
] as const;
export type SlangContext = (typeof slangContexts)[number];

export type SlangTone = "praise" | "encourage" | "playful" | "warning" | "easterEgg";
export type SlangEntry = Readonly<{ text: string; tone: SlangTone }>;
export type SlangCatalog = Readonly<Record<Locale, Readonly<Record<SlangContext, readonly SlangEntry[]>>>>;

export type MessageCatalog = {
  loading: { title: string; description: string };
  upload: { title: string; action: string; fileCount: (count: number) => string };
  conversion: { title: string; description: string };
  quizGeneration: { title: string; description: string };
  flashcardGeneration: { title: string; description: string };
  correct: { label: string; explanation: string };
  wrong: { label: string; explanation: string };
  retry: { action: string; description: string };
  success: { title: string; description: string };
  empty: { title: string; description: string };
  warning: { title: string; description: string };
  streak: { label: string; days: (count: number) => string };
  score: { label: string; correctCount: (correct: number, total: number) => string };
  navigation: {
    brandName: string;
    dashboard: string;
    settings: string;
    back: string;
    logout: string;
    searchStudySets: string;
    searchStudySetsPlaceholder: string;
    newSet: string;
    createNewSet: string;
    accountMenu: string;
    studySetUnavailable: string;
    sourcePrefix: string;
    searchCommands: string;
    noResults: string;
    navigate: string;
    newStudySet: string;
    currentSet: string;
    review: string;
    practice: string;
    shortcuts: string;
    openCommandPalette: string;
    create: string; allSets: string; quizzes: string; flashcards: string; continueStudying: string; mistakeDrills: string; help: string; primaryNavigation: string; collapseSidebar: string; expandSidebar: string; openNavigation: string; planUsage: string;
  };
  toast: { saved: string; failed: string };
  help: { intro: string; workflow: string; workflowBody: string; shortcuts: string; shortcutsBody: string; faq: string; faqBody: string };
  progress: { label: string; processing: string; steps: string; percent: (value: number) => string };
  result: { title: string; review: string };
  badge: { new: string; complete: string };
  secondaryLabel: { optional: string; recommended: string };
  settings: {
    languageTitle: string;
    languageSubtitle: string;
    english: string;
    vietnamese: string;
    englishTooltip: string;
    vietnameseTooltip: string;
  };
  accessibility: { openMenu: string; closeDialog: string; nextItem: string; previousItem: string };
  dashboard: {
    library: string; totalSets: (count: string) => string; filterAria: string;
    filters: Record<"all" | "ready" | "needs_edit" | "in_review", string>;
    sortAria: string; sortRecent: string; sortTitle: string; loadingSets: string; loadingDashboard: string;
    emptyTitle: string; emptyCta: string; emptyDescription: string; emptyAria: string;
    addTitle: string; addDescription: string; addAria: string;
    noFilterMatch: string; noSearchMatch: (query: string) => string; loadRecovery: string;
    deleteTitle: string; deleteDescription: (title: string, approved: string | null) => string;
    cancel: string; deleteAction: string;
    kinds: Record<"flashcards" | "quiz" | "studySet", string>;
    statuses: Record<"needs_edit" | "ready" | "in_progress", string>;
    units: { cards: (count: string) => string; questions: (count: string) => string };
    readyPractice: string; percentDone: (percent: string) => string; percentComplete: (percent: string) => string;
    actions: { openEditor: string; practice: string; resumePractice: string; startFlashcards: string; startQuiz: string; continueSetup: string; review: string; drillMistakes: string; more: string; moreFor: (title: string) => string; rename: string; delete: string };
    mobile: { aria: string; dashboard: string; library: string; create: string; settings: string };
    hero: { welcome: (name: string) => string; learner: string; summary: (editing: string, ready: string) => string; createFirst: string; createNew: string; practice: string; reviewLatest: string };
  };
  workflows: {
    import: Record<"eyebrow" | "file" | "paste" | "sourceText" | "pastePlaceholder" | "youtubeHelp" | "convert" | "converting" | "missingInput" | "unsupportedFile" | "fallbackError", string>;
    uploadBox: Record<"drop" | "choose" | "chooseAnother" | "formats", string>;
    source: Record<"loading" | "back" | "noSource" | "noSourceHelp" | "canonicalFailed" | "tryAgain" | "previewUnavailable" | "noCanonical" | "noCanonicalHelp" | "rebuild" | "previewLabel" | "missingSet" | "quizFallback" | "flashcardFallback" | "setupFallback", string>;
    mode: {
      learningMode: string; helper: string; generating: string; quiz: string; quizHelp: string; flashcards: string; flashcardsHelp: string;
      quizReady: string; flashcardsReady: string; editQuestions: string; startQuiz: string; startFlashcards: string;
      questionCount: (count: number) => string; cardCount: (count: number) => string;
    };
    wizard: {
      steps: Record<"one" | "two" | "three", { eyebrow: string; headline: string; helper: string }>;
      goals: Record<"memorize" | "understand" | "exam_preparation", { label: string; sublabel: string }>;
      coverage: string; entireDocument: string; selectedSections: string; noSections: string; selectSectionError: string;
      amount: string; recommended: string; custom: string; cardCount: string; countPlaceholder: string; countError: string;
      back: string; continue: string; generate: string;
    };
    review: {
      studySet: string; editQuestions: string; quizHelp: string; total: string; incomplete: string; removed: string;
      mappingTitle: string; mappingDescription: (count: number) => string; cannotSave: string; approveError: string;
      noQuestions: string; backToPreview: string; navigatorLabel: string;
      incompleteStatus: (count: number) => string; readyStatus: string; questionRemoved: string; questionSaved: string;
      question: string; preview: string; correctAnswer: string; save: string; cancel: string;
    };
    flashcardReview: Record<string, string>;
    practice: {
      common: Record<"loading" | "error" | "tryAgain" | "progress", string> & { completePercent: (value: string) => string };
      quiz: Record<"questionMap" | "questions" | "noMistakesTitle" | "noMistakesDescription" | "openFullPractice" | "emptyTitle" | "emptyDescription" | "goToReview" | "sessionComplete" | "preparingResults" | "itemReview" | "correct" | "incorrect" | "allCorrect" | "drillMistakes" | "noMistakesTitleAttr" | "practiceAgain" | "openLibrary" | "answerChoices" | "choose" | "navigation" | "question" | "choices" | "next" | "seeResults" | "keyboardInstructions" | "resultsReady" | "resultsSavedDescription" | "resultsSaved" | "reviewMissed" | "cleanRun" | "startQuiz" | "reviewQuestions" | "backToLibrary" | "noMissedQuestions" | "noMissedQuestionsTitle" | "loadingResults", string> & {
        items: (count: string) => string; navStatus: (question: string, status: string) => string;
        statuses: Record<"upcoming" | "current" | "correct" | "incorrect", string>;
        questionShort: (index: string) => string; score: (correct: string, total: string) => string;
        reviewCount: (count: string) => string; questionProgress: (current: string, total: string) => string;
        questionsCount: (count: string) => string;
      };
      flashcards: Record<"loadingSession" | "loadErrorTitle" | "emptyTitle" | "emptyDescription" | "backToPreview" | "sessionRegion" | "front" | "back" | "flipCard" | "navigate" | "previous" | "next" | "done" | "reviewLater" | "sessionComplete" | "resultsSaved" | "completionDescription" | "startFlashcards" | "library" | "canonicalPreview", string> & {
        itemProgress: (current: string, total: string) => string; cardCount: (count: string, rawCount: number) => string;
      };
    };
  };
  pipeline: {
    ingest: {
      steps: { validating: string; uploading: string; converting: string };
      titles: { validating: string; uploading: string; converting: string };
      subtitles: { validating: string; uploading: string; converting: string };
      fallbackError: string;
      stepCount: (current: number, total: number) => string;
    };
    canonical: {
      title: string;
      subtitle: string;
      fallbackError: string;
      steps: { structure: string; language: string; sections: string };
    };
    quiz: {
      metaGenerating: string; metaComplete: string; title: string; fallbackError: string;
      successCount: (generated: number, recommended: number) => string;
      count: (recommended: number | string, generated: number | string) => string;
      subtitle: string; thinContent: string;
      steps: { detecting: string; building: string; saving: string };
    };
    flashcards: {
      metaGenerating: string; metaComplete: string; title: string; fallbackError: string;
      successCount: (generated: number, recommended: number) => string;
      count: (recommended: number | string, generated: number | string) => string;
      format: (value: string) => string; subtitle: string; thinContent: string;
      formats: Record<"term_definition" | "question_answer" | "cloze" | "mixed", string>;
      steps: { detecting: string; building: string; saving: string };
    };
  };
};
