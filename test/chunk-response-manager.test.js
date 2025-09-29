// ABOUTME: TDD tests for ChunkResponseManager class before implementation
// ABOUTME: Tests response queuing and sequential highlight application

const { test } = require('node:test');
const assert = require('assert');

// Mock highlight data structure (based on our actual LLM responses)
const mockHighlights = {
  chunk0: [
    {"id": "para_0", "phrases": ["unified API", "hundreds of AI models", "single endpoint"]}
  ],
  chunk1: [
    {"id": "para_1", "phrases": ["free models", "rate limits"]},
    {"id": "para_2", "phrases": ["OpenRouter-specific headers", "leaderboards"]}
  ],
  chunk2: [
    {"id": "para_3", "phrases": ["interactive Request Builder"]},
    {"id": "para_4", "phrases": ["streaming"]},
    {"id": "para_5", "phrases": ["third-party SDKs"]}
  ]
};

// Mock highlight application function
let appliedHighlights = [];
function mockApplyHighlights(highlights) {
  appliedHighlights.push(...highlights);
  return highlights.length;
}

// Chunk Response Manager for coordinating parallel LLM responses
class ChunkResponseManager {
  constructor(totalChunks, applyHighlightsFunction) {
    this.totalChunks = totalChunks;
    this.applyHighlights = applyHighlightsFunction;
    this.nextChunkToProcess = 0;
    this.responses = new Map(); // chunkIndex -> highlights
    this.processedChunks = new Set();
  }

  addResponse(chunkIndex, highlights) {
    // Ignore duplicate responses
    if (this.responses.has(chunkIndex)) {
      return;
    }

    // Store the response
    this.responses.set(chunkIndex, highlights);

    // Process any ready chunks starting from nextChunkToProcess
    this.processNextReady();
  }

  processNextReady() {
    // Process chunks in order if they're ready
    while (this.responses.has(this.nextChunkToProcess) &&
           !this.processedChunks.has(this.nextChunkToProcess)) {

      const highlights = this.responses.get(this.nextChunkToProcess);
      this.processedChunks.add(this.nextChunkToProcess);

      // Apply highlights if any exist
      if (highlights && highlights.length > 0) {
        this.applyHighlights(highlights);
      }

      this.nextChunkToProcess++;
    }
  }

  isComplete() {
    return this.processedChunks.size === this.totalChunks;
  }
}

test('should initialize with correct total chunks', () => {
    appliedHighlights = []; // Reset for each test
    const manager = new ChunkResponseManager(3, mockApplyHighlights);

    assert.strictEqual(manager.totalChunks, 3, 'Should track total chunks');
    assert.strictEqual(manager.nextChunkToProcess, 0, 'Should start with chunk 0');
    assert.strictEqual(manager.isComplete(), false, 'Should not be complete initially');
});

test('should queue responses that arrive out of order', () => {
    appliedHighlights = [];
    const manager = new ChunkResponseManager(3, mockApplyHighlights);

    // Simulate chunk 2 arriving first
    manager.addResponse(2, mockHighlights.chunk2);
    assert.strictEqual(appliedHighlights.length, 0, 'Should not apply chunk 2 immediately');

    // Simulate chunk 1 arriving second
    manager.addResponse(1, mockHighlights.chunk1);
    assert.strictEqual(appliedHighlights.length, 0, 'Should not apply chunk 1 before chunk 0');

    // Simulate chunk 0 arriving last
    manager.addResponse(0, mockHighlights.chunk0);

    // Now chunk 0 should be applied, and it should trigger chunk 1
    assert(appliedHighlights.length > 0, 'Should start applying highlights when chunk 0 arrives');
  });

  test('should process chunks in sequential order regardless of arrival', () => {
    appliedHighlights = [];
    const manager = new ChunkResponseManager(3, mockApplyHighlights);

    // Add responses in reverse order: 2, 1, 0
    manager.addResponse(2, mockHighlights.chunk2);
    manager.addResponse(1, mockHighlights.chunk1);
    manager.addResponse(0, mockHighlights.chunk0);

    // All should be processed automatically in order 0, 1, 2
    const chunk0Highlights = mockHighlights.chunk0;
    const chunk1Highlights = mockHighlights.chunk1;
    const chunk2Highlights = mockHighlights.chunk2;

    // Verify chunk 0 highlights appear first in applied highlights
    assert.strictEqual(appliedHighlights[0].id, chunk0Highlights[0].id, 'Chunk 0 should be applied first');

    // Verify all chunks processed in order (automatically triggered)
    const totalExpected = chunk0Highlights.length + chunk1Highlights.length + chunk2Highlights.length;
    assert.strictEqual(appliedHighlights.length, totalExpected, 'All highlights should be applied');

    // Verify manager reports completion
    assert.strictEqual(manager.isComplete(), true, 'Manager should report completion');
  });

  test('should handle chunks arriving in correct order', () => {
    const manager = new ChunkResponseManager(3, mockApplyHighlights);

    // Add responses in correct order: 0, 1, 2
    manager.addResponse(0, mockHighlights.chunk0);
    assert(appliedHighlights.length > 0, 'Chunk 0 should apply immediately');

    const countAfterChunk0 = appliedHighlights.length;

    manager.addResponse(1, mockHighlights.chunk1);
    assert(appliedHighlights.length > countAfterChunk0, 'Chunk 1 should apply immediately after chunk 0');

    const countAfterChunk1 = appliedHighlights.length;

    manager.addResponse(2, mockHighlights.chunk2);
    assert(appliedHighlights.length > countAfterChunk1, 'Chunk 2 should apply immediately after chunk 1');
  });

  test('should track completion status correctly', () => {
    const manager = new ChunkResponseManager(3, mockApplyHighlights);

    assert.strictEqual(manager.isComplete(), false, 'Should not be complete initially');

    manager.addResponse(0, mockHighlights.chunk0);
    assert.strictEqual(manager.isComplete(), false, 'Should not be complete with only chunk 0');

    manager.addResponse(1, mockHighlights.chunk1);
    manager.processNextReady();
    assert.strictEqual(manager.isComplete(), false, 'Should not be complete with chunks 0,1');

    manager.addResponse(2, mockHighlights.chunk2);
    manager.processNextReady();
    assert.strictEqual(manager.isComplete(), true, 'Should be complete with all chunks processed');
  });

  test('should handle duplicate responses gracefully', () => {
    const manager = new ChunkResponseManager(2, mockApplyHighlights);

    manager.addResponse(0, mockHighlights.chunk0);
    const countAfterFirst = appliedHighlights.length;

    // Add same chunk again
    manager.addResponse(0, mockHighlights.chunk0);

    assert.strictEqual(appliedHighlights.length, countAfterFirst,
      'Should not apply same chunk twice');
  });

test('should handle empty highlights gracefully', () => {
    appliedHighlights = [];
    const manager = new ChunkResponseManager(2, mockApplyHighlights);

    manager.addResponse(0, []); // Empty highlights
    manager.addResponse(1, mockHighlights.chunk1);
    manager.processNextReady();

    // Should still process chunk 1 even though chunk 0 was empty
    assert(appliedHighlights.length > 0, 'Should process non-empty chunks even if some are empty');
});

// Export for use in implementation
module.exports = { ChunkResponseManager, mockHighlights, mockApplyHighlights };