// ABOUTME: Test script to verify paragraph filtering logic using logs data
// ABOUTME: Simulates what content.js should be doing with filtering

// Read the actual data we got from the last run
const fs = require('fs');
const path = require('path');

// Load the extracted data from our logs
const extractedDataPath = path.join(__dirname, '../logs/extracted-data.json');
const extractedData = JSON.parse(fs.readFileSync(extractedDataPath, 'utf8'));

console.log('=== Analyzing Extracted Data from Last Run ===\n');
console.log(`Timestamp: ${extractedData.timestamp}`);
console.log(`Total paragraphs received: ${extractedData.paragraphCount}\n`);

// Simulate what our filtering SHOULD do
console.log('=== Testing Current Filter Logic (>30 chars) ===\n');

const filteredData = {};
let includedCount = 0;
let filteredOutCount = 0;

for (const [id, text] of Object.entries(extractedData.paragraphs)) {
  const length = text.length;

  if (length > 30) {
    filteredData[id] = text;
    includedCount++;
    console.log(`✓ ${id}: "${text.substring(0, 40)}..." (${length} chars) - INCLUDED`);
  } else {
    filteredOutCount++;
    console.log(`✗ ${id}: "${text}" (${length} chars) - SHOULD BE FILTERED`);
  }
}

console.log('\n=== Summary ===');
console.log(`Original count: ${extractedData.paragraphCount} paragraphs`);
console.log(`After filtering (>30 chars): ${includedCount} paragraphs`);
console.log(`Filtered out: ${filteredOutCount} paragraphs`);
console.log(`Reduction: ${Math.round(filteredOutCount / extractedData.paragraphCount * 100)}%`);

console.log('\n=== Items that SHOULD have been filtered out ===');
for (const [id, text] of Object.entries(extractedData.paragraphs)) {
  if (text.length <= 30) {
    console.log(`- "${text}" (${text.length} chars)`);
  }
}

console.log('\n=== PROBLEM DIAGNOSIS ===');
if (filteredOutCount > 0) {
  console.log('❌ ISSUE FOUND: Short text items are still being sent to the server!');
  console.log('   This means the client-side filtering is NOT working.');
  console.log('\nPossible causes:');
  console.log('1. Browser extension is using cached old code');
  console.log('2. The filter condition is not being applied correctly');
  console.log('3. These might not be <p> tags but something else on the actual page');
} else {
  console.log('✅ Filtering appears to be working correctly - all items are >30 chars');
}

// Check for obvious headers
console.log('\n=== Checking for obvious headers in data ===');
const headerPatterns = [
  'Quickstart',
  'Using the OpenAI SDK',
  'Using the OpenRouter API directly',
  'Using third-party SDKs'
];

headerPatterns.forEach(pattern => {
  for (const [id, text] of Object.entries(extractedData.paragraphs)) {
    if (text === pattern) {
      console.log(`⚠️  Found header as paragraph: "${pattern}" (${id})`);
    }
  }
});

console.log('\n=== CONCLUSION ===');
console.log('Based on the data, it appears that:');
console.log('1. Headers like "Quickstart" ARE being captured as paragraphs');
console.log('2. Short items like "+" (1 char) are still in the data');
console.log('3. The >30 char filter is NOT being applied on the client side');
console.log('\nThe filtering code in content.js lines 112-114 is likely not executing,');
console.log('or the browser extension needs to be reloaded to pick up the changes.');