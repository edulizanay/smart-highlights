// ABOUTME: Express server for handling paragraph extraction from browser extension
// ABOUTME: Receives extracted text data and processes it for LLM highlighting

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Function to extract content from response tags
function extractResponseContent(llmContent) {
  console.log('Raw LLM content length:', llmContent.length);
  console.log('Raw LLM content preview:', llmContent.substring(0, 200) + '...');

  const responseMatch = llmContent.match(/<response>(.*?)<\/response>/s);
  if (responseMatch) {
    const extractedContent = responseMatch[1].trim();
    console.log('Extracted response content:', extractedContent);
    return extractedContent;
  }

  console.log('No <response> tags found, trying direct JSON parse');
  throw new Error('No <response> tags found in LLM output');
}

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
      console.log('Sending to OpenRouter for analysis...');

      const openRouterResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'x-ai/grok-4-fast',
          messages: [
            {
              role: 'user',
              content: `Given these paragraphs from a web article, identify the most important phrases to highlight. Use thinking tags to annotate, then

Return a JSON object with this exact format:
{
  "highlights": [
    {"id": "para_0", "phrases": ["key phrase one", "important detail"]}
  ]
}

in <response> tags.

Example: If para_3 contains "The president announced new policies today regarding climate change", you might return:

<thinking>
This paragraph discusses government policy announcements. Key phrases: "president announced", "new policies", "climate change" - these are the most important parts.
</thinking>

<response>
{"highlights": [{"id": "para_3", "phrases": ["president announced", "new policies", "climate change"]}]}
</response>

Only include paragraphs with important content. Return 2-3 key phrases per paragraph.

Paragraphs:
${JSON.stringify(paragraphs, null, 2)}`
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTERAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Save the raw response
      const llmResponsePath = path.join(__dirname, 'llm-response.json');
      fs.writeFileSync(llmResponsePath, JSON.stringify(openRouterResponse.data, null, 2));
      console.log('LLM response saved to:', llmResponsePath);

      // Parse the LLM response to extract highlights
      try {
        const llmContent = openRouterResponse.data.choices[0].message.content;

        // Extract content from response tags
        const responseContent = extractResponseContent(llmContent);
        const parsedHighlights = JSON.parse(responseContent);
        console.log('Parsed highlights:', parsedHighlights);

        // Return success response with LLM highlights
        res.json({
          success: true,
          paragraphCount: Object.keys(paragraphs).length,
          message: 'Paragraphs received and processed successfully',
          highlights: parsedHighlights.highlights
        });

      } catch (parseError) {
        console.error('Error parsing LLM response:', parseError.message);
        // Return success but without highlights if parsing fails
        res.json({
          success: true,
          paragraphCount: Object.keys(paragraphs).length,
          message: 'Paragraphs received but LLM response parsing failed'
        });
      }

    } catch (llmError) {
      console.error('OpenRouter API error:', llmError.message);
      // Return success but without highlights if LLM fails
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