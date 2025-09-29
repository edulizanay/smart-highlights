// ABOUTME: Express server for handling paragraph extraction from browser extension
// ABOUTME: Receives extracted text data and processes it for LLM highlighting

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { processWithLLM } = require('./processors/llm-processor');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for browser extension
app.use(cors({
  origin: true, // Allow all origins for development (extension origins vary)
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// POST /extract - receive paragraph data from extension
app.post('/extract', async (req, res) => {
  try {
    const { chunkIndex, totalChunks, paragraphs } = req.body;

    // Handle both old format (direct paragraphs) and new format (chunks)
    const actualParagraphs = paragraphs || req.body;
    const isChunkedRequest = chunkIndex !== undefined;

    // Save data to JSON file (append chunk info if chunked)
    const dataToSave = {
      timestamp: new Date().toISOString(),
      paragraphCount: Object.keys(actualParagraphs).length,
      paragraphs: actualParagraphs,
      ...(isChunkedRequest && {
        chunkIndex,
        totalChunks,
        isChunk: true
      })
    };

    // Ensure logs directory exists
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    // Save with chunk-specific filename if chunked
    const fileName = isChunkedRequest ?
      `extracted-data-chunk-${chunkIndex}.json` :
      'extracted-data.json';
    const jsonFilePath = path.join(__dirname, 'logs', fileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(dataToSave, null, 2));

    // Log received data for debugging
    console.log('=== RECEIVED PARAGRAPH DATA ===');
    console.log(`Paragraphs received: ${Object.keys(actualParagraphs).length}`);
    if (isChunkedRequest) {
      console.log(`Chunk: ${chunkIndex + 1}/${totalChunks}`);
    }
    console.log(`Data saved to: ${jsonFilePath}`);

    // Send to OpenRouter LLM for highlighting analysis
    console.time('LLM Processing');
    try {
      const llmResult = await processWithLLM(actualParagraphs);
      console.timeEnd('LLM Processing');

      // Save the raw response with chunk-specific filename
      const responseFileName = isChunkedRequest ?
        `llm-response-chunk-${chunkIndex}.json` :
        'llm-response.json';
      const llmResponsePath = path.join(__dirname, 'logs', responseFileName);
      fs.writeFileSync(llmResponsePath, JSON.stringify(llmResult.rawResponse, null, 2));
      console.log('LLM response saved to:', llmResponsePath);

      // Create and save readable log
      const { createReadableLog } = require('./processors/llm-processor');
      const llmContent = llmResult.rawResponse.choices[0].message.content;
      const readableLogContent = createReadableLog(llmContent);

      const logFileName = isChunkedRequest ?
        `llm-readable-log-chunk-${chunkIndex}.txt` :
        'llm-readable-log.txt';
      const readableLogPath = path.join(__dirname, 'logs', logFileName);
      fs.writeFileSync(readableLogPath, readableLogContent);
      console.log('Readable log saved to:', readableLogPath);

      // Return success response with LLM highlights and chunk metadata
      res.json({
        success: true,
        paragraphCount: Object.keys(actualParagraphs).length,
        message: 'Paragraphs received and processed successfully',
        highlights: llmResult.highlights,
        ...(isChunkedRequest && {
          chunkIndex,
          totalChunks
        })
      });

    } catch (error) {
      console.timeEnd('LLM Processing');
      console.error('LLM processing error:', error.message);

      // Return success but without highlights if LLM processing fails
      res.json({
        success: true,
        paragraphCount: Object.keys(actualParagraphs).length,
        message: 'Paragraphs received but LLM processing failed',
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Smart Highlights server running on http://localhost:${PORT}`);
  console.log('Ready to receive paragraph data from browser extension');
});