// ABOUTME: Tests for YAML prompt loading and template replacement
// ABOUTME: Verifies prompt configuration can be loaded from external file

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Test 1: YAML file loads without errors', () => {
  const yamlPath = path.join(__dirname, '../processors/llm-prompts.yaml');
  assert.ok(fs.existsSync(yamlPath), 'YAML file should exist');

  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  assert.ok(yamlContent.length > 0, 'YAML file should not be empty');
  assert.ok(yamlContent.includes('study_mode'), 'YAML should contain study_mode');
  assert.ok(yamlContent.includes('general_mode'), 'YAML should contain general_mode');
});

test('Test 2: Can get study_mode prompt from YAML', () => {
  // This will fail until we implement the prompt loader
  const { getPrompt } = require('../processors/llm-processor');

  const studyPrompt = getPrompt('study_mode');

  assert.ok(studyPrompt, 'Should return a prompt');
  assert.ok(typeof studyPrompt === 'string', 'Prompt should be a string');
  assert.ok(studyPrompt.includes('You are a student'), 'Should contain study mode instructions');
  assert.ok(studyPrompt.includes('CONCEPTS'), 'Should define CONCEPTS category');
  assert.ok(studyPrompt.includes('FACTS'), 'Should define FACTS category');
  assert.ok(studyPrompt.includes('EXAMPLES'), 'Should define EXAMPLES category');
});

test('Test 3: Template placeholder gets replaced with actual JSON', () => {
  // This will fail until we implement template replacement
  const { fillTemplate } = require('../processors/llm-processor');

  const templatePrompt = 'Here is the data: {{PARAGRAPHS_JSON}}';
  const testData = { para_0: 'Test paragraph' };

  const filled = fillTemplate(templatePrompt, testData);

  assert.ok(!filled.includes('{{PARAGRAPHS_JSON}}'), 'Placeholder should be replaced');
  assert.ok(filled.includes('Test paragraph'), 'Should contain the actual data');
  assert.ok(filled.includes('para_0'), 'Should contain the paragraph ID');
});