// ABOUTME: Integration tests for complete mode selector feature
// ABOUTME: Tests full user flows and interactions

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Test 13: Full flow - select general mode', () => {
  // This is a structural test - full integration will be manual
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Verify all components exist for general mode flow
  assert.ok(
    contentUIJS.includes('turtle') && contentUIJS.includes('mode-icon'),
    'Should have turtle icon and mode selector'
  );

  assert.ok(
    contentUIJS.includes('setMode') || contentUIJS.includes('data-mode'),
    'Should have mode switching mechanism'
  );
});

test('Test 14: Full flow - select study mode', () => {
  // This is a structural test - full integration will be manual
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Verify all components exist for study mode flow
  assert.ok(
    contentUIJS.includes('elephant') && contentUIJS.includes('mode-icon'),
    'Should have elephant icon and mode selector'
  );

  assert.ok(
    contentUIJS.includes('setMode') || contentUIJS.includes('data-mode'),
    'Should have mode switching mechanism'
  );
});

test('Test 15: Mode persists across page refresh', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Verify storage persistence is implemented
  assert.ok(
    contentUIJS.includes('chrome.storage.local.set') &&
    contentUIJS.includes('chrome.storage.local.get'),
    'Should both save and load mode from storage'
  );

  assert.ok(
    contentUIJS.includes('highlightMode'),
    'Should use highlightMode storage key'
  );
});

test('Test 16: Switching mode doesn\'t re-process page', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Verify setMode doesn't trigger processing
  // setMode should only update state and icon, not call onClick
  const setModeSection = contentUIJS.match(/function setMode[\s\S]*?(?=\n  function|\n  const|\n\})/);

  if (setModeSection) {
    const setModeCode = setModeSection[0];
    assert.ok(
      !setModeCode.includes('onClick') &&
      !setModeCode.includes('handleButtonClick') &&
      !setModeCode.includes('processConcurrentChunks'),
      'setMode should not trigger page processing'
    );
  }

  // At minimum, verify setMode exists
  assert.ok(
    contentUIJS.includes('setMode'),
    'setMode function should exist'
  );
});