import {
  validateStrictFlashcards,
  validateStrictQuizQuestions,
} from "../src/lib/server/generateFromFile/validateStrictGenerated";
import type { Question } from "../src/types/question";
import type { FlashcardVisionItem } from "../src/types/visionParse";

const goodQ: Question[] = [
  {
    id: "1",
    question: "What is 2+2?",
    options: ["1", "2", "3", "4"],
    correctIndex: 3,
    parseConfidence: 0.9,
    sourceUnitIds: ["unit-a"],
  },
];
if (validateStrictQuizQuestions(goodQ).ok !== true) {
  throw new Error("expected good quiz ok");
}

const badQ: Question[] = [
  { ...goodQ[0]!, options: ["a", "b", "c"] as unknown as Question["options"] },
];
if (validateStrictQuizQuestions(badQ).ok !== false) {
  throw new Error("expected bad options fail");
}

const dupQ: Question[] = [
  goodQ[0]!,
  {
    ...goodQ[0]!,
    id: "2",
  },
];
if (validateStrictQuizQuestions(dupQ).ok !== false) {
  throw new Error("expected duplicate stem fail");
}

const fc: FlashcardVisionItem[] = [
  {
    kind: "flashcard",
    front: "A",
    back: "B",
    confidence: 0.8,
    sourceUnitIds: ["unit-a"],
  },
];
if (validateStrictFlashcards(fc).ok !== true) {
  throw new Error("expected good flashcards ok");
}

console.log("verify-import-validate: ok");
