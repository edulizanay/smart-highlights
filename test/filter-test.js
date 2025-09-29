// ABOUTME: Test script that fetches actual OpenRouter page and tests filtering
// ABOUTME: Compares current implementation against what we're actually getting

const axios = require('axios');
const { JSDOM } = require('jsdom');

async function testFiltering() {
  console.log('=== Fetching OpenRouter Quickstart Page ===\n');

  try {
    // Fetch the actual page
    const response = await axios.get('https://openrouter.ai/docs/quickstart');
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    console.log('Page fetched successfully\n');

    // Test 1: Current implementation (only <p> tags)
    console.log('=== CURRENT IMPLEMENTATION (only <p> tags) ===\n');
    const pElements = document.querySelectorAll('p');
    console.log(`Found ${pElements.length} <p> elements\n`);

    const currentExtractedData = {};
    let currentFiltered = 0;

    pElements.forEach((element, i) => {
      const id = `para_${i}`;
      const text = element.textContent.trim();

      // This is what our current content.js does
      if (text.length > 30) {
        currentExtractedData[id] = text;
        currentFiltered++;
        console.log(`✓ para_${i}: "${text.substring(0, 50)}..." (${text.length} chars)`);
      } else {
        console.log(`✗ para_${i}: "${text}" (${text.length} chars) - FILTERED OUT`);
      }
    });

    console.log(`\nResult: ${currentFiltered} paragraphs would be sent to LLM\n`);

    // Test 2: What we were doing before (p, h1, h2, h3)
    console.log('\n=== OLD IMPLEMENTATION (p, h1, h2, h3) ===\n');
    const allElements = document.querySelectorAll('p, h1, h2, h3');
    console.log(`Found ${allElements.length} total elements\n`);

    const oldExtractedData = {};

    allElements.forEach((element, i) => {
      const id = `para_${i}`;
      const text = element.textContent.trim();
      oldExtractedData[id] = text;
    });

    // Compare with what we saw in logs
    console.log('Sample of what was being sent (no filtering):');
    let count = 0;
    for (const [id, text] of Object.entries(oldExtractedData)) {
      if (count < 15) {
        const tag = allElements[parseInt(id.split('_')[1])].tagName;
        console.log(`${id} [${tag}]: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        count++;
      }
    }

    // Test 3: Check what elements contain our problematic text
    console.log('\n\n=== INVESTIGATING PROBLEMATIC ENTRIES ===\n');
    const problematicTexts = [
      "Quickstart",
      "Using the OpenAI SDK",
      "Using the OpenRouter API directly",
      "Using third-party SDKs",
      "+",
      "Tip: you can toggle this pane with"
    ];

    problematicTexts.forEach(searchText => {
      // Find all elements containing this text
      const xpath = `//*[contains(text(), '${searchText.replace(/'/g, "\\'")}')]`;
      const results = document.evaluate(xpath, document, null, 5, null); // ORDERED_NODE_ITERATOR_TYPE

      let element;
      let found = false;
      while (element = results.iterateNext()) {
        if (element.textContent.trim() === searchText || element.textContent.trim().includes(searchText)) {
          console.log(`"${searchText}"`);
          console.log(`  Found as: <${element.tagName.toLowerCase()}>`);
          console.log(`  Classes: ${element.className || '(none)'}`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`"${searchText}" - NOT FOUND on page`);
      }
    });

    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Current implementation (<p> only with >30 chars):`);
    console.log(`  - Would send ${currentFiltered} paragraphs to LLM`);
    console.log(`  - Filters out short text like "+", headers, etc.`);
    console.log(`\nOld implementation (p, h1, h2, h3 no filter):`);
    console.log(`  - Would send ${Object.keys(oldExtractedData).length} elements to LLM`);
    console.log(`  - Includes headers and UI elements`);

    // Show what we're filtering out
    const difference = Object.keys(oldExtractedData).length - currentFiltered;
    console.log(`\n✅ Filtering saves ${difference} unnecessary elements (${Math.round(difference / Object.keys(oldExtractedData).length * 100)}% reduction)`);

  } catch (error) {
    console.error('Error fetching page:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

// Run the test
testFiltering();