// ABOUTME: LLM processor for handling OpenRouter API calls and response parsing
// ABOUTME: Centralizes all LLM-related logic for highlight extraction

const axios = require('axios');
const { getPrompt, fillTemplate, getModel } = require('./prompt-loader');
require('dotenv').config();

/**
 * Extract content from response tags in LLM output
 */
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

/**
 * Process paragraphs through OpenRouter LLM for highlight extraction
 * @param {object} paragraphs - The paragraphs to process
 * @param {string} mode - The highlighting mode ('study' or 'general')
 */
async function processWithLLM(paragraphs, mode = 'study') {
  console.log(`Sending to OpenRouter for analysis (${mode} mode)...`);

  // Load prompt from YAML configuration based on mode
  const promptMode = mode + '_mode'; // 'study' -> 'study_mode', 'general' -> 'general_mode'
  const promptTemplate = getPrompt(promptMode);
  const model = getModel(promptMode);
  const filledPrompt = fillTemplate(promptTemplate, paragraphs);

  const openRouterResponse = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: model,
      messages: [
        {
          role: 'user',
          content: filledPrompt
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

  // Parse the LLM response to extract highlights
  const llmContent = openRouterResponse.data.choices[0].message.content;
  const responseContent = extractResponseContent(llmContent);
  const parsedHighlights = JSON.parse(responseContent);
  console.log('Parsed highlights:', parsedHighlights);

  return {
    highlights: parsedHighlights.highlights,
    rawResponse: openRouterResponse.data
  };
}

/**
 * Create a human-readable log from LLM response
 */
function createReadableLog(llmContent) {
  // Convert \n to actual line breaks in the raw content
  let formattedContent = llmContent.replace(/\\n/g, '\n');
  
  // Extract and pretty-print the JSON in the response tags
  const responseMatch = formattedContent.match(/<response>(.*?)<\/response>/s);
  if (responseMatch) {
    try {
      // Parse the JSON inside response tags
      const jsonContent = responseMatch[1].trim();
      const parsedJson = JSON.parse(jsonContent);
      
      // Pretty-print the JSON
      const prettyJson = JSON.stringify(parsedJson, null, 2);
      
      // Replace the compressed JSON with pretty-printed version
      formattedContent = formattedContent.replace(
        /<response>.*?<\/response>/s,
        `<response>\n${prettyJson}\n</response>`
      );
    } catch (error) {
      console.log('Could not parse JSON in response, keeping original format');
    }
  }
  
  return formattedContent;
}

module.exports = {
  processWithLLM,
  extractResponseContent,
  createReadableLog
};