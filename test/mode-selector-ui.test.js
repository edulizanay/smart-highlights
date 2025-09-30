// ABOUTME: Tests for mode selector UI elements
// ABOUTME: Verifies icons, popup structure, and CSS exist

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Test 4: Turtle icon exists in LUCIDE_ICONS', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Check for turtle icon in LUCIDE_ICONS object
  assert.ok(
    contentUIJS.includes('turtle:') || contentUIJS.includes('"turtle"'),
    'Should have turtle icon in LUCIDE_ICONS'
  );

  // Verify it contains SVG
  const turtleMatch = contentUIJS.match(/turtle:\s*`<svg/);
  assert.ok(turtleMatch, 'Turtle icon should be a valid SVG');
});

test('Test 5: Mode selector popup structure exists', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Check for mode selector container
  assert.ok(
    contentUIJS.includes('mode-selector-popup') ||
    contentUIJS.includes('modeSelector'),
    'Should have mode selector popup container'
  );

  // Check for mode icons
  assert.ok(
    contentUIJS.includes('mode-icon') ||
    contentUIJS.includes('data-mode'),
    'Should have mode icon elements'
  );
});

test('Test 6: Mode selector CSS exists', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Check for CSS class definitions
  assert.ok(
    contentUIJS.includes('.mode-selector-popup') ||
    contentUIJS.includes('mode-selector-popup'),
    'Should have mode selector popup CSS'
  );

  assert.ok(
    contentUIJS.includes('.mode-icon') ||
    contentUIJS.includes('mode-icon'),
    'Should have mode icon CSS'
  );

  assert.ok(
    contentUIJS.includes('selected') &&
    (contentUIJS.includes('.mode-icon') || contentUIJS.includes('mode-icon')),
    'Should have selected state CSS for mode icons'
  );
});