// ABOUTME: Test file for the eval runner system
// ABOUTME: Validates that metrics calculation works correctly with mock data

const assert = require('assert');
const { calculateMetrics } = require('../evals/run-eval.js');

// Mock gold standard - what we expect to find
const mockGoldStandard = {
  "name": "Mock Gold Standard",
  "paragraphs": {
    "para_1": {
      "text": "Test paragraph one",
      "expected": {
        "terms": ["expected1", "expected2"],
        "concepts": [],
        "examples": []
      }
    },
    "para_2": {
      "text": "Test paragraph two",
      "expected": {
        "terms": [],
        "concepts": ["concept1"],
        "examples": []
      }
    }
  }
};

// Mock LLM output - what was actually found
const mockLLMOutput = [
  {
    "chunk_id": "chunk_0",
    "paragraphs": {
      "para_1": "Test paragraph one"
    },
    "llm_output": {
      "para_1": {
        "terms": ["expected1", "wrong1"],
        "concepts": [],
        "examples": []
      }
    }
  },
  {
    "chunk_id": "chunk_1",
    "paragraphs": {
      "para_2": "Test paragraph two"
    },
    "llm_output": {
      "para_2": {
        "terms": [],
        "concepts": ["concept1"],
        "examples": []
      }
    }
  }
];

// Expected metrics from comparison
const expectedMetrics = {
  categories: {
    terms: {
      expected: 2,
      correct: 1,
      accuracy: 50,
      found: ["expected1"],
      missed: ["expected2"],
      wrong: ["wrong1"]
    },
    concepts: {
      expected: 1,
      correct: 1,
      accuracy: 100,
      found: ["concept1"],
      missed: [],
      wrong: []
    },
    examples: {
      expected: 0,
      correct: 0,
      accuracy: 0,
      found: [],
      missed: [],
      wrong: []
    }
  },
  overall: {
    totalExpected: 3,
    totalCorrect: 2,
    accuracy: 66.67
  }
};

console.log('Running eval test...\n');

try {
  const result = calculateMetrics(mockGoldStandard, mockLLMOutput);

  // Validate overall metrics
  assert.strictEqual(result.overall.totalExpected, expectedMetrics.overall.totalExpected,
    `Expected totalExpected=${expectedMetrics.overall.totalExpected}, got ${result.overall.totalExpected}`);
  assert.strictEqual(result.overall.totalCorrect, expectedMetrics.overall.totalCorrect,
    `Expected totalCorrect=${expectedMetrics.overall.totalCorrect}, got ${result.overall.totalCorrect}`);
  assert.strictEqual(result.overall.accuracy, expectedMetrics.overall.accuracy,
    `Expected accuracy=${expectedMetrics.overall.accuracy}, got ${result.overall.accuracy}`);

  // Validate category metrics
  ['terms', 'concepts', 'examples'].forEach(category => {
    const expected = expectedMetrics.categories[category];
    const actual = result.categories[category];

    assert.strictEqual(actual.expected, expected.expected,
      `${category}: Expected expected=${expected.expected}, got ${actual.expected}`);
    assert.strictEqual(actual.correct, expected.correct,
      `${category}: Expected correct=${expected.correct}, got ${actual.correct}`);
    assert.strictEqual(actual.accuracy, expected.accuracy,
      `${category}: Expected accuracy=${expected.accuracy}, got ${actual.accuracy}`);
    assert.deepStrictEqual(actual.found, expected.found,
      `${category}: Expected found=${JSON.stringify(expected.found)}, got ${JSON.stringify(actual.found)}`);
    assert.deepStrictEqual(actual.missed, expected.missed,
      `${category}: Expected missed=${JSON.stringify(expected.missed)}, got ${JSON.stringify(actual.missed)}`);
    assert.deepStrictEqual(actual.wrong, expected.wrong,
      `${category}: Expected wrong=${JSON.stringify(expected.wrong)}, got ${JSON.stringify(actual.wrong)}`);
  });

  console.log('✓ Eval test passed - metrics calculated correctly');
  console.log('\nTest results:');
  console.log(`  Overall accuracy: ${result.overall.accuracy}%`);
  console.log(`  Terms: ${result.categories.terms.accuracy}%`);
  console.log(`  Concepts: ${result.categories.concepts.accuracy}%`);
  console.log(`  Examples: ${result.categories.examples.accuracy}%`);

} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}
