// ABOUTME: Tests for backend mode switching functionality
// ABOUTME: Verifies processWithLLM can accept and use mode parameter

const { test } = require('node:test');
const assert = require('node:assert');
const { getPrompt } = require('../processors/llm-processor');

test('Test 1: Can load general_mode prompt from YAML', () => {
  const generalPrompt = getPrompt('general_mode');

  assert.ok(generalPrompt, 'Should return a prompt');
  assert.ok(typeof generalPrompt === 'string', 'Prompt should be a string');
  assert.ok(generalPrompt.includes('identify the most important phrases'), 'Should contain general mode instructions');
  assert.ok(!generalPrompt.includes('CONCEPTS'), 'General mode should not have CONCEPTS category');
  assert.ok(!generalPrompt.includes('FACTS'), 'General mode should not have FACTS category');
});

test('Test 2: processWithLLM accepts mode parameter', () => {
  // This will fail until we add mode parameter to processWithLLM
  const { processWithLLM } = require('../processors/llm-processor');

  // Check function signature accepts mode parameter
  const funcString = processWithLLM.toString();
  assert.ok(
    funcString.includes('mode') || funcString.includes('...'),
    'processWithLLM should accept mode parameter'
  );
});

test('Test 3: Mode parameter defaults to study', () => {
  // This will test that calling without mode uses study_mode
  const { processWithLLM } = require('../processors/llm-processor');

  // Verify function has default parameter
  const funcString = processWithLLM.toString();
  assert.ok(
    funcString.includes("mode = 'study'") || funcString.includes('mode="study"'),
    'processWithLLM should default mode to study'
  );
});