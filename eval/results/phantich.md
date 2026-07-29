# Phân tích lỗi thiếu số lượng câu hỏi và kế hoạch sửa Quiz Generator V1

## 1. Mục tiêu và kết luận

Mục tiêu ưu tiên số một: khi người dùng yêu cầu `N` câu, hệ thống chỉ được báo thành công và lưu kết quả khi có đúng `N` câu hợp lệ, khác nhau và có căn cứ.

Kết luận chính:

1. Lỗi 40 câu đầu vào nhưng sản phẩm chỉ còn 5–6 câu chủ yếu nằm ở code hậu xử lý, không phải do model không tạo đủ.
2. `dedupeAndCapQuestions()` hiện chỉ giữ câu đầu tiên của mỗi `concept_id`. Nếu 40 câu thuộc 6 concept, kết quả cuối chỉ còn tối đa 6 câu.
3. Pipeline vẫn trả `ok: true`, xóa bộ câu hỏi cũ và lưu bộ câu hỏi thiếu. Thiếu số lượng hiện chỉ là warning, không phải lỗi chặn.
4. Prompt đã yêu cầu đúng số lượng, nhưng prompt không thể bảo đảm tuyệt đối hành vi model. Số lượng phải được cưỡng chế bằng validator, retry và transaction ở tầng ứng dụng.
5. Kết quả DeepEval cho thấy model đã trả đủ 40 câu trong cả 5 lần chạy case tiếng Anh. Vì vậy việc chỉ thấy 5–6 câu trong sản phẩm phù hợp trực tiếp với lỗi hậu xử lý theo concept.

## 2. Phạm vi và dữ liệu đánh giá

- Prompt: `prompt/quiz_generator_v1.json`
- Model: `cx/gpt-5.6-sol`
- Số case: 3 PDF
- Số lần lặp: 5 lần/case
- Tổng số lần gọi hợp lệ: 15/15
- Tài liệu kết quả:
  - `eval/results/report_quiz_v1_9router_gpt56sol_stream.md`
  - `eval/results/summary_quiz_v1_9router_gpt56sol_stream.json`
  - `eval/results/per_run_quiz_v1_9router_gpt56sol_stream.csv`

Giới hạn: ba PDF chỉ là tập kiểm thử nhỏ. Kết quả này đủ để tái hiện lỗi và xác định lỗi code, nhưng chưa đủ để khẳng định độ ổn định trên mọi môn học, ngôn ngữ, loại PDF và nhà cung cấp model.

## 3. Triệu chứng thực tế và đường đi dữ liệu

Luồng hiện tại:

1. Người dùng gửi `questionCount`, tối đa 40.
2. Prompt nhận `requested_count`.
3. Model trả JSON gồm `concepts` và `questions`.
4. JSON được kiểm tra schema.
5. `dedupeAndCapQuestions()` rút gọn danh sách.
6. Pipeline xóa toàn bộ câu hỏi cũ.
7. Pipeline lưu danh sách đã rút gọn và trả thành công.

Điểm lỗi nằm ở bước 5:

```ts
const byConcept = new Map<string, GeneratedQuestion>();
for (const question of output.questions) {
  const key = question.concept_id.toLowerCase();
  if (!byConcept.has(key)) {
    byConcept.set(key, question);
  }
}
```

`Map` chỉ giữ một `GeneratedQuestion` cho mỗi `concept_id`.

Sau đó số câu tối đa lại bị giới hạn bởi số concept:

```ts
const maxAllowed = Math.min(
  recommendedCount,
  uniqueConcepts.length,
  output.questions.length,
  questionCountOverride ?? Number.POSITIVE_INFINITY,
  MAX_QUESTIONS,
);
```

Và danh sách cuối được dựng bằng cách lấy đúng một câu cho mỗi concept:

```ts
const questions = uniqueConcepts
  .slice(0, maxAllowed)
  .map((concept) => byConcept.get(concept.concept_id.toLowerCase()));
```

Ví dụ tái hiện:

- Người dùng yêu cầu: 40 câu.
- Model trả: 40 câu.
- Model nhóm 40 câu vào 6 concept.
- `byConcept` giữ: 6 câu.
- `uniqueConcepts.length`: 6.
- `maxAllowed = min(40, 6, 40, 40, 40) = 6`.
- Sản phẩm lưu: 6 câu.

Đây là hành vi tất định. Prompt có tốt hơn cũng không sửa được lỗi này.

## 4. Mâu thuẫn giữa prompt và code

Prompt đã ghi rõ:

- `requested_count` là số lượng chính xác, không phải gợi ý.
- Khi yêu cầu 40 và nguồn có đủ dữ liệu, phải trả đúng 40.
- Được tạo nhiều câu trên cùng passage, source question hoặc concept.
- Một concept không giới hạn một câu hỏi.

Code lại thực hiện điều ngược lại:

- Một `concept_id` chỉ còn một câu.
- Số câu tối đa không được vượt số concept.
- Khi số câu thiếu, code thêm `"Limited testable content"` rồi vẫn tiếp tục.

Test hiện tại còn hợp thức hóa hành vi sai:

- Test `"removes duplicate concept_id entries case-insensitively"` kỳ vọng nhiều câu cùng concept bị xóa.
- Test thiếu câu kỳ vọng warning thay vì failure.
- Không có test bắt buộc `generatedCount === questionCountOverride`.

Do đó đây không chỉ là bug triển khai. Đây còn là contract và test oracle sai.

## 5. Phân tích chỉ số DeepEval

### 5.1 Tổng hợp

| Chỉ số | Kết quả | Ngưỡng cũ | Đánh giá |
|---|---:|---:|---|
| Schema pass | 100.0% | 99% | PASS |
| Exact count | 93.3% | 95% | FAIL |
| Structure pass | 100.0% | 99% | PASS |
| Không trùng câu | 100.0% | 95% | PASS |
| Exact source excerpt | 57.3% | 90% | FAIL |
| Groundedness G-Eval | 71.3% | 80% | FAIL |
| Quality G-Eval | 82.0% | 80% | PASS |
| API error | 0 | 0 | PASS |
| Judge error | 0 | 0 | PASS |

### 5.2 Số lượng theo case

| Case | Yêu cầu | Kết quả 5 lần | Exact-count |
|---|---:|---|---:|
| Địa lý | 18 | 18, 18, 18, 18, 18 | 100% |
| Lịch sử | 24 | 24, 28, 24, 24, 24 | 80% |
| Tiếng Anh | 40 | 40, 40, 40, 40, 40 | 100% |

Ý nghĩa:

- Model có khả năng tạo đủ 40 câu. Case 40 đạt 5/5.
- Model vẫn có biến thiên cardinality: một lần trả 28 thay vì 24.
- Ngưỡng count 95% là chưa phù hợp với yêu cầu sản phẩm. Cardinality là contract cứng, nên ngưỡng phải là 100%.
- DeepEval hiện đánh giá output thô từ model. Nó không phát hiện số câu bị code hậu xử lý xóa nếu không đánh giá thêm output đã lưu trong DB.

### 5.3 Groundedness

Case Lịch sử không có answer key:

- Groundedness trung bình: 26%.
- Một câu có thể trích đúng đề bài nhưng `correct_index` vẫn không được nguồn chứng minh.
- Exact excerpt cao không đồng nghĩa đáp án đúng.

Case Địa lý và Tiếng Anh:

- Groundedness trung bình: 94%.
- Chất lượng tổng thể tốt hơn vì có answer key hoặc nguồn hỗ trợ đáp án rõ hơn.

Hệ quả: hệ thống không nên tự suy đoán đáp án cho đề thi thiếu đáp án. Nếu nguồn chỉ chứa câu hỏi và lựa chọn, không có đáp án hay kiến thức chứng minh, phải fail closed hoặc đánh dấu cần xác minh.

### 5.4 Source excerpt

Exact source excerpt chỉ đạt 57.3%.

Nguyên nhân có thể:

- Model diễn giải lại thay vì trích nguyên văn.
- Trích đoạn lấy từ representation khác với canonical markdown.
- Prompt cho phép tạo câu mới từ fact nhưng schema/evaluator lại kỳ vọng exact substring.

Cần thống nhất contract:

- Nếu `source_excerpt` là bằng chứng audit, bắt buộc copy nguyên văn từ canonical source.
- Nếu cho phép paraphrase, không dùng exact-substring metric làm tiêu chí chính.

Khuyến nghị: giữ `source_excerpt` là trích dẫn nguyên văn và thêm `source_locator` ổn định.

### 5.5 Độ trễ và transport

- Thời gian trung bình khoảng 88–121 giây/case.
- Một số lần vượt giới hạn route `maxDuration = 120`.
- Non-stream request từng gặp timeout 524; streaming hoàn thành ổn định hơn.

Đây không phải nguyên nhân trực tiếp làm 40 thành 5–6, nhưng có thể gây request thất bại, retry ở client hoặc kết quả không hoàn chỉnh nếu adapter xử lý stream sai.

## 6. Danh sách lỗi theo mức độ

### P0 — Dedupe sai đơn vị

Hiện tại dedupe theo `concept_id`. Concept là nhãn phân loại, không phải định danh câu hỏi.

Tác động:

- Mất dữ liệu hợp lệ.
- Số câu cuối phụ thuộc số concept.
- Trái trực tiếp với prompt.

Sửa:

- Cho phép nhiều câu cùng `concept_id`.
- Dedupe theo fingerprint nội dung câu hỏi đã chuẩn hóa.
- Fingerprint nên gồm `prompt` và có thể thêm choices đã chuẩn hóa.

### P0 — Không có hard invariant số lượng

Pipeline không chặn khi `generatedCount < requestedCount`.

Tác động:

- API trả HTTP success cho kết quả thiếu.
- UI hiển thị success kèm ghi chú “thin content”.
- Lỗi contract bị biến thành warning.

Sửa:

```ts
if (validQuestions.length !== targetCount) {
  throw new QuizGenerateError(
    `Expected ${targetCount} questions, got ${validQuestions.length}`,
    422,
  );
}
```

Hard invariant phải chạy trước persistence.

### P0 — Xóa dữ liệu cũ trước khi thay thế an toàn

Pipeline xóa `approved_questions`, sau đó mới insert batch mới. Hai thao tác không atomic.

Tác động:

- Batch thiếu vẫn thay thế batch tốt.
- Insert lỗi sau delete có thể làm mất toàn bộ câu hỏi cũ.

Sửa:

- Chỉ persist sau khi batch mới đạt mọi hard gate.
- Dùng database transaction/RPC để replace atomic.
- Nếu insert hoặc validation lỗi, giữ nguyên dữ liệu cũ.

### P0 — Test đang bảo vệ hành vi sai

Unit test hiện kỳ vọng một câu mỗi concept.

Sửa:

- Thay test này bằng test “40 câu thuộc 6 concept vẫn giữ đủ 40”.
- Không cho phép test `generatedCount < requestedCount` kết thúc thành công.

### P1 — Repair hiện chỉ sửa JSON/schema

Pipeline có repair khi JSON không parse/schema sai, nhưng không repair số lượng thiếu, số lượng thừa hoặc câu trùng.

Sửa:

- Sau validation, tính `missingCount`.
- Nếu thiếu, gọi model bổ sung đúng `missingCount`.
- Truyền danh sách fingerprint/prompt đã có để tránh lặp.
- Merge, dedupe, validate lại.
- Giới hạn 2–3 vòng.
- Nếu vẫn thiếu: trả lỗi, không persist.

Nếu thừa:

- Chỉ cắt xuống `targetCount` sau khi mọi câu đều hợp lệ.
- Ưu tiên coverage, groundedness và phân bố concept thay vì lấy `slice(0, N)` mù.

### P1 — Không có readiness gate cho đáp án

Case không có answer key cho thấy model có thể chọn đáp án không được nguồn hỗ trợ.

Sửa:

- Với câu hỏi tái tạo từ đề gốc: cần answer key hoặc canonical fact chứng minh đáp án.
- Không có bằng chứng: loại câu đó khỏi valid set.
- Nếu không đủ số lượng sau khi loại: retry từ phần nguồn có bằng chứng hoặc fail rõ ràng.
- Không dùng kiến thức ngoài nguồn để lấp đủ count.

### P1 — `recommended_count` nhập nhằng

Khi người dùng đã yêu cầu số cụ thể, `recommended_count` không được thay đổi contract.

Sửa:

- `targetCount = questionCountOverride ?? recommended_count`.
- Khi có override, output model không được quyền hạ target.
- Có thể đổi tên field model thành `requested_count_ack` để tránh hiểu sai.

### P1 — Timeout sát ngưỡng

Thời gian sinh 40 câu có thể vượt 120 giây.

Sửa:

- Dùng streaming transport.
- Thiết lập timeout hạ tầng cao hơn percentile thực tế hoặc chia generation thành batch.
- Batch gợi ý: 10–20 câu/lần, chạy tuần tự hoặc song song có kiểm soát, sau đó merge.
- Không xem chunk stream chưa hoàn chỉnh là JSON hợp lệ.

### P2 — Contract trích dẫn chưa rõ

Sửa:

- `source_excerpt` phải là exact substring.
- Thêm `section_key`/locator bắt buộc.
- Validator kiểm tra exact match bằng code.
- Không dựa hoàn toàn vào LLM judge cho điều kiện có thể kiểm tra tất định.

## 7. Thiết kế sửa đề xuất

### 7.1 Contract số lượng

Định nghĩa:

```ts
const targetCount =
  questionCountOverride ?? Math.min(output.recommended_count, MAX_QUESTIONS);
```

Điều kiện thành công:

```text
raw_count >= targetCount
valid_count >= targetCount
unique_count >= targetCount
selected_count == targetCount
persisted_count == targetCount
returned_question_ids.length == targetCount
```

Chỉ khi tất cả đúng mới trả HTTP 200.

### 7.2 Dedupe đúng

Không dedupe theo concept.

Fingerprint tối thiểu:

```ts
normalize(question.prompt)
```

Fingerprint mạnh hơn:

```ts
hash(
  normalize(question.prompt) +
  "|" +
  question.choices.map(normalize).sort().join("|")
)
```

Chuẩn hóa gồm:

- Unicode normalization.
- Lowercase cho ngôn ngữ phù hợp.
- Collapse whitespace.
- Loại punctuation không mang nghĩa.

Không nên dùng semantic similarity làm hard gate duy nhất vì có thể xóa nhầm các câu gần nhau nhưng kiểm tra kiến thức khác nhau.

### 7.3 Retry phần thiếu

Pseudo-flow:

```text
target = requestedCount
accepted = []

for attempt in 1..3:
  need = target - accepted.length
  if need == 0: break

  generated = generate_exactly(need, excluded_fingerprints)
  valid = schema + structure + evidence validation
  accepted += dedupe(valid)

if accepted.length < target:
  return 422 INSUFFICIENT_VALID_QUESTIONS

selected = select_best_coverage(accepted, target)
persist_atomically(selected)
verify persisted_count == target
return 200
```

Retry phải yêu cầu “chỉ tạo phần còn thiếu”, không tạo lại toàn bộ 40 câu. Cách này giảm chi phí, độ trễ và nguy cơ lặp.

### 7.4 Phân biệt thiếu nguồn và lỗi model

Không được tự động gọi mọi trường hợp thiếu câu là “Limited testable content”.

Chỉ kết luận nguồn thiếu khi có validator xác định:

- Số source question/fact có bằng chứng nhỏ hơn target.
- Không thể tạo thêm câu khác nhau mà không lặp hoặc suy diễn ngoài nguồn.

Nếu chưa chứng minh được, mã lỗi phải là generation failure, không phải content limitation.

### 7.5 Persistence atomic

Thứ tự bắt buộc:

1. Generate.
2. Validate.
3. Repair/retry.
4. Chọn đúng `targetCount`.
5. Mở transaction.
6. Insert batch mới hoặc replace bằng RPC.
7. Kiểm tra row count.
8. Commit.
9. Trả success.

Không xóa dữ liệu cũ ở bước trước validation.

## 8. Thay đổi prompt đề xuất

Prompt cần giữ yêu cầu count, nhưng bổ sung self-check ngắn và không mâu thuẫn:

```text
CARDINALITY CONTRACT:
- Let TARGET be the numeric requested_count.
- Return exactly TARGET questions.
- Multiple questions may share the same concept_id.
- concept_id is a taxonomy label, not a unique question identifier.
- Before returning, count questions.length.
- If questions.length is below TARGET, continue generating distinct,
  source-grounded questions until it equals TARGET.
- If questions.length exceeds TARGET, remove the weakest extras.
- Never change TARGET through recommended_count.
```

Không nên chỉ tăng mức độ mạnh của câu chữ như “MUST”, “ABSOLUTELY” hoặc “MANDATORY”. Model vẫn có xác suất sai. Cưỡng chế thật phải nằm trong code.

Schema có thể thêm:

```json
{
  "requested_count_ack": 40,
  "questions": []
}
```

Tuy nhiên `requested_count_ack` chỉ giúp chẩn đoán. Validator vẫn phải đếm `questions.length`.

## 9. Kế hoạch triển khai

### Giai đoạn 1 — Chặn mất câu, bắt buộc đủ count

1. Sửa `dedupeAndCapQuestions.ts`.
2. Bỏ `uniqueConcepts.length` khỏi `maxAllowed`.
3. Không dùng `Map<concept_id, question>`.
4. Dedupe theo fingerprint câu hỏi.
5. Thiết lập `targetCount` độc lập với số concept.
6. Throw nếu chưa đủ sau retry.
7. Chỉ persist đúng `targetCount`.

Tiêu chí hoàn thành: case 40 câu/6 concept trả và lưu đúng 40.

### Giai đoạn 2 — Retry và repair cardinality

1. Thêm validator cho thiếu, thừa, trùng.
2. Thêm request bổ sung phần thiếu.
3. Giới hạn số lần retry.
4. Ghi log `requested/raw/valid/unique/persisted`.
5. Trả error code có cấu trúc nếu không đạt.

Tiêu chí hoàn thành: không có HTTP 200 khi số câu lưu khác số câu yêu cầu.

### Giai đoạn 3 — Bảo vệ dữ liệu

1. Thay delete-then-insert bằng transaction/RPC.
2. Giữ batch cũ khi generation hoặc insert lỗi.
3. Kiểm tra row count sau ghi.

Tiêu chí hoàn thành: fault injection tại mọi bước không làm mất quiz cũ.

### Giai đoạn 4 — Grounding và answer readiness

1. Bắt buộc evidence cho `correct_index`.
2. Fail closed khi đề không có answer key và canonical source không chứng minh đáp án.
3. Exact-match `source_excerpt`.
4. Tách metric “excerpt exact” và “answer supported”.

Tiêu chí hoàn thành: groundedness và evidence coverage đạt ngưỡng mà không dùng kiến thức ngoài nguồn.

### Giai đoạn 5 — Hiệu năng

1. Chuẩn hóa streaming.
2. Đo p50/p95/p99 latency.
3. Cân nhắc batch generation cho 40 câu.
4. Thiết lập timeout lớn hơn p99 có biên an toàn.

## 10. Bộ test bắt buộc

### Unit test

1. 40 câu, 6 concept → giữ 40.
2. 40 câu, 1 concept → giữ 40 nếu prompt khác nhau.
3. Hai câu giống nội dung nhưng khác `concept_id` → dedupe còn một.
4. Hai câu cùng `concept_id` nhưng nội dung khác → giữ cả hai.
5. Yêu cầu 40, model trả 5 → không persist, chạy retry.
6. Retry đạt 40 → persist 40, trả 40 IDs.
7. Retry vẫn chỉ đạt 39 → HTTP 422, giữ dữ liệu cũ.
8. Yêu cầu 24, model trả 28 → chọn đúng 24.
9. Insert lỗi → rollback, dữ liệu cũ còn nguyên.
10. Không có answer evidence → câu bị loại khỏi valid set.

### Integration test

Đánh giá cả ba tầng:

1. Raw model output.
2. Post-processed output.
3. Persisted DB output.

Nếu chỉ đo tầng 1, lỗi hiện tại sẽ bị bỏ sót vì model đã trả đủ 40 nhưng tầng 2 xóa còn 5–6.

### Regression test

- Chạy lại 3 case × 5.
- Bổ sung case nhiều câu dùng chung ít concept.
- Bổ sung PDF 40 câu nhưng chỉ có 5 section.
- Bổ sung case thiếu answer key.
- Bổ sung PDF scan/OCR lỗi.
- Bổ sung tiếng Việt, tiếng Anh và tài liệu song ngữ.

## 11. Tiêu chí PASS mới

Hard gates, tất cả phải đạt 100%:

- Schema valid: 100%.
- Raw output count hoặc repaired count: 100%.
- Post-processed count: 100%.
- Persisted count: 100%.
- Returned ID count: 100%.
- Structure valid: 100%.
- Không mất dữ liệu cũ khi lỗi: 100%.
- API/judge errors trong test chuẩn: 0.

Quality gates:

- Duplicate-free: ≥99%.
- Answer groundedness: ≥90%.
- Exact source excerpt: ≥90%.
- G-Eval quality: ≥80%.

Thứ tự đánh giá:

1. Count hard gate.
2. Schema/structure hard gate.
3. Evidence/grounding.
4. Quality.

Một output thiếu câu phải FAIL ngay, dù điểm quality của các câu còn lại cao.

## 12. Telemetry cần thêm

Mỗi generation cần log:

```json
{
  "requested_count": 40,
  "raw_count": 40,
  "schema_valid_count": 40,
  "evidence_valid_count": 40,
  "unique_count": 40,
  "selected_count": 40,
  "persisted_count": 40,
  "concept_count": 6,
  "retry_count": 0,
  "failure_code": null
}
```

Telemetry này sẽ phân biệt ngay:

- Model trả thiếu.
- Validator loại câu.
- Dedupe xóa câu.
- DB lưu thiếu.
- UI đọc thiếu.

Không log API key, toàn bộ nội dung nhạy cảm hoặc raw PDF nếu không có chính sách lưu trữ phù hợp.

## 13. Definition of Done

Sửa chữa chỉ được xem là hoàn tất khi:

1. `questionCount=40` luôn tạo, hậu xử lý, lưu và trả đúng 40 trên bộ regression hợp lệ.
2. Nhiều câu cùng concept không bị xóa.
3. Không có success response nếu count sai.
4. Retry chỉ bổ sung phần thiếu và không tạo câu trùng.
5. Batch cũ không bị mất khi generation/persistence lỗi.
6. Test đo output thực tế trong DB, không chỉ raw model response.
7. Case không đủ evidence trả lỗi minh bạch thay vì bịa đáp án để lấp đủ số lượng.
8. DeepEval đạt toàn bộ hard gate và quality gate mới.

## 14. Thứ tự sửa khuyến nghị

1. Sửa `dedupeAndCapQuestions.ts` và unit tests.
2. Thêm count invariant trước DB.
3. Thêm transaction cho replace.
4. Thêm retry phần thiếu.
5. Bổ sung end-to-end evaluator đến persisted output.
6. Sửa grounding/answer-key handling.
7. Tối ưu streaming và latency.

Ba bước đầu xử lý trực tiếp lỗi 40 thành 5–6. Các bước sau bảo đảm kết quả đủ câu nhưng vẫn đúng, có căn cứ và ổn định trong production.

## 15. Yêu cầu riêng cho file thuần lý thuyết và facts

### 15.1 Nguyên tắc

Với tài liệu không có sẵn bộ câu hỏi hoặc answer key, hệ thống phải chuyển nội dung thành tập atomic facts trước khi tạo quiz. Không được generate trực tiếp từ toàn bộ văn bản rồi dùng model tự suy đoán đáp án.

Thứ tự bắt buộc:

1. Trích xuất và chuẩn hóa nội dung.
2. Tách atomic facts.
3. Gắn bằng chứng và vị trí nguồn cho từng fact.
4. Tính số question opportunities có thể hỗ trợ.
5. Generate câu hỏi từ các fact đủ điều kiện.
6. Validate số lượng, đáp án, bằng chứng và trùng lặp.
7. Retry phần thiếu.
8. Chỉ persist khi toàn bộ hard gate đạt.

### 15.2 Readiness gate của tài liệu

Tài liệu chỉ được đưa vào generation khi:

- Text/OCR đủ rõ để đọc đúng thuật ngữ, số liệu, dấu câu và đơn vị.
- Nội dung được chia thành section có locator ổn định.
- Mỗi fact có `fact_id`, `section_key` và `source_excerpt` nguyên văn.
- Fact là một mệnh đề có thể kiểm chứng từ tài liệu.
- Fact tự chứa đủ thông tin để xác định đáp án.
- Không phụ thuộc vào hình, bảng hoặc công thức đã bị extraction làm mất.
- Đại từ và tham chiếu như “nó”, “điều này”, “trường hợp trên” đã được resolve bằng context trong nguồn.
- Tài liệu có đủ độ đa dạng nội dung để tạo câu không trùng ý.
- Ngôn ngữ của nguồn được phát hiện đúng.

Fact không đủ điều kiện:

- Tiêu đề không chứa nội dung.
- Câu bị OCR lỗi hoặc mất một phần.
- Mệnh đề mơ hồ, thiếu chủ thể hoặc thiếu điều kiện.
- Ý kiến chủ quan không có tiêu chí xác định đúng/sai.
- Nội dung yêu cầu kiến thức ngoài tài liệu.
- Danh sách hoặc bảng bị mất quan hệ giữa các cột.

### 15.3 Schema trung gian cho atomic fact

Khuyến nghị tạo artifact trung gian:

```json
{
  "fact_id": "fact_001",
  "section_key": "sec_003",
  "statement": "Nước sôi ở 100°C trong điều kiện áp suất khí quyển tiêu chuẩn.",
  "source_excerpt": "Nước sôi ở 100°C trong điều kiện áp suất khí quyển tiêu chuẩn.",
  "fact_type": "definition|property|rule|comparison|process|numeric|classification",
  "entities": ["nước"],
  "conditions": ["áp suất khí quyển tiêu chuẩn"],
  "answerable": true
}
```

`source_excerpt` phải là exact substring của canonical source. `statement` có thể được chuẩn hóa nhưng không được thay đổi nghĩa.

### 15.4 Điều kiện bắt buộc của mỗi MCQ

Mỗi câu chỉ hợp lệ khi:

1. Chỉ kiểm tra một kiến thức hoặc một quan hệ chính.
2. Prompt rõ ràng và hiểu được khi đứng độc lập.
3. Đáp án đúng được một hoặc nhiều `fact_id` chứng minh trực tiếp.
4. Có đúng bốn lựa chọn.
5. Có đúng một lựa chọn đúng.
6. `correct_index` trỏ đúng lựa chọn được nguồn hỗ trợ.
7. Ba distractor cùng loại ngữ nghĩa với đáp án đúng.
8. Distractor hợp lý nhưng sai rõ ràng theo nguồn.
9. Không có hai lựa chọn đồng nghĩa hoặc cùng đúng.
10. Không dùng các lựa chọn kiểu “tất cả đáp án trên” hoặc “không đáp án nào” nếu không có yêu cầu riêng.
11. Không thêm nguyên nhân, thời gian, kích thước, hệ quả hoặc điều kiện mà nguồn không nêu.
12. Không cần kiến thức ngoài file để trả lời.
13. `source_excerpt` là trích dẫn nguyên văn và đủ chứng minh đáp án.
14. `section_key`/locator trỏ đúng vị trí nguồn.
15. Không trùng semantic intent với câu đã chấp nhận.
16. Explanation chỉ diễn giải bằng bằng chứng trong nguồn.

Không được đánh dấu câu hợp lệ chỉ vì prompt và lựa chọn có cấu trúc đúng. Tính đúng của `correct_index` và evidence là hard gate.

### 15.5 Điều kiện của distractor

Distractor được phép tạo mới, nhưng phải tuân thủ:

- Cùng kiểu dữ liệu với đáp án đúng: người với người, năm với năm, khái niệm với khái niệm.
- Không vô lý đến mức người dùng chọn đáp án đúng mà không cần hiểu tài liệu.
- Không trở thành đúng trong một cách hiểu hợp lý khác.
- Không chứa thông tin bị source xác nhận là đúng.
- Không dựa trên giả định hoặc kiến thức ngoài nguồn để chứng minh là sai.
- Với số liệu, phải giữ đơn vị và độ chính xác nhất quán.
- Với phủ định, prompt phải làm nổi bật từ phủ định và tránh phủ định kép.

Validator nên kiểm tra lại từng lựa chọn theo câu hỏi, không chỉ kiểm tra đáp án đã chọn.

### 15.6 Tạo nhiều câu từ một fact

Một fact có thể tạo nhiều câu chỉ khi mỗi câu kiểm tra một góc nhận thức khác nhau và không phải paraphrase bề mặt.

Các dạng được phép:

- Nhận diện định nghĩa hoặc khái niệm.
- Ghép đặc điểm với đúng đối tượng.
- Phân loại một đối tượng theo quy tắc đã nêu.
- Phân biệt hai khái niệm mà nguồn mô tả.
- Chọn phát biểu được nguồn hỗ trợ.
- Nhận diện điều kiện áp dụng của quy tắc.
- Xác định bước trước/sau trong một quy trình.
- Tính toán trực tiếp từ số liệu và công thức có trong nguồn.
- Áp dụng quy tắc vào ví dụ khi kết quả suy ra chắc chắn từ source.

Các dạng không được tính là câu khác nhau:

- Chỉ đổi thứ tự từ.
- Chỉ đổi tên biến nhưng giữ nguyên bài toán.
- Đảo câu hỏi thành phủ định mà vẫn kiểm tra cùng một ý.
- Đổi thứ tự lựa chọn.
- Hỏi lại cùng fact với wording gần như tương đương.
- Tạo thêm câu bằng chi tiết không có trong nguồn.

Ví dụ hợp lệ từ một fact có cả đối tượng, thuộc tính và điều kiện:

- Hỏi giá trị thuộc tính.
- Hỏi điều kiện để giá trị đó đúng.
- Cho giá trị và điều kiện, hỏi đối tượng.

Nếu fact chỉ là một mệnh đề đơn giản không có quan hệ phụ, mặc định chỉ nên tạo một question opportunity.

### 15.7 Tính `max_supported_count`

Trước khi chấp nhận yêu cầu `requested_count`, hệ thống cần ước tính:

```text
max_supported_count =
  số question opportunities độc lập
  có evidence đầy đủ
  sau khi loại trùng semantic intent
```

Không được đồng nhất:

- Số section với số câu tối đa.
- Số concept với số câu tối đa.
- Số paragraph với số fact.
- Số fact với số câu một cách máy móc.

Một section có thể hỗ trợ nhiều câu. Một fact giàu cấu trúc có thể hỗ trợ nhiều góc hỏi. Ngược lại, nhiều câu văn có thể chỉ lặp cùng một fact.

### 15.8 Xử lý khi nguồn không đủ

Hai yêu cầu “luôn đủ số câu” và “không bịa/không lặp” có thể xung đột. Không có prompt nào bảo đảm 40 câu hợp lệ từ tài liệu chỉ hỗ trợ 5 question opportunities.

Quy tắc sản phẩm:

```text
if requested_count <= max_supported_count:
  bắt buộc trả đúng requested_count
else:
  không generate cưỡng ép
  không trả success với số câu thấp hơn
  trả lỗi SOURCE_CAPACITY_INSUFFICIENT
  cung cấp max_supported_count và lý do
```

Response gợi ý:

```json
{
  "error": "SOURCE_CAPACITY_INSUFFICIENT",
  "requested_count": 40,
  "max_supported_count": 12,
  "message": "Nguồn chỉ hỗ trợ 12 câu khác nhau có đủ bằng chứng."
}
```

Chỉ khi người dùng xác nhận chấp nhận số lượng thấp hơn mới tạo theo `max_supported_count`. Không được tự động hạ count rồi báo thành công.

### 15.9 Hard gates cho tài liệu lý thuyết

```text
requested_count == selected_count
selected_count == unique_count
selected_count == evidence_valid_count
selected_count == persisted_count
returned_question_ids.length == requested_count

choices.length == 4 cho mọi câu
correct_answer_count == 1 cho mọi câu
answer_supported == true cho mọi câu
source_excerpt_exact_match == true cho mọi câu
```

Thứ tự gate:

1. Source readiness.
2. Capacity.
3. Cardinality.
4. Schema và structure.
5. Answer/evidence.
6. Duplicate.
7. Persistence.
8. Quality judge.

Một câu fail evidence phải bị loại trước khi tính đủ count.

### 15.10 Ngưỡng đánh giá

Hard metrics:

| Metric | Ngưỡng |
|---|---:|
| Requested count match | 100% |
| Post-process count match | 100% |
| Persisted count match | 100% |
| Schema validity | 100% |
| Four choices | 100% |
| Exactly one correct answer | 100% |
| Correct answer evidence coverage | 100% |
| Unsupported correct answers | 0 |
| API success khi count sai | 0 |
| Mất dữ liệu cũ khi lỗi | 0 |

Quality metrics:

| Metric | Ngưỡng |
|---|---:|
| Exact source excerpt | ≥95% trong giai đoạn chuyển đổi, mục tiêu 100% |
| Answer groundedness | ≥95% |
| Duplicate-free | ≥99% |
| Semantic intent diversity | ≥90% |
| Distractor quality | ≥85% |
| G-Eval overall quality | ≥85% |

Vì exact excerpt có thể kiểm tra tất định bằng code, mục tiêu production cuối cùng nên là 100%, không dừng ở 95%.

### 15.11 DeepEval test set cần bổ sung

Bộ test phải có:

- Tài liệu lý thuyết dài, đủ hơn 40 opportunities.
- Tài liệu ngắn, không đủ số lượng yêu cầu.
- Nhiều paragraph nhưng lặp cùng facts.
- Một section chứa nhiều facts độc lập.
- Một fact giàu cấu trúc hỗ trợ nhiều dạng câu.
- Facts có điều kiện và ngoại lệ.
- Bảng, danh sách, số liệu và công thức.
- OCR lỗi hoặc mất ký tự.
- Nội dung mâu thuẫn giữa hai section.
- Tiếng Việt, tiếng Anh và song ngữ.
- Tài liệu chứa ý kiến thay vì facts.
- Tài liệu có thuật ngữ gần nghĩa dễ tạo hai đáp án đúng.

Evaluator phải báo riêng:

- `source_readiness_pass`
- `capacity_estimation_error`
- `raw_count_match`
- `postprocess_count_match`
- `persisted_count_match`
- `answer_evidence_coverage`
- `unsupported_answer_count`
- `semantic_duplicate_count`
- `exact_excerpt_rate`
- `distractor_validity`

### 15.12 Yêu cầu rõ ràng cho prompt

Prompt cho file lý thuyết cần có contract:

```text
Use only supplied canonical facts.
Every question must reference one or more fact_id values.
The correct answer must be directly entailed by those facts.
Return exactly TARGET questions only when TARGET does not exceed the
supported question capacity supplied by the application.
Multiple questions may share a concept_id, but they must test different
semantic intents.
Do not use external knowledge to create questions, answers, or explanations.
Do not invent missing causes, examples, dates, values, or consequences.
Before returning, verify question count, uniqueness, evidence, four choices,
and exactly one correct answer for every question.
```

Application phải truyền `TARGET`, accepted fact list và capacity decision vào prompt. Không giao cho model tự nâng capacity chỉ để đáp ứng target.

### 15.13 Definition of Done bổ sung

Luồng tài liệu lý thuyết chỉ hoàn tất khi:

1. Atomic facts có evidence và locator.
2. Capacity được tính trước generation.
3. Yêu cầu trong capacity trả đúng số câu 100%.
4. Yêu cầu vượt capacity bị từ chối rõ ràng.
5. Không có câu nào cần kiến thức ngoài source.
6. Mọi `correct_index` được evidence chứng minh.
7. Nhiều câu cùng concept vẫn được giữ nếu khác semantic intent.
8. Câu trùng ý bị loại và được retry phần thiếu.
9. DB chỉ nhận batch đúng count và đạt hard gates.
10. DeepEval kiểm tra cả raw output, post-process và persisted output.
