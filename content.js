// ABOUTME: Content script for Smart Highlights—injects UI and applies highlights.
// TIMING: Even at document_end, defer DOM mutations (~500ms) so site JS doesn’t revert them.
// RELIABILITY: Use a two-pass flow—tag elements first, then query fresh and apply changes.


// Function to apply highlights sequentially with animation
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
      const textColor = getTextColor(currentHighlightColor);
      const newHtml = element.innerHTML.replace(regex, `<span class="${highlightClass}" style="opacity: 0; background-color: ${currentHighlightColor} !important; color: ${textColor} !important;">$1</span>`);

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

// No external dependencies - using simple text icons

// Default highlight color (can be overridden by user preference)
let currentHighlightColor = 'rgba(255, 255, 0, 0.5)'; // Default yellow

// Create style element but don't inject yet
const style = document.createElement('style');

// Function to inject/update CSS with current color
function injectHighlightCSS() {
  const textColor = getTextColor(currentHighlightColor);
  style.textContent = `
  .smart-highlight {
    background-color: ${currentHighlightColor};
    color: ${textColor} !important;
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
    align-items: center;
    justify-content: center;
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
  .smart-highlights-button:disabled.loading {
    animation: pulse-loading 1.5s ease-in-out infinite alternate;
  }
  .smart-highlights-button.loading svg {
    animation: spin-smooth 1s linear infinite;
  }
  .smart-highlights-button {
    font-size: 16px;
    font-weight: bold;
  }
  @keyframes spin-smooth {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse-loading {
    from { 
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 0 rgba(0, 123, 255, 0.6); 
    }
    to { 
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 8px rgba(0, 123, 255, 0); 
    }
  }
  .color-picker-popup {
    position: fixed;
    top: 70px;
    right: 15px;
    background: transparent;
    border: none;
    border-radius: 8px;
    padding: 10px;
    box-shadow: none;
    z-index: 10002;
    display: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .color-picker-popup.show {
    display: flex;
    opacity: 1;
    flex-direction: column;
    gap: 6px;
  }
  .color-swatch {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid #888;
    transition: transform 0.2s, border-color 0.2s, border-width 0.2s;
    position: relative;
    background-color:rgba(250, 250, 250, 0.71);
  }
  .color-swatch::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: calc(100% - 6px);
    height: calc(100% - 6px);
    border-radius: 50%;
    background-color: var(--swatch-color-opaque);
    z-index: 1;
  }
  .color-swatch:hover {
    transform: scale(1.1);
    border-color: #888;
  }
  .color-swatch.selected {
    border-color: #4A90E2;
    border-width: 4px;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.2);
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
  // Append style if not already in document
  if (!style.parentNode) {
    document.head.appendChild(style);
  }
}

// Create floating button
const floatingButton = document.createElement('button');
floatingButton.className = 'smart-highlights-button';
floatingButton.title = '';
document.body.appendChild(floatingButton);

// Create color picker popup
const colorPicker = document.createElement('div');
colorPicker.className = 'color-picker-popup';

// Define color palette with text color rules
const colorPalette = [
  { name: 'Yellow', color: 'rgba(255, 255, 0, 0.5)', textColor: 'black' },
  { name: 'Green', color: 'rgba(0, 255, 0, 0.3)', textColor: 'black' },
  { name: 'Orange', color: 'rgba(255, 165, 0, 0.5)', textColor: 'black' },
  { name: 'Purple', color: 'rgba(150, 0, 255, 0.3)', textColor: 'white' },
  { name: 'Red', color: 'rgba(255, 0, 0, 0.3)', textColor: 'white' }
];

// Helper function to get text color for a highlight color
function getTextColor(backgroundColor) {
  const colorConfig = colorPalette.find(c => c.color === backgroundColor);
  return colorConfig ? colorConfig.textColor : 'black';
}

colorPalette.forEach(({ name, color, textColor }) => {
  const swatch = document.createElement('div');
  swatch.className = 'color-swatch';
  
  // Set CSS custom property for the inner color (always opaque for palette)
  const opaqueColor = color.replace(/,\s*[\d.]+\)$/, ', 1)');
  swatch.style.setProperty('--swatch-color-opaque', opaqueColor);
  
  swatch.title = name;
  swatch.dataset.color = color; // Keep original transparent color for highlighting
  colorPicker.appendChild(swatch);
});

document.body.appendChild(colorPicker);

// Palette timing configuration
const PALETTE_SHOW_DELAY = 800;  // ms to wait before showing palette
const PALETTE_HIDE_DELAY = 500;  // ms to wait before hiding palette after leaving it

// Palette timer management
let showTimer = null;  // Timer for showing palette
let hideTimer = null;  // Timer for hiding palette

// Function to clear all palette timers
function clearPaletteTimers() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// Function to show palette
function showPalette() {
  clearPaletteTimers(); // Clear any existing timers
  colorPicker.classList.add('show');

  // Update selected state
  colorPicker.querySelectorAll('.color-swatch').forEach(swatch => {
    if (swatch.dataset.color === currentHighlightColor) {
      swatch.classList.add('selected');
    } else {
      swatch.classList.remove('selected');
    }
  });
}

// Function to hide palette
function hidePalette() {
  clearPaletteTimers(); // Clear any existing timers
  colorPicker.classList.remove('show');
}

// Function to update highlight color
function updateHighlightColor(color) {
  currentHighlightColor = color;
  const textColor = getTextColor(color);

  // Re-inject CSS with new color
  injectHighlightCSS();

  // Update existing highlights
  document.querySelectorAll('.smart-highlight').forEach(highlight => {
    highlight.style.backgroundColor = color;
    highlight.style.color = textColor;
  });

  // Save to Chrome storage
  chrome.storage.local.set({ highlightColor: color });
}

// Load saved color preference and inject CSS
chrome.storage.local.get(['highlightColor'], (result) => {
  if (result.highlightColor) {
    currentHighlightColor = result.highlightColor;
  }
  // Inject CSS after we know the color
  injectHighlightCSS();
});

// Lucide SVG Icons (embedded for reliability dans content scripts)
const LUCIDE_ICONS = {
  'elephant': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-elephant-icon lucide-elephant"><path d="M14.5 12H14c-2.8 0-5-2.2-5-5V5a2 2 0 0 1 2-2h2c1.5 0 2.8.8 3.4 2H19c1.7 0 3 1.3 3 3v10"/><path d="M18 10h.01"/><path d="M14 10a4 4 0 0 0 4 4 4 4 0 0 1 4 4 2 2 0 0 1-4 0"/><path d="M10 16v5"/><path d="M18 14a4 4 0 0 0-4 4v3H6v-2.6c0-1.1-.8-2.3-1.7-3C2.9 14.3 2 12.8 2 11c0-3.3 3.1-6 7-6"/><path d="M2 11v7"/></svg>`,
  'loader': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>`
};

// Set button SVG icon and loading state
function setButtonIcon(iconName, isLoading = false) {
  const iconSVG = LUCIDE_ICONS[iconName] || LUCIDE_ICONS['elephant'];
  floatingButton.innerHTML = iconSVG;
  
  // Toggle loading class for animations
  if (isLoading) {
    floatingButton.classList.add('loading');
  } else {
    floatingButton.classList.remove('loading');
  }
}

// Initialize button immediately
setButtonIcon('elephant');

setTimeout(() => {
  // Pass 1: Tag elements
  const targetElements = document.querySelectorAll('p, h1, h2, h3');
  targetElements.forEach((element, i) => {
    element.setAttribute('data-highlight-id', `para_${i}`);
  });

  // Show button only if >4 paragraphs
  if (targetElements.length > 4) {
    floatingButton.style.display = 'flex';
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

  // Button hover handlers for color picker
  floatingButton.addEventListener('mouseenter', () => {
    // Clear any existing timers
    clearPaletteTimers();
    
    // Start timer to show palette after delay
    showTimer = setTimeout(() => {
      showPalette();
    }, PALETTE_SHOW_DELAY);
  });

  floatingButton.addEventListener('mouseleave', () => {
    // Cancel show timer if mouse leaves button
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    
    // If palette is visible, start hiding timer
    if (colorPicker.classList.contains('show')) {
      hideTimer = setTimeout(() => {
        hidePalette();
      }, PALETTE_HIDE_DELAY);
    }
  });

  // Color picker hover handlers
  colorPicker.addEventListener('mouseenter', () => {
    // Cancel hide timer when entering palette
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    
    // Show palette immediately if hovering over it
    showPalette();
  });

  colorPicker.addEventListener('mouseleave', () => {
    // Start timer to hide palette when leaving it
    hideTimer = setTimeout(() => {
      hidePalette();
    }, PALETTE_HIDE_DELAY);
  });

  // Color swatch click handler
  colorPicker.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling to button or document

    if (e.target.classList.contains('color-swatch')) {
      const color = e.target.dataset.color;
      updateHighlightColor(color);

      // Update selected state
      colorPicker.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('selected');
      });
      e.target.classList.add('selected');

      // Close picker after selection (using our hide function)
      setTimeout(() => {
        hidePalette();
      }, 300);
    }
  });

  // Button click handler
  floatingButton.addEventListener('click', async () => {
    // Prevent double clicks
    if (floatingButton.disabled) return;

    // Immediately hide palette and clear all timers when starting processing
    clearPaletteTimers();
    hidePalette();

    // Start timing
    console.time('Total Processing');

    // Set loading state with elegant spinner
    floatingButton.disabled = true;
    setButtonIcon('loader', true);
    floatingButton.title = 'Processing...';

    // Remove the processing overlay popup - no longer needed!

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
          const warningOverlay = showStatusOverlay(`Sent ${result.paragraphCount} paragraphs (no highlights)`, 'warning');
          setTimeout(() => warningOverlay.remove(), 3000);
          console.log('Backend response (no highlights):', result);
        }
      } else {
        const errorOverlay = showStatusOverlay(`Error: ${result.error}`, 'error');
        setTimeout(() => errorOverlay.remove(), 3000);
        console.error('Backend error:', result);
      }

    } catch (error) {
      console.error('Failed to send data to backend:', error);
      const errorOverlay = showStatusOverlay('Backend connection failed', 'error');
      setTimeout(() => errorOverlay.remove(), 3000);
    } finally {
      // Reset button state
      floatingButton.disabled = false;
      setButtonIcon('elephant', false);
      floatingButton.title = '';
    }
  });
}, 500);