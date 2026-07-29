export type FlashcardVisionItem = {
  id?: string;
  front: string;
  back: string;
};

export type ApprovedFlashcardBank = {
  version: 1;
  savedAt: string;
  items: FlashcardVisionItem[];
};
