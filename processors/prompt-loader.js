// ABOUTME: Utility for loading LLM prompts from YAML configuration
// ABOUTME: Supports multiple prompt modes and template variable replacement

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

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

module.exports = {
  loadPrompts,
  getPrompt,
  fillTemplate,
  getModel
};