# Doc2Quiz Prompt DeepEval Report

- Model: `cx/gpt-5.6-sol`
- Cases: 3 x 5 repetitions
- Valid outputs: 15/15
- Overall: **FAIL**

## Aggregate

- schema_pass_rate: 100.0%
- count_pass_rate: 93.3%
- structure_pass_rate: 100.0%
- duplicate_free_rate: 100.0%
- mean_source_excerpt_grounding: 57.3%
- mean_groundedness: 71.3%
- mean_quality: 82.0%
- api_error_count: 0
- judge_error_count: 0

## Threshold Checks

- schema_pass_rate: PASS
- count_pass_rate: FAIL
- structure_pass_rate: PASS
- duplicate_free_rate: PASS
- mean_source_excerpt_grounding: FAIL
- mean_groundedness: FAIL
- mean_quality: PASS
- api_error_count: PASS
- judge_error_count: PASS

## Cases

- `dedialynghean-18_mul_ques`: schema=100.0%, count=100.0%, generated=18.0, groundedness=0.9400000000000001, quality=0.86, answer_key=True
- `delichsunghean-24_mul_ques`: schema=100.0%, count=80.0%, generated=24.8, groundedness=0.26, quality=0.78, answer_key=False
- `detienganhnghean-40_mul_ques`: schema=100.0%, count=100.0%, generated=40.0, groundedness=0.9400000000000001, quality=0.8200000000000001, answer_key=True
