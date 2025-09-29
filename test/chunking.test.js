// ABOUTME: TDD tests for paragraph chunking logic before implementation
// ABOUTME: Tests chunking by character count while keeping paragraphs intact

const { test } = require('node:test');
const assert = require('assert');

// Mock data based on our actual extracted data
const mockExtractedData = {
  "para_0": "OpenRouter provides a unified API that gives you access to hundreds of AI models through a single endpoint, while automatically handling fallbacks and selecting the most cost-effective options. Get started with just a few lines of code using your preferred SDK or framework.", // 335 chars
  "para_1": "Looking for information about free models and rate limits? Please see the FAQ", // 95 chars
  "para_2": "In the examples below, the OpenRouter-specific headers are optional. Setting them allows your app to appear on the OpenRouter leaderboards. For detailed information about app attribution, see our App Attribution guide.", // 245 chars
  "para_3": "You can use the interactive Request Builder to generate OpenRouter API requests in the language of your choice.", // 115 chars
  "para_4": "The API also supports streaming.", // 32 chars
  "para_5": "For information about using third-party SDKs and frameworks with OpenRouter, please see our frameworks documentation.", // 135 chars
  "para_6": "Hi, I'm an AI assistant with access to documentation and other content.", // 82 chars
  "para_7": "Tip: you can toggle this pane with" // 35 chars
};

// Function to be implemented (TDD - write test first)
function chunkParagraphs(extractedData, maxChars = 500) {
  const chunks = [];
  const paragraphEntries = Object.entries(extractedData);

  if (paragraphEntries.length === 0) {
    return chunks;
  }

  let currentChunk = {
    chunkIndex: 0,
    totalChunks: 0, // Will be set after we know total count
    paragraphs: {},
    charCount: 0
  };

  for (const [paraId, text] of paragraphEntries) {
    const textLength = text.length;

    // If adding this paragraph would exceed maxChars AND we already have content,
    // start a new chunk (but always include at least one paragraph per chunk)
    if (currentChunk.charCount > 0 && currentChunk.charCount + textLength > maxChars) {
      chunks.push(currentChunk);

      // Start new chunk
      currentChunk = {
        chunkIndex: chunks.length,
        totalChunks: 0,
        paragraphs: {},
        charCount: 0
      };
    }

    // Add paragraph to current chunk
    currentChunk.paragraphs[paraId] = text;
    currentChunk.charCount += textLength;
  }

  // Add the last chunk if it has content
  if (Object.keys(currentChunk.paragraphs).length > 0) {
    chunks.push(currentChunk);
  }

  // Set totalChunks for all chunks
  const totalChunks = chunks.length;
  chunks.forEach(chunk => {
    chunk.totalChunks = totalChunks;
  });

  return chunks;
}

test('should create chunks that respect paragraph boundaries', () => {
    const chunks = chunkParagraphs(mockExtractedData, 500);

    // Each chunk should contain complete paragraphs only
    chunks.forEach(chunk => {
      Object.keys(chunk.paragraphs).forEach(paraId => {
        assert.strictEqual(chunk.paragraphs[paraId], mockExtractedData[paraId],
          `Paragraph ${paraId} should be complete and unchanged`);
      });
    });
});

test('should create multiple chunks for large content', () => {
    const chunks = chunkParagraphs(mockExtractedData, 500);

    // With our mock data (~1074 chars total), we should get 2-3 chunks
    assert(chunks.length >= 2, 'Should create multiple chunks for content > maxChars');
    assert(chunks.length <= 4, 'Should not create too many tiny chunks');
});

test('should include chunk metadata', () => {
    const chunks = chunkParagraphs(mockExtractedData, 500);

    chunks.forEach((chunk, index) => {
      assert.strictEqual(chunk.chunkIndex, index, 'Chunk should have correct index');
      assert.strictEqual(chunk.totalChunks, chunks.length, 'Chunk should know total count');
      assert(chunk.paragraphs, 'Chunk should have paragraphs object');
      assert(typeof chunk.charCount === 'number', 'Chunk should track character count');
    });
});

test('should allow chunks to exceed maxChars to keep paragraphs intact', () => {
    // Test with a very small maxChars to force oversized chunks
    const chunks = chunkParagraphs(mockExtractedData, 100);

    // para_0 is 335 chars, so first chunk should exceed 100 chars
    const firstChunk = chunks[0];
    assert(firstChunk.charCount > 100, 'Should allow chunks to exceed maxChars for paragraph integrity');
    assert(firstChunk.paragraphs['para_0'], 'Should include the long paragraph completely');
});

test('should process paragraphs in order', () => {
    const chunks = chunkParagraphs(mockExtractedData, 500);

    let lastSeenParaIndex = -1;
    chunks.forEach(chunk => {
      Object.keys(chunk.paragraphs).forEach(paraId => {
        const paraIndex = parseInt(paraId.split('_')[1]);
        assert(paraIndex > lastSeenParaIndex, 'Paragraphs should be processed in sequential order');
        lastSeenParaIndex = paraIndex;
      });
    });
});

test('should handle edge case of single large paragraph', () => {
    const singleLargePara = {
      "para_0": "A".repeat(1000) // 1000 character paragraph
    };

    const chunks = chunkParagraphs(singleLargePara, 500);

    assert.strictEqual(chunks.length, 1, 'Single large paragraph should create one chunk');
    assert.strictEqual(chunks[0].charCount, 1000, 'Chunk should contain full paragraph');
    assert(chunks[0].paragraphs['para_0'], 'Should contain the paragraph');
});

test('should handle empty input', () => {
    const chunks = chunkParagraphs({}, 500);

    assert.strictEqual(chunks.length, 0, 'Empty input should return empty array');
});

// Export for use in implementation
module.exports = { chunkParagraphs, mockExtractedData };