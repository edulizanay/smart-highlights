// ABOUTME: Content script for Smart Highlights—injects UI and applies highlights.
// TIMING: Even at document_end, defer DOM mutations (~500ms) so site JS doesn’t revert them.
// RELIABILITY: Use a two-pass flow—tag elements first, then query fresh and apply changes.

function applyHighlightsSequentially(highlightsData, highlightClass = 'smart-highlight', delay = 400) {
  const taggedElements = document.querySelectorAll('[data-highlight-id]');
  let totalHighlights = 0;
  const allHighlights = [];

  // First pass: collect all highlights to apply
  taggedElements.forEach(element => {
    const paragraphId = element.getAttribute('data-highlight-id');
    const phrasesToHighlight = highlightsData[paragraphId];

    if (!phrasesToHighlight || phrasesToHighlight.length === 0) {
      return;
    }

    phrasesToHighlight.forEach(phrase => {
      allHighlights.push({ element, phrase });
    });
  });

  // Second pass: apply highlights sequentially
  allHighlights.forEach((highlight, index) => {
    setTimeout(() => {
      const { element, phrase } = highlight;
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedPhrase})`, 'gi');
      const textColor = SmartUI.getTextColor(currentHighlightColor);
      const newHtml = element.innerHTML.replace(
        regex,
        `<span class="${highlightClass}" style="opacity: 0; background-color: ${currentHighlightColor} !important; color: ${textColor} !important;">$1</span>`
      );

      if (newHtml !== element.innerHTML) {
        element.innerHTML = newHtml;
        totalHighlights++;

        // Fade in the highlight
        const newHighlight = element.querySelector(`span.${highlightClass}[style*="opacity: 0"]`);
        if (newHighlight) {
          newHighlight.style.setProperty('background-color', currentHighlightColor, 'important');
          newHighlight.style.setProperty('color', textColor, 'important');
          newHighlight.style.transition = 'opacity 0.3s ease-in';
          newHighlight.style.opacity = '1';
        }
      }
    }, index * delay);
  });

  return allHighlights.length;
}

// Legacy function for instant highlights (kept for compatibility)
function applyHighlights(highlightsData, highlightClass = 'smart-highlight') {
  return applyHighlightsSequentially(highlightsData, highlightClass, 0);
}

// Persistent color state
let currentHighlightColor = 'rgba(255, 255, 0, 0.5)'; // Default yellow

// Prevent double clicks without depending on UI internals
let isProcessing = false;

// Initialize UI after loading saved color, then wire callbacks
chrome.storage.local.get(['highlightColor'], (result) => {
  if (result.highlightColor) {
    currentHighlightColor = result.highlightColor;
  }

  SmartUI.init({
    currentHighlightColor,
    onColorChange: (color) => {
      currentHighlightColor = color;
      chrome.storage.local.set({ highlightColor: color });
      SmartUI.setColor(color);
    },
    onClick: handleButtonClick
  });
});

// 500ms defer: tag elements, then decide button visibility
setTimeout(() => {
  const targetElements = document.querySelectorAll('p');
  targetElements.forEach((element, i) => {
    element.setAttribute('data-highlight-id', `para_${i}`);
  });

  SmartUI.setButtonVisible(targetElements.length > 4);
  console.log(`Smart Highlights: Tagged ${targetElements.length} elements for processing`);
}, 500);

async function handleButtonClick() {
  if (isProcessing) return;
  isProcessing = true;

  console.time('Total Processing');

  // Set loading state
  SmartUI.setButtonIcon('loader', true);

  try {
    // Use the already-tagged elements from page load
    const taggedElements = document.querySelectorAll('[data-highlight-id]');
    const extractedData = {};

    taggedElements.forEach(element => {
      const id =
    element.getAttribute('data-highlight-id');
      const text = element.textContent.trim();
      if (text.length > 30) {  // Filter out short UI text
        extractedData[id] = text;
      }
    });

    console.log('Sending paragraph data to backend...');
    console.time('Network Request');

    const response = await fetch('http://localhost:3000/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extractedData)
    });

    const result = await response.json();
    console.timeEnd('Network Request');

    if (response.ok) {
      if (result.highlights) {
        // Convert LLM highlights array to object format for highlighting
        const llmHighlights = {};
        result.highlights.forEach(highlight => {
          llmHighlights[highlight.id] = highlight.phrases;
        });

        // Apply LLM highlights with sequential animation
        const highlightCount = applyHighlightsSequentially(llmHighlights);

        // Calculate total animation time
        const totalAnimationTime = highlightCount * 200 + 300; // 200ms per highlight + 300ms buffer

        // Complete processing after animations
        setTimeout(() => {
          console.timeEnd('Total Processing');
        }, totalAnimationTime);

        console.log('LLM highlights applied:', result.highlights);
      } else {
        const warningOverlay = SmartUI.showStatusOverlay(`Sent ${result.paragraphCount} paragraphs (no highlights)`, 'warning');
        setTimeout(() => warningOverlay.remove(), 3000);
        console.log('Backend response (no highlights):', result);
      }
    } else {
      const errorOverlay = SmartUI.showStatusOverlay(`Error: ${result.error}`, 'error');
      setTimeout(() => errorOverlay.remove(), 3000);
      console.error('Backend error:', result);
    }
  } catch (error) {
    console.error('Failed to send data to backend:', error);
    const errorOverlay = SmartUI.showStatusOverlay('Backend connection failed', 'error');
    setTimeout(() => errorOverlay.remove(), 3000);
  } finally {
    SmartUI.setButtonIcon('elephant', false);
    isProcessing = false;
  }
}