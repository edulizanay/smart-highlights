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