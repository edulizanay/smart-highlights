// ABOUTME: Tests for LLM response parsing with new multi-color format
// ABOUTME: Verifies correct handling of concepts, facts, and examples structure

const { test } = require('node:test');
const assert = require('node:assert');

test('Test 4: Parse new study_mode response format', () => {
  // Mock the extractResponseContent function behavior
  const { extractResponseContent } = require('../processors/llm-processor');

  const mockLLMResponse = `
<thinking>
This is the AI thinking process
</thinking>

<response>
{"highlights": [{"id": "para_0", "concepts": ["machine learning"], "facts": ["In 2024, accuracy reached 87%"], "examples": ["similar to teaching a child"]}]}
</response>
  `.trim();

  const extracted = extractResponseContent(mockLLMResponse);
  const parsed = JSON.parse(extracted);

  assert.ok(parsed.highlights, 'Should have highlights array');
  assert.equal(parsed.highlights.length, 1, 'Should have one highlight');

  const highlight = parsed.highlights[0];
  assert.equal(highlight.id, 'para_0', 'Should have correct ID');
  assert.ok(Array.isArray(highlight.concepts), 'Should have concepts array');
  assert.ok(Array.isArray(highlight.facts), 'Should have facts array');
  assert.ok(Array.isArray(highlight.examples), 'Should have examples array');

  assert.equal(highlight.concepts[0], 'machine learning', 'Should parse concept correctly');
  assert.equal(highlight.facts[0], 'In 2024, accuracy reached 87%', 'Should parse fact correctly');
  assert.equal(highlight.examples[0], 'similar to teaching a child', 'Should parse example correctly');
});

test('Test 5: Handle empty categories gracefully', () => {
  const { extractResponseContent } = require('../processors/llm-processor');

  // Response with empty concepts but has facts and examples
  const mockLLMResponse = `
<thinking>
This paragraph only has facts, no new concepts introduced
</thinking>

<response>
{"highlights": [{"id": "para_1", "concepts": [], "facts": ["The study was published in 2023"], "examples": []}]}
</response>
  `.trim();

  const extracted = extractResponseContent(mockLLMResponse);
  const parsed = JSON.parse(extracted);

  assert.ok(parsed.highlights, 'Should handle partial data');
  const highlight = parsed.highlights[0];

  assert.ok(Array.isArray(highlight.concepts), 'Empty concepts should still be array');
  assert.equal(highlight.concepts.length, 0, 'Concepts should be empty');
  assert.equal(highlight.facts.length, 1, 'Should have one fact');
  assert.equal(highlight.examples.length, 0, 'Examples should be empty');
});