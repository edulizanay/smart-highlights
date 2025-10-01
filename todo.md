# Eval System Implementation Plan

## Goal
Build an evaluation system to measure highlighting accuracy and iterate on prompt improvements.

---

## Implementation Checklist

### Phase 1: Extraction Script

- [ ] **Create test file: `evals/test-extraction.js`**
  - Input: Mock NDJSON with 2 log entries:
    ```
    {"chunkIndex":0,"paragraphs":{"para_1":"Test text"},"highlights":[{"id":"para_1","terms":["test"]}]}
    {"chunkIndex":1,"paragraphs":{"para_2":"More text"},"highlights":[{"id":"para_2","concepts":["concept"]}]}
    ```
  - Expected output structure:
    ```json
    {
      "name": "Article Test - [timestamp]",
      "chunks": [
        {
          "chunk_id": "chunk_0",
          "paragraphs": {"para_1": "Test text"},
          "llm_output": {"para_1": {"terms": ["test"], "concepts": [], "examples": []}}
        },
        {
          "chunk_id": "chunk_1",
          "paragraphs": {"para_2": "More text"},
          "llm_output": {"para_2": {"terms": [], "concepts": ["concept"], "examples": []}}
        }
      ]
    }
    ```
  - Test assertion: Output JSON structure matches expected, all fields present

- [ ] **Run test - should FAIL (script doesn't exist yet)**
  - Command: `node evals/test-extraction.js`
  - Expected: Test fails with "extraction script not found" or similar

- [ ] **Create `evals/extract-test-case.js`**
  - Read NDJSON line-by-line from `logs/processing-log.ndjson`
  - Parse each line, extract: chunkIndex, paragraphs, highlights
  - Transform highlights array into organized structure by paragraph ID
  - Output to `evals/raw-llm-run.json`

- [ ] **Run test - should PASS**
  - Command: `node evals/test-extraction.js`
  - Expected: "✓ Extraction test passed - structure matches expected format"

- [ ] **Run extraction on real log**
  - Command: `node evals/extract-test-case.js`
  - Expected: `evals/raw-llm-run.json` created with 38 chunks
  - Verify: Open file, check first chunk has correct paragraph text + LLM highlights

### Phase 2: Build Gold Standard (Manual - No Code)

- [ ] **Load and review `evals/raw-llm-run.json`**
  - Understand chunk structure
  - Note: Claude will ONLY see chunk context (same as LLM)

- [ ] **Iterate on TERMS category (paragraphs 1-8)**
  - Claude proposes TERMS highlights from chunk context only
  - Claude explains WHY each term should be highlighted
  - Edu reviews and provides feedback
  - Adjust until agreement
  - Document any "missed due to lack of context" cases

- [ ] **Iterate on CONCEPTS category (paragraphs 1-8)**
  - Same process as TERMS
  - Claude sees only chunk context (same limitations as LLM)

- [ ] **Iterate on EXAMPLES category (paragraphs 1-8)**
  - Same process as TERMS/CONCEPTS
  - Claude sees only chunk context

- [ ] **Create `evals/gold-standard.json` manually**
  - Based on agreed highlights from above iterations
  - Format:
    ```json
    {
      "name": "Article Test - Gold Standard",
      "chunks": [
        {
          "chunk_id": "chunk_0",
          "paragraphs": {"para_1": "text..."},
          "expected": {
            "para_1": {"terms": ["agreed term"], "concepts": [], "examples": []}
          }
        }
      ]
    }
    ```

### Phase 3: Eval Runner

- [ ] **Create test file: `evals/test-eval.js`**
  - Mock gold standard (2 paragraphs):
    ```json
    {
      "chunks": [{
        "chunk_id": "chunk_0",
        "paragraphs": {"para_1": "text"},
        "expected": {"para_1": {"terms": ["expected1", "expected2"], "concepts": [], "examples": []}}
      }]
    }
    ```
  - Mock LLM output (2 paragraphs):
    ```json
    {
      "chunks": [{
        "chunk_id": "chunk_0",
        "paragraphs": {"para_1": "text"},
        "llm_output": {"para_1": {"terms": ["expected1", "wrong1"], "concepts": [], "examples": []}}
      }]
    }
    ```
  - Expected metrics:
    - Expected highlights: 2 (expected1, expected2)
    - Found highlights: 2 (expected1, wrong1)
    - Correct: 1 (expected1)
    - Accuracy: 50% (1/2)
    - Missed: ["expected2"]
    - Wrong: ["wrong1"]
  - Test assertion: Metrics calculation matches expected values exactly

- [ ] **Run test - should FAIL (script doesn't exist yet)**
  - Command: `node evals/test-eval.js`
  - Expected: Test fails with "eval script not found" or similar

- [ ] **Create `evals/run-eval.js`**
  - Accept `--range=X-Y` parameter (e.g., `--range=1-8`)
  - Load gold standard JSON
  - Load LLM output JSON (raw-llm-run.json or specified file)
  - Filter to paragraph range if specified
  - For each paragraph:
    - Compare expected highlights vs found highlights (exact string match)
    - Track: correct, missed, wrong
  - Calculate accuracy = correct / expected
  - Display terminal output with metrics
  - Save to `evals/results/run-[timestamp].json`

- [ ] **Run test - should PASS**
  - Command: `node evals/test-eval.js`
  - Expected: "✓ Eval test passed - metrics calculated correctly"

- [ ] **Run eval on paragraphs 1-8 (initial baseline)**
  - Command: `node evals/run-eval.js --range=1-8`
  - Expected: Terminal shows accuracy %, missed list, wrong list
  - Verify: `evals/results/run-[timestamp].json` created with detailed results

### Phase 4: Iteration & Expansion

- [ ] **Review 1-8 results, identify issues**
  - What terms/concepts/examples were missed?
  - What was incorrectly highlighted?
  - Any patterns?

- [ ] **Iterate on prompt improvements for paragraphs 1-8**
  - Adjust prompts based on findings
  - Re-run eval until accuracy acceptable

- [ ] **Expand gold standard to paragraphs 9-16**
  - Repeat Phase 2 process for new paragraph range
  - Update `gold-standard.json`

- [ ] **Run eval on paragraphs 9-16**
  - Command: `node evals/run-eval.js --range=9-16`
  - Iterate until accuracy acceptable

- [ ] **Run full eval on all paragraphs**
  - Command: `node evals/run-eval.js`
  - Get final baseline metrics for entire article

---

## File Structure
```
evals/
  ├── expected-highlights.json   # Baseline expected highlights
  ├── run-eval.js                # Eval runner (reads NDJSON directly)
  └── results/
      └── run-[timestamp].json   # Eval results (generated)

test/
  ├── test-eval.js               # Unit test for eval runner
  └── test-extraction.js         # Unit test for extraction logic
```

## Updated Workflow Commands

**Run eval on specific run and paragraph range:**
```bash
node evals/run-eval.js --run-id=1 --range=5-12
```

**Run eval on latest run:**
```bash
node evals/run-eval.js --range=5-12
```

**Run tests:**
```bash
node test/test-eval.js
node test/test-extraction.js
```

---

**⏸️ WAITING FOR EDU'S VALIDATION TO PROCEED**
