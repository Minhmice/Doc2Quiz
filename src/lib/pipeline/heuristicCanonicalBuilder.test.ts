import { describe, expect, it } from "vitest";

import { canonicalBuilderOutputSchema } from "@/lib/pipeline/canonicalSchemas";
import { buildHeuristicCanonicalOutput } from "@/lib/pipeline/heuristicCanonicalBuilder";

describe("buildHeuristicCanonicalOutput", () => {
  it("produces schema-valid output from self-contained theory facts", () => {
    const rawMarkdown = [
      "# Biology notes",
      "",
      "Photosynthesis is the process plants use to convert light into chemical energy.",
    ].join("\n");

    const output = buildHeuristicCanonicalOutput({
      rawMarkdown,
      originalFilename: "biology-notes.pdf",
    });
    const parsed = canonicalBuilderOutputSchema.safeParse(output);

    expect(parsed.success).toBe(true);
    expect(output.atomic_facts.length).toBeGreaterThan(0);
    expect(output.source_readiness.pass).toBe(true);
    expect(output.max_supported_count).toBe(output.atomic_facts.length);
    expect(output.title).toBe("Biology notes");
  });

  it("keeps unanswered exam questions as resolver input without turning them into facts", () => {
    const output = buildHeuristicCanonicalOutput({
      rawMarkdown: [
        "SỞ GIÁO DỤC VÀ ĐÀO TẠO",
        "ĐỀ CHÍNH THỨC",
        "Thời gian làm bài: 90 phút",
        "Câu 1. Quốc gia nào thuộc khu vực Đông Nam Á?",
        "A. Việt Nam.",
        "B. Nhật Bản.",
        "C. Hàn Quốc.",
        "D. Ấn Độ.",
      ].join("\n"),
      originalFilename: "exam.pdf",
    });

    expect(output.atomic_facts).toEqual([]);
    expect(output.extracted_questions).toHaveLength(1);
    expect(output.extracted_questions[0]).toMatchObject({
      question: "Quốc gia nào thuộc khu vực Đông Nam Á?",
      options: ["Việt Nam.", "Nhật Bản.", "Hàn Quốc.", "Ấn Độ."],
      answer: null,
    });
    expect(output.source_readiness.pass).toBe(true);
  });

  it("recovers 24 unique PHẦN I stems and ignores PHẦN II numbering", () => {
    const phaseOne = Array.from({ length: 24 }, (_, index) => [
      `Câu ${index + 1}. Nội dung câu hỏi số ${index + 1}?`,
      `A. Lựa chọn A${index + 1}.`,
      `C. Lựa chọn C${index + 1}.`,
    ].join("\n")).join("\n");
    const output = buildHeuristicCanonicalOutput({
      rawMarkdown: [
        "PHẦN I. Câu trắc nghiệm nhiều phương án.",
        phaseOne,
        "PHẦN II. Câu đúng sai.",
        "Câu 1. Không được lấy câu này?",
        "A. Đúng.",
        "B. Sai.",
      ].join("\n"),
      originalFilename: "exam-24.pdf",
    });

    expect(output.extracted_questions).toHaveLength(24);
    expect(output.extracted_questions.at(-1)?.question).toBe("Nội dung câu hỏi số 24?");
    expect(output.extracted_questions[0]?.options).toEqual([
      "Lựa chọn A1.",
      "Lựa chọn C1.",
    ]);
    expect(output.source_readiness.pass).toBe(true);
  });

  it("parses an English exam before its Vietnamese solution appendix and applies the answer key", () => {
    const output = buildHeuristicCanonicalOutput({
      rawMarkdown: [
        "MÔN: TIẾNG ANH",
        "Read the following passage and answer the numbered questions from 1 to 2.",
        "Digital tools can improve access and flexibility in education.",
        "Question 1. Which benefit is mentioned in the passage?",
        "A. Faster access B. Teacher replacement C. Less flexibility D. No collaboration",
        "Question 2. The word “flexibility” is closest in meaning to ____.",
        "A. rigidity B. adaptability C. distance D. silence",
        "| Question | Answer | Question | Answer |",
        "| --- | --- | --- | --- |",
        "| 1 | A | 2 | B |",
        "LỜI GIẢI CHI TIẾT THAM KHẢO",
        "Câu 1. Which benefit is mentioned in the passage?",
        "Đáp án: A. Faster access",
        "Giải thích: Nội dung lời giải tiếng Việt không được nhập vào stem.",
      ].join("\n"),
      originalFilename: "english-exam.pdf",
    });

    expect(output.language).toBe("en");
    expect(output.extracted_questions).toHaveLength(2);
    expect(output.extracted_questions[0]).toMatchObject({
      options: ["Faster access", "Teacher replacement", "Less flexibility", "No collaboration"],
      answer: "Faster access",
    });
    expect(output.extracted_questions[0]?.question).toContain(
      "Digital tools can improve access and flexibility in education.",
    );
    expect(output.extracted_questions[0]?.question).not.toContain("Giải thích");
    expect(output.extracted_questions[1]?.answer).toBe("adaptability");
  });

  it("separates the next English passage from the previous choice and numbers generic blank prompts", () => {
    const output = buildHeuristicCanonicalOutput({
      rawMarkdown: [
        "MÔN: TIẾNG ANH",
        "Question 35. Which statement is correct?",
        "A. First B. Second C. Third",
        "D. Fourth Read the following passage and choose the option that best fits each of the numbered blanks from 36 to 37. Yoga requires (36) ____ and regular (37) ____.",
        "Question 36. Choose the best option.",
        "A. patience B. noise C. haste D. luck",
        "Question 37. Choose the best option.",
        "A. practice B. absence C. delay D. fear",
        "| 35 | D | 36 | A | 37 | A |",
      ].join("\n"),
      originalFilename: "english-cloze.pdf",
    });

    expect(output.extracted_questions).toHaveLength(3);
    expect(output.extracted_questions[0]?.options[3]).toBe("Fourth");
    expect(output.extracted_questions[1]?.question).toContain(
      "Which option best completes blank (36)?",
    );
    expect(output.extracted_questions[2]?.question).toContain(
      "Which option best completes blank (37)?",
    );
    expect(output.extracted_questions[1]?.question).not.toBe(
      output.extracted_questions[2]?.question,
    );
  });

  it("extracts knowledge from a quoted exam passage without using the cover", () => {
    const output = buildHeuristicCanonicalOutput({
      rawMarkdown: [
        "SỞ GIÁO DỤC VÀ ĐÀO TẠO",
        "ĐỀ CHÍNH THỨC",
        "Câu 1. Phương án nào đúng?",
        "A. Một. B. Hai. C. Ba. D. Bốn.",
        "Cho đoạn tư liệu sau:",
        "“Mục đích của kinh tế thị trường định hướng xã hội chủ nghĩa là phát triển lực lượng sản xuất và nâng cao đời sống nhân dân.”",
      ].join("\n"),
      originalFilename: "history-exam.pdf",
    });

    expect(output.atomic_facts).toHaveLength(1);
    expect(output.atomic_facts[0]).toMatchObject({
      entities: ["Mục đích của kinh tế thị trường định hướng xã hội chủ nghĩa"],
      answer_text:
        "phát triển lực lượng sản xuất và nâng cao đời sống nhân dân",
    });
    expect(output.atomic_facts[0]?.source_excerpt).not.toContain("SỞ GIÁO DỤC");
  });

  it("preserves a long indivisible proposition instead of truncating it", () => {
    const answer =
      `a complete process ${"with every required stage and condition ".repeat(20)}`.trim();
    const sentence = `The extended concept is ${answer}.`;
    const output = buildHeuristicCanonicalOutput({
      rawMarkdown: `# Long-form theory\n\n${sentence}`,
      originalFilename: "long-form.pdf",
    });

    expect(sentence.length).toBeGreaterThan(500);
    expect(output.atomic_facts).toHaveLength(1);
    expect(output.atomic_facts[0]?.source_excerpt).toBe(sentence);
    expect(output.atomic_facts[0]?.answer_text).toBe(answer);
  });

  it("uses a source heading before an unrelated filename", () => {
    const output = buildHeuristicCanonicalOutput({
      rawMarkdown: "# Lịch sử Nghệ An\n\nNội dung lịch sử địa phương.",
      originalFilename: "delichsunghean 24 mul ques.pdf",
    });

    expect(output.title).toBe("Lịch sử Nghệ An");
  });
});
