// ABOUTME: Content script for Smart Highlights Chrome extension
// ABOUTME: Injects styling and functionality into web pages
//
// CRITICAL TIMING LESSON: innerHTML modifications must be delayed via setTimeout()
// Even though content scripts run at document_end, pages often have JavaScript that
// runs after us and reverts DOM changes. Direct innerHTML assignment fails silently.
// The 500ms delay ensures page has settled before we modify the DOM.
// Two-pass approach (tag first, then query fresh elements) is essential for reliability.


// Function to apply highlights based on LLM response
function applyHighlights(highlightsData, highlightClass = 'smart-highlight') {
  const taggedElements = document.querySelectorAll('[data-highlight-id]');
  let totalHighlights = 0;
  let processedParagraphs = 0;

  taggedElements.forEach(element => {
    const paragraphId = element.getAttribute('data-highlight-id');
    const phrasesToHighlight = highlightsData[paragraphId];

    // Skip if paragraph not in highlights or has no phrases
    if (!phrasesToHighlight || phrasesToHighlight.length === 0) {
      return;
    }

    let html = element.innerHTML;
    let modified = false;

    phrasesToHighlight.forEach(phrase => {
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedPhrase})`, 'gi');
      const newHtml = html.replace(regex, `<span class="${highlightClass}">$1</span>`);

      if (newHtml !== html) {
        html = newHtml;
        modified = true;
        totalHighlights++;
      }
    });

    if (modified) {
      element.innerHTML = html;
      processedParagraphs++;
    }
  });

  console.log(`Applied ${totalHighlights} highlights to ${processedParagraphs} paragraphs`);
}

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
    font-size: 16px;
    color: white;
    display: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  .smart-highlights-button:hover {
    background: rgba(0, 123, 255, 1);
    transform: scale(1.05);
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
  }
`;
document.head.appendChild(style);

// Create floating button
const floatingButton = document.createElement('button');
floatingButton.className = 'smart-highlights-button';
floatingButton.innerHTML = '📝';
floatingButton.title = 'Extract Paragraphs';
document.body.appendChild(floatingButton);

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

  // Button click handler
  floatingButton.addEventListener('click', async () => {
    // Use the already-tagged elements from page load
    const taggedElements = document.querySelectorAll('[data-highlight-id]');
    const extractedData = {};

    taggedElements.forEach(element => {
      const id = element.getAttribute('data-highlight-id');
      const text = element.textContent.trim();
      extractedData[id] = text;
    });

    console.log('Sending paragraph data to backend...');

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

      // Show success overlay
      const overlay = document.createElement('div');
      overlay.className = 'smart-highlights-overlay';

      if (response.ok) {
        // Check if we got LLM highlights
        if (result.highlights) {
          // Convert LLM highlights array to object format for highlighting
          const llmHighlights = {};
          result.highlights.forEach(highlight => {
            llmHighlights[highlight.id] = highlight.phrases;
          });

          // Apply LLM highlights to the page
          applyHighlights(llmHighlights);

          overlay.textContent = `✓ Applied ${result.highlights.length} LLM highlights`;
          overlay.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
          console.log('LLM highlights applied:', result.highlights);
        } else {
          overlay.textContent = `✓ Sent ${result.paragraphCount} paragraphs (no highlights)`;
          overlay.style.backgroundColor = 'rgba(255, 165, 0, 0.8)'; // Orange for partial success
          console.log('Backend response (no highlights):', result);
        }
      } else {
        overlay.textContent = `✗ Error: ${result.error}`;
        overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        console.error('Backend error:', result);
      }

      document.body.appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
      }, 3000);

    } catch (error) {
      console.error('Failed to send data to backend:', error);

      // Show error overlay
      const overlay = document.createElement('div');
      overlay.className = 'smart-highlights-overlay';
      overlay.textContent = '✗ Backend connection failed';
      overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      document.body.appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
      }, 3000);
    }
  });
}, 500);