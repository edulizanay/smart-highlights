// ABOUTME: Content script for Smart Highlights—injects UI and applies highlights.
// TIMING: Even at document_end, defer DOM mutations (~500ms) so site JS doesn't revert them.
// RELIABILITY: Use a two-pass flow—tag elements first, then query fresh and apply changes.

// Configuration constants
const CONFIG = {
  HIGHLIGHT_DELAY_MS: 400,
  CHUNK_MAX_CHARS: 1000,
  DOM_READY_DELAY_MS: 500,
  MIN_PARAGRAPHS_FOR_BUTTON: 4,
  MIN_TEXT_LENGTH: 30,
  MAX_CONCURRENT_REQUESTS: 2,
  API_ENDPOINT: 'http://localhost:3000/extract'
};

// Mock data for summary panel testing
const MOCK_SUMMARIES = {
  para_5: "Compound interest accelerates wealth exponentially over long time periods",
  para_8: "Cognitive load theory explains how information overload reduces learning performance",
  para_12: "Neural networks learn patterns through training on data, not direct programming"
};

// Helper: Escape special regex characters
function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper: Fade in highlights with requestAnimationFrame
function fadeInHighlights(elements) {
  if (elements.length === 0) return;

  requestAnimationFrame(() => {
    elements.forEach(el => {
      el.style.transition = 'opacity 0.18s ease-out';
    });
    requestAnimationFrame(() => {
      elements.forEach(el => {
        el.style.opacity = '1';
      });
    });
  });
}

// Unified highlight application function
function applyHighlights(highlightsData, options = {}) {
  const {
    sequential = false,
    delay = 0
  } = options;

  const taggedElements = document.querySelectorAll('[data-highlight-id]');
  let totalHighlights = 0;

  // Helper to apply a single phrase with a specific color class
  function applyPhrase(element, phrase, colorClass) {
    const regex = new RegExp(`(${escapeForRegex(phrase)})`, 'gi');
    return element.innerHTML.replace(
      regex,
      `<span class="${colorClass}" style="opacity: 0;">$1</span>`
    );
  }

  if (sequential) {
    // Sequential mode: apply one phrase at a time with delay
    const allHighlights = [];
    taggedElements.forEach(element => {
      const paragraphId = element.getAttribute('data-highlight-id');
      const phraseData = highlightsData[paragraphId];

      if (!phraseData) return;

      // Handle new format: {concepts: [], terms: [], examples: []}
      if (phraseData.concepts) {
        phraseData.concepts.forEach(phrase => {
          allHighlights.push({ element, phrase, colorClass: 'smart-highlight-concept' });
        });
      }
      if (phraseData.terms) {
        phraseData.terms.forEach(phrase => {
          allHighlights.push({ element, phrase, colorClass: 'smart-highlight-fact' });
        });
      }
      if (phraseData.examples) {
        phraseData.examples.forEach(phrase => {
          allHighlights.push({ element, phrase, colorClass: 'smart-highlight-example' });
        });
      }

      // Handle old format: array of phrases
      if (Array.isArray(phraseData)) {
        phraseData.forEach(phrase => {
          allHighlights.push({ element, phrase, colorClass: 'smart-highlight' });
        });
      }
    });

    allHighlights.forEach((highlight, index) => {
      setTimeout(() => {
        const { element, phrase, colorClass } = highlight;
        const newHtml = applyPhrase(element, phrase, colorClass);

        if (newHtml !== element.innerHTML) {
          element.innerHTML = newHtml;
          const newHighlights = element.querySelectorAll(`span[style*="opacity: 0"]`);
          fadeInHighlights(Array.from(newHighlights));
        }
      }, index * delay);
    });

    return allHighlights.length;
  } else {
    // Instant mode: batch all phrases per paragraph
    taggedElements.forEach(element => {
      const paragraphId = element.getAttribute('data-highlight-id');
      const phraseData = highlightsData[paragraphId];

      if (!phraseData) return;

      let modifiedHtml = element.innerHTML;

      // Handle new format: {concepts: [], terms: [], examples: []}
      if (phraseData.concepts) {
        phraseData.concepts.forEach(phrase => {
          modifiedHtml = applyPhrase({ innerHTML: modifiedHtml }, phrase, 'smart-highlight-concept');
          totalHighlights++;
        });
      }
      if (phraseData.terms) {
        phraseData.terms.forEach(phrase => {
          modifiedHtml = applyPhrase({ innerHTML: modifiedHtml }, phrase, 'smart-highlight-fact');
          totalHighlights++;
        });
      }
      if (phraseData.examples) {
        phraseData.examples.forEach(phrase => {
          modifiedHtml = applyPhrase({ innerHTML: modifiedHtml }, phrase, 'smart-highlight-example');
          totalHighlights++;
        });
      }

      // Handle old format: array of phrases (backward compatibility)
      if (Array.isArray(phraseData)) {
        phraseData.forEach(phrase => {
          const textColor = SmartUI.getTextColor(currentHighlightColor);
          const regex = new RegExp(`(${escapeForRegex(phrase)})`, 'gi');
          modifiedHtml = modifiedHtml.replace(
            regex,
            `<span class="smart-highlight" style="opacity: 0; background-color: ${currentHighlightColor} !important; color: ${textColor} !important;">$1</span>`
          );
          totalHighlights++;
        });
      }

      if (modifiedHtml !== element.innerHTML) {
        element.innerHTML = modifiedHtml;
        const newHighlights = element.querySelectorAll(`span[style*="opacity: 0"]`);
        fadeInHighlights(Array.from(newHighlights));
      }
    });

    return totalHighlights;
  }
}

// Persistent color state
let currentHighlightColor = 'rgba(255, 255, 0, 0.5)'; // Default yellow

// Prevent double clicks without depending on UI internals
let isProcessing = false;

// Chunking logic for parallel LLM processing
function chunkParagraphs(extractedData, maxChars = 500) {
  const chunks = [];
  const paragraphEntries = Object.entries(extractedData);

  if (paragraphEntries.length === 0) {
    return chunks;
  }

  let currentChunk = {
    chunkIndex: 0,
    totalChunks: 0, // Will be set after we know total count
    paragraphs: {},
    charCount: 0
  };

  for (const [paraId, text] of paragraphEntries) {
    const textLength = text.length;

    // If adding this paragraph would exceed maxChars AND we already have content,
    // start a new chunk (but always include at least one paragraph per chunk)
    if (currentChunk.charCount > 0 && currentChunk.charCount + textLength > maxChars) {
      chunks.push(currentChunk);

      // Start new chunk
      currentChunk = {
        chunkIndex: chunks.length,
        totalChunks: 0,
        paragraphs: {},
        charCount: 0
      };
    }

    // Add paragraph to current chunk
    currentChunk.paragraphs[paraId] = text;
    currentChunk.charCount += textLength;
  }

  // Add the last chunk if it has content
  if (Object.keys(currentChunk.paragraphs).length > 0) {
    chunks.push(currentChunk);
  }

  // Set totalChunks for all chunks
  const totalChunks = chunks.length;
  chunks.forEach(chunk => {
    chunk.totalChunks = totalChunks;
  });

  return chunks;
}


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

// Defer DOM mutations so site JS doesn't revert them
setTimeout(() => {
  const targetElements = document.querySelectorAll('p, li');
  targetElements.forEach((element, i) => {
    element.setAttribute('data-highlight-id', `para_${i}`);
  });

  SmartUI.setButtonVisible(targetElements.length > CONFIG.MIN_PARAGRAPHS_FOR_BUTTON);
  console.log(`Smart Highlights: Tagged ${targetElements.length} elements for processing`);
}, CONFIG.DOM_READY_DELAY_MS);

// Process chunks with limited concurrency to maintain order and avoid API flooding
async function processConcurrentChunks(chunks, onChunkProcessed, maxConcurrent = 2, mode = 'study', runId = null) {
  let index = 0;

  // Process a single chunk and return its identity with the result
  const processChunk = async (chunk) => {
    try {
      const url = runId ? `${CONFIG.API_ENDPOINT}?run_id=${runId}` : CONFIG.API_ENDPOINT;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          paragraphs: chunk.paragraphs,
          mode: mode
        })
      });

      const result = await response.json();

      if (response.ok && result.highlights) {
        console.log(`Chunk ${chunk.chunkIndex} processed: ${result.highlights.length} highlights`);
        onChunkProcessed(chunk.chunkIndex, result.highlights);
      } else {
        console.warn(`Chunk ${chunk.chunkIndex} failed or no highlights:`, result);
        onChunkProcessed(chunk.chunkIndex, []);
      }

      return { chunkIndex: chunk.chunkIndex, completed: true };
    } catch (error) {
      console.error(`Error processing chunk ${chunk.chunkIndex}:`, error);
      onChunkProcessed(chunk.chunkIndex, []);
      return { chunkIndex: chunk.chunkIndex, completed: true };
    }
  };

  // Sliding window: maintain exactly maxConcurrent requests
  const activePromises = [];

  // Start initial batch
  for (let i = 0; i < Math.min(maxConcurrent, chunks.length); i++) {
    const chunk = chunks[index++];
    activePromises.push({
      chunkIndex: chunk.chunkIndex,
      promise: processChunk(chunk)
    });
  }

  // Process remaining chunks with sliding window
  while (activePromises.length > 0) {
    // Wait for any promise to complete
    const completedResult = await Promise.race(
      activePromises.map(p => p.promise)
    );

    // Find and remove the completed promise
    const completedIndex = activePromises.findIndex(
      p => p.chunkIndex === completedResult.chunkIndex
    );

    if (completedIndex !== -1) {
      activePromises.splice(completedIndex, 1);
    }

    // Start next chunk if available
    if (index < chunks.length) {
      const chunk = chunks[index++];
      activePromises.push({
        chunkIndex: chunk.chunkIndex,
        promise: processChunk(chunk)
      });
    }
  }
}

// Extract paragraphs from already-tagged DOM elements (p, li only)
function extractParagraphs() {
  const taggedElements = document.querySelectorAll('[data-highlight-id]');
  const extractedData = {};

  taggedElements.forEach(element => {
    const id = element.getAttribute('data-highlight-id');
    const text = element.textContent.trim();
    if (text.length > CONFIG.MIN_TEXT_LENGTH) {
      extractedData[id] = text;
    }
  });

  return extractedData;
}

// Create pig SVG icon (no positioning, just the icon element)
function createPigIcon() {
  const icon = document.createElement('div');
  icon.className = 'summary-pig-icon';
  icon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
      <path d="M15 11v.01" />
      <path d="M16 3l0 3.803a6.019 6.019 0 0 1 2.658 3.197h1.341a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-1.342a6.008 6.008 0 0 1 -1.658 2.473v2.027a1.5 1.5 0 0 1 -3 0v-.583a6.04 6.04 0 0 1 -1 .083h-4a6.04 6.04 0 0 1 -1 -.083v.583a1.5 1.5 0 0 1 -3 0v-2l0 -.027a6 6 0 0 1 4 -10.473h2.5l4.5 -3z" />
    </svg>
  `;

  // Style the icon
  icon.style.cursor = 'pointer';
  icon.style.opacity = '0.6';
  icon.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  icon.style.color = '#9333ea';
  icon.style.flexShrink = '0';

  // Hover effect
  icon.addEventListener('mouseenter', () => {
    icon.style.opacity = '1';
    icon.style.transform = 'scale(1.1)';
  });

  icon.addEventListener('mouseleave', () => {
    icon.style.opacity = '0.6';
    icon.style.transform = 'scale(1)';
  });

  return icon;
}

// Inject pig icons and annotations for paragraphs with summaries
function injectSummaryIcons() {
  Object.keys(MOCK_SUMMARIES).forEach(paraId => {
    const paragraph = document.querySelector(`[data-highlight-id="${paraId}"]`);
    if (paragraph && !paragraph.querySelector('.summary-wrapper')) {
      // Make paragraph position relative
      const currentPosition = window.getComputedStyle(paragraph).position;
      if (currentPosition === 'static') {
        paragraph.style.position = 'relative';
      }

      // Create wrapper container for icon + annotation
      const wrapper = document.createElement('div');
      wrapper.className = 'summary-wrapper';
      wrapper.setAttribute('data-para-id', paraId);
      wrapper.style.position = 'absolute';
      wrapper.style.left = '100%';
      wrapper.style.marginLeft = '20px';
      wrapper.style.top = '0';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'flex-start';

      // Create and append pig icon
      const icon = createPigIcon();
      wrapper.appendChild(icon);

      // Create annotation (hidden by default)
      const summaryText = MOCK_SUMMARIES[paraId];
      const annotation = createAnnotation(summaryText);
      wrapper.appendChild(annotation);

      // Add click handler to icon to toggle annotation visibility
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAnnotation(paraId);
      });

      // Append wrapper to paragraph
      paragraph.appendChild(wrapper);
    }
  });
}

// Create annotation (no positioning, just the content element)
function createAnnotation(summaryText) {
  // Create annotation container
  const annotation = document.createElement('div');
  annotation.className = 'summary-annotation';
  annotation.style.display = 'none'; // Initially hidden
  annotation.style.maxWidth = '280px';
  annotation.style.paddingRight = '20px';
  annotation.style.marginTop = '8px';
  annotation.style.position = 'relative';

  // Create delete button container (top-right)
  const deleteButton = document.createElement('span');
  deleteButton.textContent = '×';
  deleteButton.style.position = 'absolute';
  deleteButton.style.top = '0';
  deleteButton.style.right = '0';
  deleteButton.style.color = '#9333ea';
  deleteButton.style.fontSize = '18px';
  deleteButton.style.cursor = 'pointer';
  deleteButton.style.opacity = '0';
  deleteButton.style.transition = 'opacity 0.2s ease';

  // Create text element
  const textElement = document.createElement('div');
  textElement.textContent = summaryText;
  textElement.style.color = '#9333ea';
  textElement.style.fontSize = '14px';
  textElement.style.lineHeight = '1.5';
  textElement.style.fontStyle = 'italic';
  textElement.style.opacity = '0.9';
  textElement.style.width = '100%';
  textElement.style.wordWrap = 'break-word';
  textElement.style.overflowWrap = 'break-word';
  textElement.style.paddingRight = '20px'; // Space for delete button

  // Show delete button on annotation hover
  annotation.addEventListener('mouseenter', () => {
    deleteButton.style.opacity = '0.7';
  });

  annotation.addEventListener('mouseleave', () => {
    deleteButton.style.opacity = '0';
  });

  // Delete button hover effect
  deleteButton.addEventListener('mouseenter', () => {
    deleteButton.style.opacity = '1';
  });

  // Hide annotation on click (don't remove from DOM)
  deleteButton.addEventListener('click', () => {
    annotation.style.display = 'none';
  });

  annotation.appendChild(textElement);
  annotation.appendChild(deleteButton);

  return annotation;
}

// Toggle annotation visibility within wrapper
function toggleAnnotation(paragraphId) {
  const wrapper = document.querySelector(`.summary-wrapper[data-para-id="${paragraphId}"]`);
  if (!wrapper) return;

  const annotation = wrapper.querySelector('.summary-annotation');
  if (!annotation) return;

  if (annotation.style.display === 'none') {
    annotation.style.display = 'block';
  } else {
    annotation.style.display = 'none';
  }
}

async function handleButtonClick() {
  if (isProcessing) return;
  isProcessing = true;

  console.time('Total Processing');

  // Generate unique run_id for this highlighting session
  const runId = Date.now();
  console.log(`Starting new run: ${runId}`);

  // Get current mode from UI
  const currentMode = SmartUI.getMode();
  console.log(`Processing in ${currentMode} mode`);

  // Set loading state
  SmartUI.setButtonIcon('loader', true);

  try {
    // Extract paragraphs using reusable function
    const extractedData = extractParagraphs();

    // Chunk the data for parallel processing
    const chunks = chunkParagraphs(extractedData, CONFIG.CHUNK_MAX_CHARS);
    console.log(`Chunked ${Object.keys(extractedData).length} paragraphs into ${chunks.length} chunks`);

    if (chunks.length === 0) {
      const warningOverlay = SmartUI.showStatusOverlay('No content to process', 'warning');
      setTimeout(() => warningOverlay.remove(), 3000);
      return;
    }

    // Track processed chunks
    const processedChunks = new Set();

    // Handle chunk response callback
    function handleChunkResponse(chunkIndex, highlights) {
      if (processedChunks.has(chunkIndex)) return;
      processedChunks.add(chunkIndex);

      if (highlights?.length > 0) {
        // Convert LLM highlights array to object format for highlighting
        const llmHighlights = {};
        highlights.forEach(highlight => {
          // New format: {id, concepts: [], facts: [], examples: []}
          // Old format: {id, phrases: []}
          if (highlight.concepts || highlight.facts || highlight.examples) {
            llmHighlights[highlight.id] = {
              concepts: highlight.concepts || [],
              facts: highlight.facts || [],
              examples: highlight.examples || []
            };
          } else if (highlight.phrases) {
            // Backward compatibility with old format
            llmHighlights[highlight.id] = highlight.phrases;
          }
        });
        applyHighlights(llmHighlights);
      }
    }

    console.log(`Sending ${chunks.length} chunks with ${CONFIG.MAX_CONCURRENT_REQUESTS} concurrent requests...`);
    console.time('Concurrent Processing');

    // Process chunks with limited concurrency
    await processConcurrentChunks(chunks, handleChunkResponse, CONFIG.MAX_CONCURRENT_REQUESTS, currentMode, runId);

    console.timeEnd('Concurrent Processing');

    // Check completion
    if (processedChunks.size === chunks.length) {
      console.log('All chunks processed successfully');

      // Inject summary icons after highlights are applied
      setTimeout(() => {
        injectSummaryIcons();
      }, 500);

      setTimeout(() => {
        console.timeEnd('Total Processing');
      }, 1000); // Small delay for final animations
    }

  } catch (error) {
    console.error('Failed to process chunks:', error);
    const errorOverlay = SmartUI.showStatusOverlay('Processing failed', 'error');
    setTimeout(() => errorOverlay.remove(), 3000);
  } finally {
    SmartUI.setButtonIcon('elephant', false);
    isProcessing = false;
  }
}