# Mode Selector Feature - Implementation TODO

## Overview
Adding mode selector popup to switch between Study Mode (🐘 elephant, 3 colors) and General Mode (🐢 turtle, single purple color).

---

## PHASE 1: Write Tests First (TDD)

### Backend Tests - Mode Parameter
- [ ] **Test 1**: Can load general_mode prompt from YAML
  - File: `/test/backend-mode-switching.test.js`
  - Verify `getPrompt('general_mode')` returns valid prompt
  - Should FAIL now (processWithLLM doesn't accept mode parameter)

- [ ] **Test 2**: processWithLLM accepts mode parameter
  - File: `/test/backend-mode-switching.test.js`
  - Test both 'study' and 'general' modes
  - Should FAIL now (no mode parameter exists)

- [ ] **Test 3**: Mode parameter defaults to study
  - File: `/test/backend-mode-switching.test.js`
  - Call without mode parameter
  - Should FAIL now (no default handling)

### Frontend UI Tests
- [ ] **Test 4**: Turtle icon exists in LUCIDE_ICONS
  - File: `/test/mode-selector-ui.test.js`
  - Check for turtle SVG in content-ui.js
  - Should FAIL now (turtle icon doesn't exist)

- [ ] **Test 5**: Mode selector popup structure exists
  - File: `/test/mode-selector-ui.test.js`
  - Check for mode selector container
  - Should FAIL now (popup doesn't exist)

- [ ] **Test 6**: Mode selector CSS exists
  - File: `/test/mode-selector-ui.test.js`
  - Verify CSS classes defined
  - Should FAIL now (CSS doesn't exist)

### Frontend Mode Management Tests
- [ ] **Test 7**: Mode persists to chrome.storage
  - File: `/test/mode-management.test.js`
  - Mock chrome.storage and verify setMode saves
  - Should FAIL now (setMode doesn't exist)

- [ ] **Test 8**: Mode loads from chrome.storage on init
  - File: `/test/mode-management.test.js`
  - Mock storage with 'general' mode
  - Should FAIL now (no storage loading logic)

- [ ] **Test 9**: Default mode is 'study' when nothing saved
  - File: `/test/mode-management.test.js`
  - Mock empty storage
  - Should FAIL now (no default logic)

- [ ] **Test 10**: setMode function updates button icon
  - File: `/test/mode-management.test.js`
  - Verify icon changes when mode changes
  - Should FAIL now (setMode doesn't exist)

### Frontend Color Application Tests
- [ ] **Test 11**: General mode uses purple color
  - File: `/test/mode-color-application.test.js`
  - Verify single purple color applied
  - Should FAIL now (no mode-based color logic)

- [ ] **Test 12**: Study mode uses 3 colors
  - File: `/test/mode-color-application.test.js`
  - Verify 3-color categorization
  - Should PASS (already implemented)

### Integration Tests
- [ ] **Test 13**: Full flow - select general mode
  - File: `/test/mode-selector-integration.test.js`
  - Complete user interaction flow
  - Should FAIL now (feature not implemented)

- [ ] **Test 14**: Full flow - select study mode
  - File: `/test/mode-selector-integration.test.js`
  - Complete user interaction flow
  - Should FAIL now (feature not implemented)

- [ ] **Test 15**: Mode persists across page refresh
  - File: `/test/mode-selector-integration.test.js`
  - Verify persistence works
  - Should FAIL now (no persistence)

- [ ] **Test 16**: Switching mode doesn't re-process page
  - File: `/test/mode-selector-integration.test.js`
  - Verify switching is non-destructive
  - Should FAIL now (feature not implemented)

---

## 🛑 CHECKPOINT 1: Tests Written and Failing
**VERIFY** - All 16 tests should fail appropriately

---

## PHASE 2: Implementation (Make Tests Pass)

### Phase 1: Backend Changes

- [x] **Task 1**: Add mode parameter to processWithLLM
  - File: `/processors/llm-processor.js`
  - Change signature: `processWithLLM(paragraphs, mode = 'study')`
  - Use `getPrompt(mode + '_mode')` to select prompt
  - Run tests #1-3 - should PASS
  - ✅ COMPLETE - Tests 1-3 passing

---

### Phase 2: Frontend - Icons & UI

- [ ] **Task 2**: Add turtle icon to LUCIDE_ICONS
  - File: `/content-ui.js`
  - Add turtle SVG from Lucide library
  - Run test #4 - should PASS

- [ ] **Task 3**: Create mode selector popup structure
  - File: `/content-ui.js`
  - Create mode selector container div
  - Add two icon buttons (elephant, turtle)
  - Run test #5 - should PASS

- [ ] **Task 4**: Add mode selector CSS
  - File: `/content-ui.js`
  - Add `.mode-selector-popup` styles
  - Add `.mode-icon` and `.mode-icon.selected` styles
  - Position similar to old color palette
  - Run test #6 - should PASS

---

### Phase 3: Frontend - Mode Management

- [ ] **Task 5**: Add mode state management
  - File: `/content-ui.js`
  - Add `currentMode = 'study'` variable
  - Create `setMode(mode)` function
  - Create `getMode()` function
  - Run tests #7-10 - should PASS

- [ ] **Task 6**: Implement mode persistence
  - File: `/content-ui.js`
  - Save mode to `chrome.storage.local` in setMode
  - Load mode from storage in init()
  - Set default to 'study' if nothing saved
  - Update button icon based on loaded mode
  - Run tests #7-9 - should PASS

---

### Phase 4: Frontend - Event Handlers

- [ ] **Task 7**: Add mode selector hover behavior
  - File: `/content-ui.js`
  - Re-enable hover handlers (similar to old palette)
  - Show mode popup on button mouseenter
  - Hide on mouseleave with delay
  - Keep open when hovering popup
  - Run manual test - popup should appear/disappear

- [ ] **Task 8**: Add mode selection click handler
  - File: `/content-ui.js`
  - Listen for clicks on mode icons
  - Get `data-mode` attribute
  - Call `setMode(mode)`
  - Update visual selected state
  - Hide popup after selection
  - Run test #10 - should PASS

---

### Phase 5: Backend Integration

- [ ] **Task 9**: Update handleButtonClick to pass mode
  - File: `/content.js`
  - Get current mode from SmartUI
  - Add mode to chunk data sent to server
  - Format: `{chunkIndex, totalChunks, paragraphs, mode}`

- [ ] **Task 10**: Update server to receive mode
  - File: `/server.js`
  - Extract `mode` from request body
  - Pass mode to `processWithLLM(paragraphs, mode)`
  - Default to 'study' if not provided
  - Run tests #2-3 - should PASS

---

### Phase 6: Color Application

- [ ] **Task 11**: Update applyHighlights for mode-aware colors
  - File: `/content.js`
  - General mode: use purple for all highlights
  - Study mode: use 3-color categorization
  - Detect format automatically (old vs new)
  - Run tests #11-12 - should PASS

- [ ] **Task 12**: Expose mode getter in SmartUI API
  - File: `/content-ui.js`
  - Add `getMode` to `window.SmartUI` exports
  - Allow content.js to read current mode

---

## 🛑 CHECKPOINT 2: All Tests Pass
**VERIFY** - Run `npm test` to confirm all tests pass (existing + 16 new tests)

---

## PHASE 3: Manual Testing

- [ ] **Manual Test 1**: Default state
  - Load extension
  - Verify button shows elephant icon
  - Mode should be 'study'

- [ ] **Manual Test 2**: Mode selector popup
  - Hover over button
  - Verify popup appears with elephant and turtle icons
  - Verify elephant is selected (highlighted)

- [ ] **Manual Test 3**: Switch to general mode
  - Click turtle icon in popup
  - Verify button icon changes to turtle
  - Verify popup closes
  - Click button on article
  - Verify single purple highlights appear

- [ ] **Manual Test 4**: Switch to study mode
  - Hover and click elephant icon
  - Verify button icon changes to elephant
  - Click button on new article
  - Verify 3-color highlights appear (yellow, purple, orange)

- [ ] **Manual Test 5**: Mode persistence
  - Set mode to general (turtle)
  - Refresh page
  - Verify button still shows turtle
  - Verify mode is still general

- [ ] **Manual Test 6**: Switching doesn't re-process
  - Process page in study mode
  - See 3-color highlights
  - Switch to general mode
  - Verify highlights unchanged
  - Process another section
  - Verify new highlights use general mode (purple)

---

## 🛑 CHECKPOINT 3: User Manual Testing
**NEED USER** - Edu tests the mode selector feature

---

## PHASE 4: Cleanup & Documentation

- [ ] Update README.md with mode selector feature
- [ ] Clean up any console.logs
- [ ] Verify all tests still passing
- [ ] Commit changes

---

## Technical Notes

**Colors:**
- Study mode: Yellow (concepts), Purple (facts), Orange (examples)
- General mode: Purple (default from palette)

**Icons:**
- Study mode: 🐘 Elephant
- General mode: 🐢 Turtle

**Persistence:**
- Storage key: `highlightMode`
- Values: `'study'` or `'general'`
- Default: `'study'`

**Prompts:**
- Backend uses: `getPrompt('study_mode')` or `getPrompt('general_mode')`
- Both already exist in `/processors/llm-prompts.yaml`