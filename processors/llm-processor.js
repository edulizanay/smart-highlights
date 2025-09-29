// ABOUTME: LLM processor for handling OpenRouter API calls and response parsing
// ABOUTME: Centralizes all LLM-related logic for highlight extraction

const axios = require('axios');
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
 */
async function processWithLLM(paragraphs) {
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