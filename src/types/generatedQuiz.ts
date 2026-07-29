export type GeneratedQuiz = {
  recommendedCount: number;
  questions: {
    question: string;
    options: [string, string, string, string];
    correctOption: 0 | 1 | 2 | 3;
    explanation: string;
    sourceChunkId: string;
  }[];
};
