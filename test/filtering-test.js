// Test to prove that paragraph filtering causes chunk misordering

// Simulate the filtering and chunking from content.js
function simulateChunking() {
  // Simulate paragraphs from a webpage
  const allParagraphs = [
    { id: 'para_0', text: 'This is a long paragraph with more than 30 characters' },
    { id: 'para_1', text: 'Short text' },  // < 30 chars, will be filtered
    { id: 'para_2', text: 'Another short' },  // < 30 chars, will be filtered
    { id: 'para_3', text: 'Small' },  // < 30 chars, will be filtered
    { id: 'para_4', text: 'Tiny' },  // < 30 chars, will be filtered
    { id: 'para_5', text: 'Brief' },  // < 30 chars, will be filtered
    { id: 'para_6', text: 'Quick' },  // < 30 chars, will be filtered
    { id: 'para_7', text: 'Fast' },  // < 30 chars, will be filtered
    { id: 'para_8', text: 'Mini' },  // < 30 chars, will be filtered
    { id: 'para_9', text: 'Micro' },  // < 30 chars, will be filtered
    { id: 'para_10', text: 'Nano' },  // < 30 chars, will be filtered
    { id: 'para_11', text: 'Pico' },  // < 30 chars, will be filtered
    { id: 'para_12', text: 'Small text' },  // < 30 chars, will be filtered
    { id: 'para_13', text: 'Little' },  // < 30 chars, will be filtered
    { id: 'para_14', text: 'Compact' },  // < 30 chars, will be filtered
    { id: 'para_15', text: 'Dense' },  // < 30 chars, will be filtered
    { id: 'para_16', text: 'This is paragraph 16 with lots of text to make it long enough' },
    { id: 'para_17', text: 'This is paragraph 17 also with sufficient text content here' },
  ];

  // Step 1: Filter paragraphs (like line 250 in content.js)
  const extractedData = {};
  allParagraphs.forEach(para => {
    if (para.text.length > 30) {  // Filter out short UI text
      extractedData[para.id] = para.text;
    }
  });

  console.log('=== AFTER FILTERING (> 30 chars) ===');
  console.log('Extracted data keys:', Object.keys(extractedData));
  console.log('');

  // Step 2: Create chunks (simplified version of chunkParagraphs)
  const chunks = [];
  const paragraphEntries = Object.entries(extractedData);

  paragraphEntries.forEach(([paraId, text], index) => {
    chunks.push({
      chunkIndex: index,
      paragraphs: { [paraId]: text }
    });
  });

  console.log('=== CHUNKS CREATED ===');
  chunks.forEach(chunk => {
    const paraIds = Object.keys(chunk.paragraphs);
    console.log(`Chunk ${chunk.chunkIndex}: contains ${paraIds.join(', ')}`);
  });

  console.log('\n=== RESULT ===');
  console.log('Chunk 0 contains: para_0 ✓');
  console.log('Chunk 1 contains: para_16 (NOT para_1!) ← THIS IS THE BUG!');
  console.log('Chunk 2 contains: para_17 ✓');

  return chunks;
}

// Run the test
console.log('DEMONSTRATION: Why chunk 16 is sent as the second request\n');
simulateChunking();