// ABOUTME: Express server for handling paragraph extraction from browser extension
// ABOUTME: Receives extracted text data and processes it for LLM highlighting

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { processWithLLM } = require('./processors/llm-processor');
const { logChunkProcessing } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Auto-incrementing run ID for tracking processing runs
let lastRunId = 0;

// CORS configuration for browser extension
app.use(cors({
  origin: true, // Allow all origins for development (extension origins vary)
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Input validation middleware
function validateParagraphData(req, res, next) {
  const { paragraphs, chunkIndex, totalChunks } = req.body;
  const actualParagraphs = paragraphs || req.body;

  // Check for empty or invalid payload
  if (!actualParagraphs || typeof actualParagraphs !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload',
      message: 'Request must contain paragraph data as an object'
    });
  }

  const paraCount = Object.keys(actualParagraphs).length;

  // Check for empty paragraphs
  if (paraCount === 0) {
    return res.status(400).json({
      success: false,
      error: 'Empty payload',
      message: 'No paragraphs provided'
    });
  }

  // Check for reasonable size to prevent abuse
  if (paraCount > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Payload too large',
      message: `Maximum 1000 paragraphs allowed, received ${paraCount}`
    });
  }

  next();
}

// POST /extract - receive paragraph data from extension
app.post('/extract', validateParagraphData, async (req, res) => {
  try {
    const { chunkIndex, totalChunks, paragraphs, mode } = req.body;

    // Auto-increment run_id or use manual override from query param
    const runId = req.query.run_id ? parseInt(req.query.run_id) : ++lastRunId;

    // Handle both old format (direct paragraphs) and new format (chunks)
    const actualParagraphs = paragraphs || req.body;
    const isChunkedRequest = chunkIndex !== undefined;
    const highlightMode = mode || 'study'; // Default to study mode if not provided

    // Log received data for debugging
    console.log('=== RECEIVED PARAGRAPH DATA ===');
    console.log(`Paragraphs received: ${Object.keys(actualParagraphs).length}`);
    console.log(`Mode: ${highlightMode}`);
    if (isChunkedRequest) {
      console.log(`Chunk: ${chunkIndex + 1}/${totalChunks}`);
    }

    // Send to OpenRouter LLM for highlighting analysis
    const timerLabel = isChunkedRequest ? `LLM Processing Chunk ${chunkIndex}` : 'LLM Processing';
    console.time(timerLabel);
    try {
      const llmResult = await processWithLLM(actualParagraphs, highlightMode);
      console.timeEnd(timerLabel);

      // Return success response with LLM highlights and chunk metadata
      res.json({
        success: true,
        paragraphCount: Object.keys(actualParagraphs).length,
        message: 'Paragraphs received and processed successfully',
        highlights: llmResult.highlights,
        run_id: runId,
        ...(isChunkedRequest && {
          chunkIndex,
          totalChunks
        })
      });

      // Log asynchronously after response sent (non-blocking)
      if (process.env.LOG_LEVEL === 'DEBUG' || process.env.LOG_LEVEL === 'INFO') {
        logChunkProcessing(
          runId,
          isChunkedRequest ? chunkIndex : 0,
          isChunkedRequest ? totalChunks : 1,
          actualParagraphs,
          llmResult
        ).catch(err => {
          console.error('Async logging failed:', err.message);
        });
      }

    } catch (error) {
      console.timeEnd(timerLabel);
      console.error('LLM processing error:', error.message);

      // Graceful degradation: return success with empty highlights
      res.json({
        success: true,
        paragraphCount: Object.keys(actualParagraphs).length,
        message: 'Paragraphs received but LLM processing failed',
        highlights: [],
        run_id: runId,
        llmError: true,
        errorMessage: error.message,
        ...(isChunkedRequest && {
          chunkIndex,
          totalChunks
        })
      });
    }

    console.log('=== END PARAGRAPH DATA ===');

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(400).json({
      error: 'Invalid JSON',
      message: error.message
    });
  }
});

// Handle other methods on /extract
app.all('/extract', (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }
});

// POST /capture-paragraphs - save raw paragraphs for eval testing
app.post('/capture-paragraphs', validateParagraphData, async (req, res) => {
  try {
    const { paragraphs } = req.body;
    const actualParagraphs = paragraphs || req.body;

    console.log('=== CAPTURING PARAGRAPHS ===');
    console.log(`Paragraphs to capture: ${Object.keys(actualParagraphs).length}`);

    // Save to evals/raw-paragraphs.json
    const evalsDir = path.join(__dirname, 'evals');
    const outputPath = path.join(evalsDir, 'raw-paragraphs.json');

    // Ensure evals directory exists
    if (!fs.existsSync(evalsDir)) {
      fs.mkdirSync(evalsDir, { recursive: true });
    }

    // Write paragraphs to file
    fs.writeFileSync(outputPath, JSON.stringify(actualParagraphs, null, 2));

    console.log(`Saved to: ${outputPath}`);
    console.log('=== CAPTURE COMPLETE ===');

    res.json({
      success: true,
      paragraphCount: Object.keys(actualParagraphs).length,
      message: 'Paragraphs captured successfully',
      outputPath: outputPath
    });

  } catch (error) {
    console.error('Error capturing paragraphs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture paragraphs',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Smart Highlights server running on http://localhost:${PORT}`);
  console.log('Ready to receive paragraph data from browser extension');
});