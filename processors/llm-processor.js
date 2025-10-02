// ABOUTME: LLM processor for handling OpenRouter API calls and response parsing
// ABOUTME: Centralizes all LLM-related logic for highlight extraction

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
require('dotenv').config();

let promptsCache = null;

/**
 * Load prompts from YAML file (cached after first load)
 */
function loadPrompts() {
  if (promptsCache) {
    return promptsCache;
  }

  const yamlPath = path.join(__dirname, 'llm-prompts.yaml');
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  promptsCache = yaml.load(yamlContent);

  return promptsCache;
}

/**
 * Get a specific prompt by mode
 * @param {string} mode - The prompt mode (e.g., 'general_mode', 'study_mode')
 * @returns {string} The prompt template
 */
function getPrompt(mode) {
  const prompts = loadPrompts();

  if (!prompts.prompts || !prompts.prompts[mode]) {
    throw new Error(`Prompt mode '${mode}' not found in YAML configuration`);
  }

  return prompts.prompts[mode].user_prompt;
}

/**
 * Replace template placeholders with actual data
 * @param {string} template - The prompt template with placeholders
 * @param {object} data - The data to inject (will be JSON stringified)
 * @returns {string} The filled template
 */
function fillTemplate(template, data) {
  const jsonData = JSON.stringify(data, null, 2);
  return template.replace('{{PARAGRAPHS_JSON}}', jsonData);
}

/**
 * Get model name for a specific mode
 * @param {string} mode - The prompt mode
 * @returns {string} The model identifier
 */
function getModel(mode) {
  const prompts = loadPrompts();

  if (!prompts.prompts || !prompts.prompts[mode]) {
    throw new Error(`Prompt mode '${mode}' not found in YAML configuration`);
  }

  return prompts.prompts[mode].model;
}

/**
 * Get categories for a specific mode
 * @param {string} mode - The mode name (e.g., 'study', 'general')
 * @returns {Array<string>} Array of categories for this mode
 */
function getCategories(mode) {
  const prompts = loadPrompts();
  const modeKey = `${mode}_mode`;

  if (!prompts.prompts || !prompts.prompts[modeKey]) {
    const availableModes = Object.keys(prompts.prompts || {})
      .map(k => k.replace('_mode', ''))
      .join(', ');
    throw new Error(`Unknown mode: ${mode}. Available modes: ${availableModes}`);
  }

  const categories = prompts.prompts[modeKey].categories;

  if (!categories || !Array.isArray(categories)) {
    throw new Error(`Mode '${mode}' missing 'categories' array in llm-prompts.yaml`);
  }

  return categories;
}

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
  createReadableLog,
  loadPrompts,
  getPrompt,
  fillTemplate,
  getModel,
  getCategories
};