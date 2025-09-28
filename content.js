// ABOUTME: Content script for Smart Highlights Chrome extension
// ABOUTME: Injects styling and functionality into web pages
//
// CRITICAL TIMING LESSON: innerHTML modifications must be delayed via setTimeout()
// Even though content scripts run at document_end, pages often have JavaScript that
// runs after us and reverts DOM changes. Direct innerHTML assignment fails silently.
// The 500ms delay ensures page has settled before we modify the DOM.
// Two-pass approach (tag first, then query fresh elements) is essential for reliability.


// Function to apply highlights sequentially with animation
function applyHighlightsSequentially(highlightsData, highlightClass = 'smart-highlight', delay = 200) {
  const taggedElements = document.querySelectorAll('[data-highlight-id]');
  let totalHighlights = 0;
  let processedParagraphs = 0;
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
      const newHtml = element.innerHTML.replace(regex, `<span class="${highlightClass}" style="opacity: 0;">$1</span>`);

      if (newHtml !== element.innerHTML) {
        element.innerHTML = newHtml;
        totalHighlights++;

        // Fade in the highlight
        const newHighlight = element.querySelector(`span.${highlightClass}[style*="opacity: 0"]`);
        if (newHighlight) {
          newHighlight.style.transition = 'opacity 0.3s ease-in';
          newHighlight.style.opacity = '1';
        }
      }

      // Log completion after last highlight
      if (index === allHighlights.length - 1) {
        processedParagraphs = document.querySelectorAll(`[data-highlight-id] .${highlightClass}`).length;
        console.log(`Applied ${totalHighlights} highlights sequentially`);
      }
    }, index * delay);
  });

  return allHighlights.length;
}

// Legacy function for instant highlights (kept for compatibility)
function applyHighlights(highlightsData, highlightClass = 'smart-highlight') {
  return applyHighlightsSequentially(highlightsData, highlightClass, 0);
}

// No external dependencies - using simple text icons

// Inject CSS immediately
const style = document.createElement('style');
style.textContent = `
  .smart-highlight {
    background-color: yellow !important;
    color: black !important;
    padding: 2px 4px !important;
    border-radius: 3px !important;
    font-weight: bold !important;
  }
  .smart-highlights-button {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    background: rgba(0, 123, 255, 0.8);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    z-index: 10000;
    color: white;
    display: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  }
  .smart-highlights-button:hover:not(:disabled) {
    background: rgba(0, 123, 255, 1);
    transform: scale(1.05);
  }
  .smart-highlights-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
  .smart-highlights-button {
    font-size: 16px;
    font-weight: bold;
  }
  .smart-highlights-overlay {
    position: fixed;
    top: 70px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 10001;
    font-size: 14px;
    transition: opacity 0.3s ease;
  }
`;
document.head.appendChild(style);

// Create floating button
const floatingButton = document.createElement('button');
floatingButton.className = 'smart-highlights-button';
floatingButton.title = 'Smart Highlights';
document.body.appendChild(floatingButton);

// Set button text icon
function setButtonIcon(iconName) {
  const icons = {
    'highlighter': 'H',
    'loader-2': '⟳'
  };
  floatingButton.textContent = icons[iconName] || 'H';
}

// Initialize button immediately
setButtonIcon('highlighter');

setTimeout(() => {
  // Pass 1: Tag elements
  const targetElements = document.querySelectorAll('p, h1, h2, h3');
  targetElements.forEach((element, i) => {
    element.setAttribute('data-highlight-id', `para_${i}`);
  });

  // Show button only if >4 paragraphs
  if (targetElements.length > 4) {
    floatingButton.style.display = 'block';
  }

  // Basic extraction confirmation
  console.log(`Smart Highlights: Tagged ${targetElements.length} elements for processing`);

  // Function to show status overlay with text prefixes
  function showStatusOverlay(message, type = 'info') {
    const existing = document.querySelector('.smart-highlights-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'smart-highlights-overlay';

    const prefixes = {
      info: '[i]',
      success: '[✓]',
      warning: '[!]',
      error: '[×]'
    };

    const prefix = prefixes[type] || prefixes.info;
    overlay.textContent = `${prefix} ${message}`;

    const colors = {
      info: 'rgba(0, 123, 255, 0.8)',
      success: 'rgba(0, 128, 0, 0.8)',
      warning: 'rgba(255, 165, 0, 0.8)',
      error: 'rgba(255, 0, 0, 0.8)'
    };
    overlay.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(overlay);
    return overlay;
  }

  // Button click handler
  floatingButton.addEventListener('click', async () => {
    // Prevent double clicks
    if (floatingButton.disabled) return;

    // Start timing
    console.time('Total Processing');

    // Set loading state
    floatingButton.disabled = true;
    setButtonIcon('loader-2');
    floatingButton.title = 'Processing...';

    // Show processing overlay
    const processingOverlay = showStatusOverlay('Processing...', 'info');

    // Use the already-tagged elements from page load
    const taggedElements = document.querySelectorAll('[data-highlight-id]');
    const extractedData = {};

    taggedElements.forEach(element => {
      const id = element.getAttribute('data-highlight-id');
      const text = element.textContent.trim();
      extractedData[id] = text;
    });

    console.log('Sending paragraph data to backend...');
    console.time('Network Request');

    try {
      // Send data to backend
      const response = await fetch('http://localhost:3000/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractedData)
      });

      const result = await response.json();
      console.timeEnd('Network Request');

      if (response.ok) {
        // Check if we got LLM highlights
        if (result.highlights) {
          // Update status
          processingOverlay.textContent = 'Applying highlights...';

          // Convert LLM highlights array to object format for highlighting
          const llmHighlights = {};
          result.highlights.forEach(highlight => {
            llmHighlights[highlight.id] = highlight.phrases;
          });

          // Apply LLM highlights with sequential animation
          const highlightCount = applyHighlightsSequentially(llmHighlights);

          // Calculate total animation time
          const totalAnimationTime = highlightCount * 200 + 300; // 200ms per highlight + 300ms buffer

          // Show final success message after animations complete
          setTimeout(() => {
            console.timeEnd('Total Processing');
            processingOverlay.remove();
            const successOverlay = showStatusOverlay(`Applied ${result.highlights.length} highlights`, 'success');
            setTimeout(() => successOverlay.remove(), 2000);
          }, totalAnimationTime);

          console.log('LLM highlights applied:', result.highlights);
        } else {
          processingOverlay.remove();
          const warningOverlay = showStatusOverlay(`Sent ${result.paragraphCount} paragraphs (no highlights)`, 'warning');
          setTimeout(() => warningOverlay.remove(), 3000);
          console.log('Backend response (no highlights):', result);
        }
      } else {
        processingOverlay.remove();
        const errorOverlay = showStatusOverlay(`Error: ${result.error}`, 'error');
        setTimeout(() => errorOverlay.remove(), 3000);
        console.error('Backend error:', result);
      }

    } catch (error) {
      console.error('Failed to send data to backend:', error);
      processingOverlay.remove();
      const errorOverlay = showStatusOverlay('Backend connection failed', 'error');
      setTimeout(() => errorOverlay.remove(), 3000);
    } finally {
      // Reset button state
      floatingButton.disabled = false;
      setButtonIcon('highlighter');
      floatingButton.title = 'Smart Highlights';
    }
  });
}, 500);