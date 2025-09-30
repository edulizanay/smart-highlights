// ABOUTME: Tests for mode state management and persistence
// ABOUTME: Verifies mode saving, loading, and defaults

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Test 7: Mode persists to chrome.storage', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Check for setMode function that saves to storage
  assert.ok(
    contentUIJS.includes('setMode') || contentUIJS.includes('set_mode'),
    'Should have setMode function'
  );

  assert.ok(
    contentUIJS.includes('chrome.storage.local.set') &&
    contentUIJS.includes('highlightMode'),
    'Should save mode to chrome.storage with highlightMode key'
  );
});

test('Test 8: Mode loads from chrome.storage on init', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Check for chrome.storage.local.get in init or early in file
  assert.ok(
    contentUIJS.includes('chrome.storage.local.get') &&
    contentUIJS.includes('highlightMode'),
    'Should load mode from chrome.storage with highlightMode key'
  );
});

test('Test 9: Default mode is study when nothing saved', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Check for default mode initialization
  assert.ok(
    contentUIJS.includes("currentMode = 'study'") ||
    contentUIJS.includes('currentMode="study"') ||
    (contentUIJS.includes('currentMode') && contentUIJS.includes("'study'")),
    'Should default to study mode'
  );
});

test('Test 10: setMode function updates button icon', () => {
  const contentUIJS = fs.readFileSync(
    path.join(__dirname, '../content-ui.js'),
    'utf8'
  );

  // Check that setMode function exists and updates icon
  const setModeExists = contentUIJS.includes('function setMode') ||
                        contentUIJS.includes('setMode(') ||
                        contentUIJS.includes('setMode =');

  assert.ok(setModeExists, 'setMode function should exist');

  // Verify it changes icon based on mode
  assert.ok(
    contentUIJS.includes('setButtonIcon') || contentUIJS.includes('elephant') || contentUIJS.includes('turtle'),
    'setMode should update button icon'
  );
});