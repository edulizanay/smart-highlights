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

// Chunk Response Manager for coordinating parallel LLM responses
class ChunkResponseManager {
  constructor(totalChunks, applyHighlightsFunction) {
    this.totalChunks = totalChunks;
    this.applyHighlights = applyHighlightsFunction;
    this.nextChunkToProcess = 0;
    this.responses = new Map(); // chunkIndex -> highlights
    this.processedChunks = new Set();
  }

  addResponse(chunkIndex, highlights) {
    // Ignore duplicate responses
    if (this.responses.has(chunkIndex)) {
      return;
    }

    // Store the response
    this.responses.set(chunkIndex, highlights);

    // Process any ready chunks starting from nextChunkToProcess
    this.processNextReady();
  }

  processNextReady() {
    // Process chunks in order if they're ready
    while (this.responses.has(this.nextChunkToProcess) &&
           !this.processedChunks.has(this.nextChunkToProcess)) {

      const highlights = this.responses.get(this.nextChunkToProcess);
      this.processedChunks.add(this.nextChunkToProcess);

      // Apply highlights if any exist
      if (highlights && highlights.length > 0) {
        this.applyHighlights(highlights);
      }

      this.nextChunkToProcess++;
    }
  }

  isComplete() {
    return this.processedChunks.size === this.totalChunks;
  }
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
      const id = element.getAttribute('data-highlight-id');
      const text = element.textContent.trim();
      if (text.length > 30) {  // Filter out short UI text
        extractedData[id] = text;
      }
    });

    // Chunk the data for parallel processing
    const chunks = chunkParagraphs(extractedData, 500);
    console.log(`Chunked ${Object.keys(extractedData).length} paragraphs into ${chunks.length} chunks`);

    if (chunks.length === 0) {
      const warningOverlay = SmartUI.showStatusOverlay('No content to process', 'warning');
      setTimeout(() => warningOverlay.remove(), 3000);
      return;
    }

    // Set up response manager
    const responseManager = new ChunkResponseManager(chunks.length, (highlights) => {
      // Convert LLM highlights array to object format for highlighting
      const llmHighlights = {};
      highlights.forEach(highlight => {
        llmHighlights[highlight.id] = highlight.phrases;
      });

      // Apply highlights with sequential animation
      applyHighlightsSequentially(llmHighlights);
    });

    console.log('Sending chunks to backend in parallel...');
    console.time('Parallel Network Requests');

    // Send all chunks in parallel
    const chunkPromises = chunks.map(async (chunk) => {
      try {
        const response = await fetch('http://localhost:3000/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            paragraphs: chunk.paragraphs
          })
        });

        const result = await response.json();

        if (response.ok && result.highlights) {
          console.log(`Chunk ${chunk.chunkIndex} processed: ${result.highlights.length} highlights`);
          responseManager.addResponse(chunk.chunkIndex, result.highlights);
        } else {
          console.warn(`Chunk ${chunk.chunkIndex} failed or no highlights:`, result);
          responseManager.addResponse(chunk.chunkIndex, []);
        }
      } catch (error) {
        console.error(`Error processing chunk ${chunk.chunkIndex}:`, error);
        responseManager.addResponse(chunk.chunkIndex, []);
      }
    });

    // Wait for all chunks to complete
    await Promise.all(chunkPromises);
    console.timeEnd('Parallel Network Requests');

    // Check completion
    if (responseManager.isComplete()) {
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