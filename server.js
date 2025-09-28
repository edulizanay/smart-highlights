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
    const paragraphs = req.body;

    // Save data to JSON file (overwrites each time)
    const dataToSave = {
      timestamp: new Date().toISOString(),
      paragraphCount: Object.keys(paragraphs).length,
      paragraphs: paragraphs
    };

    const jsonFilePath = path.join(__dirname, 'extracted-data.json');
    fs.writeFileSync(jsonFilePath, JSON.stringify(dataToSave, null, 2));

    // Log received data for debugging
    console.log('=== RECEIVED PARAGRAPH DATA ===');
    console.log(`Paragraphs received: ${Object.keys(paragraphs).length}`);
    console.log(`Data saved to: ${jsonFilePath}`);

    // Send to OpenRouter LLM for highlighting analysis
    try {
      const llmResult = await processWithLLM(paragraphs);

      // Save the raw response
      const llmResponsePath = path.join(__dirname, 'llm-response.json');
      fs.writeFileSync(llmResponsePath, JSON.stringify(llmResult.rawResponse, null, 2));
      console.log('LLM response saved to:', llmResponsePath);

      // Return success response with LLM highlights
      res.json({
        success: true,
        paragraphCount: Object.keys(paragraphs).length,
        message: 'Paragraphs received and processed successfully',
        highlights: llmResult.highlights
      });

    } catch (error) {
      console.error('LLM processing error:', error.message);

      // Return success but without highlights if LLM processing fails
      res.json({
        success: true,
        paragraphCount: Object.keys(paragraphs).length,
        message: 'Paragraphs received but LLM processing failed'
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