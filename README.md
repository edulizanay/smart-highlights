<!-- ABOUTME: README for smart-highlights, an AI browser extension with a built-in eval pipeline. -->
<!-- ABOUTME: Uses LLMs to highlight key phrases, with gold-standard evaluation measuring accuracy and volume. -->

# Smart Highlights

**Browser extension that uses LLMs to intelligently highlight important phrases, with a built-in eval pipeline for measuring highlight quality.**

---

## What It Does

Smart Highlights is a Chrome extension that reads any webpage and uses an LLM to identify and highlight the most important content. It supports two modes:

- **Study mode** -- highlights terms (purple), concepts (yellow), and examples (orange) with distinct colors per category
- **General mode** -- highlights key phrases across the page

The extension chunks large pages, processes chunks concurrently through an LLM, and applies highlights with smooth animations. A floating button lets you switch modes on the fly.

---

## Architecture

```
+------------------+       +------------------+       +------------------+
| Chrome Extension |  -->  | Express Server   |  -->  | OpenRouter API   |
| (content.js)     |       | (server.js)      |       | (Grok model)     |
|                  |       |                  |       |                  |
| - DOM extraction |       | - /extract route |       | - Prompt from    |
| - Chunking       |       | - LLM processor  |       |   YAML config    |
| - Highlight      |       | - NDJSON logging |       | - JSON response  |
|   application    |       |                  |       |                  |
+------------------+       +------------------+       +------------------+
                                    |
                           +--------v---------+
                           | Eval Pipeline    |
                           | (evals/)         |
                           |                  |
                           | - Gold standard  |
                           | - Accuracy per   |
                           |   category       |
                           | - Volume analysis|
                           | - 40+ eval runs  |
                           +------------------+
```

---

## Eval Pipeline

This is the part that matters for AI engineering. The project includes a full evaluation framework for measuring highlight quality:

**How it works:**
1. `raw-paragraphs.json` -- captured page content (the input)
2. `expected-highlights.json` -- human-annotated gold standard (what should be highlighted)
3. `run-eval.js` -- sends paragraphs through the LLM, compares output against gold standard

**Metrics calculated:**
- **Accuracy per category** -- what percentage of expected terms/concepts/examples were found
- **Missed items** -- expected highlights the LLM didn't catch
- **Wrong items** -- highlights the LLM added that weren't in the gold standard
- **Volume analysis** -- character-level comparison to detect over/under-highlighting (flags >20% deviation)

**Usage:**
```bash
node evals/run-eval.js --mode=study --range=5-12
```

Results are saved as timestamped JSON files in `evals/results/` for tracking quality across prompt iterations. The repo contains 40+ eval runs showing iterative prompt refinement.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome Manifest V3, vanilla JavaScript |
| Backend | Node.js, Express |
| LLM | OpenRouter API (Grok model, configurable) |
| Prompts | YAML-based templates with mode-specific configurations |
| Evals | Custom framework: gold-standard comparison, accuracy/volume metrics |
| Testing | Unit tests for parsing, chunking, mode switching, backend integration |

---

## Running Locally

```bash
npm install
cp .env.example .env        # Add OpenRouter API key
npm start                    # Express server on :3000
```

Then load the extension in Chrome: `chrome://extensions/` > Developer mode > Load unpacked > select this directory.

Test with `demo.html` or any article page with 4+ paragraphs.
