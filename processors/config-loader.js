// ABOUTME: Loads and parses LLM prompt configuration from YAML
// ABOUTME: Provides mode-specific settings including categories for evaluation

const { loadPrompts } = require('./llm-processor');

/**
 * Load configuration for a specific mode
 * @param {string} mode - 'study' or 'general'
 * @returns {Object} Config with {categories, model, systemPrompt, userPrompt}
 */
function loadModeConfig(mode) {
  const config = loadPrompts();
  const modeKey = `${mode}_mode`;

  if (!config.prompts || !config.prompts[modeKey]) {
    const availableModes = Object.keys(config.prompts || {})
      .map(k => k.replace('_mode', ''))
      .join(', ');
    throw new Error(`Unknown mode: ${mode}. Available modes: ${availableModes}`);
  }

  const modeConfig = config.prompts[modeKey];

  // Validate required fields
  if (!modeConfig.categories || !Array.isArray(modeConfig.categories)) {
    throw new Error(`Mode '${mode}' missing 'categories' array in llm-prompts.yaml`);
  }

  return {
    categories: modeConfig.categories,
    model: modeConfig.model,
    systemPrompt: modeConfig.system_prompt || '',
    userPrompt: modeConfig.user_prompt
  };
}

module.exports = { loadModeConfig };
