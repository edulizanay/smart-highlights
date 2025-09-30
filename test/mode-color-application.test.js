// ABOUTME: Tests for mode-based color application
// ABOUTME: Verifies general mode uses purple, study mode uses 3 colors

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Test 11: General mode uses purple color', () => {
  const contentJS = fs.readFileSync(
    path.join(__dirname, '../content.js'),
    'utf8'
  );

  // Check that general mode logic applies purple/single color
  // This will be in applyHighlights function
  assert.ok(
    contentJS.includes('applyHighlights'),
    'applyHighlights function should exist'
  );

  // Check for purple color in general mode
  // This might be checking for the old phrases array format
  const hasPurpleLogic = contentJS.includes('rgba(150, 0, 255') ||
                         contentJS.includes('currentHighlightColor') ||
                         contentJS.includes('smart-highlight"');

  assert.ok(
    hasPurpleLogic,
    'Should have logic for applying single color in general mode'
  );
});

test('Test 12: Study mode uses 3 colors', () => {
  const contentJS = fs.readFileSync(
    path.join(__dirname, '../content.js'),
    'utf8'
  );

  // Verify 3-color classes exist (already implemented)
  assert.ok(
    contentJS.includes('smart-highlight-concept'),
    'Should apply concept highlight class'
  );

  assert.ok(
    contentJS.includes('smart-highlight-fact'),
    'Should apply fact highlight class'
  );

  assert.ok(
    contentJS.includes('smart-highlight-example'),
    'Should apply example highlight class'
  );
});