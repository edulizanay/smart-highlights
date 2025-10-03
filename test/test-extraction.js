// ABOUTME: Test file for extraction script that parses NDJSON logs
// ABOUTME: Verifies correct transformation from log format to structured test case format

const fs = require('fs');
const path = require('path');
const { extractFromLog } = require('../evals/run-eval.js');

// Mock NDJSON data
const mockNDJSON = `{"run_id":1,"chunkIndex":0,"paragraphs":{"para_1":"Test text"},"highlights":[{"id":"para_1","terms":["test"]}]}
{"run_id":1,"chunkIndex":1,"paragraphs":{"para_2":"More text"},"highlights":[{"id":"para_2","concepts":["concept"]}]}`;

// Expected output structure
const expectedOutput = {
  name: "Article Test",
  chunks: [
    {
      chunk_id: "chunk_0",
      paragraphs: { "para_1": "Test text" },
      llm_output: {
        "para_1": { terms: ["test"], concepts: [], examples: [] }
      }
    },
    {
      chunk_id: "chunk_1",
      paragraphs: { "para_2": "More text" },
      llm_output: {
        "para_2": { terms: [], concepts: ["concept"], examples: [] }
      }
    }
  ]
};

// Write mock NDJSON to temp file
const tempFile = path.join(__dirname, 'temp-test.ndjson');
fs.writeFileSync(tempFile, mockNDJSON);

try {
  // Run extraction
  const result = extractFromLog(tempFile);

  // Validate structure
  if (!result.name) {
    throw new Error('Missing name field');
  }

  if (!Array.isArray(result.chunks) || result.chunks.length !== 2) {
    throw new Error(`Expected 2 chunks, got ${result.chunks?.length || 0}`);
  }

  // Validate first chunk
  const chunk0 = result.chunks[0];
  if (chunk0.chunk_id !== 'chunk_0') {
    throw new Error(`Expected chunk_id 'chunk_0', got '${chunk0.chunk_id}'`);
  }

  if (chunk0.paragraphs['para_1'] !== 'Test text') {
    throw new Error(`Paragraph text mismatch in chunk 0`);
  }

  if (!chunk0.llm_output['para_1']) {
    throw new Error('Missing llm_output for para_1');
  }

  if (chunk0.llm_output['para_1'].terms[0] !== 'test') {
    throw new Error('Terms not extracted correctly in chunk 0');
  }

  // Validate second chunk
  const chunk1 = result.chunks[1];
  if (chunk1.chunk_id !== 'chunk_1') {
    throw new Error(`Expected chunk_id 'chunk_1', got '${chunk1.chunk_id}'`);
  }

  if (chunk1.llm_output['para_2'].concepts[0] !== 'concept') {
    throw new Error('Concepts not extracted correctly in chunk 1');
  }

  // Clean up temp file
  fs.unlinkSync(tempFile);

  console.log('✓ Extraction test passed - structure matches expected format');
  process.exit(0);

} catch (error) {
  // Clean up temp file if it exists
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }

  console.error('✗ Extraction test failed:', error.message);
  process.exit(1);
}
