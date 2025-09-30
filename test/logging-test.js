// ABOUTME: Test script to verify consolidated logging with concurrent chunks
// ABOUTME: Simulates multiple chunk processing to test NDJSON append behavior

const fs = require('fs');
const path = require('path');

// Mock chunk data
const testChunks = [
  { chunkIndex: 0, totalChunks: 3, paragraphs: { para_0: 'Test paragraph one' } },
  { chunkIndex: 1, totalChunks: 3, paragraphs: { para_1: 'Test paragraph two' } },
  { chunkIndex: 2, totalChunks: 3, paragraphs: { para_2: 'Test paragraph three' } }
];

async function testLogging() {
  console.log('Testing consolidated logging...\n');

  // Send test requests to local server
  for (const chunk of testChunks) {
    console.log(`Sending chunk ${chunk.chunkIndex}...`);

    try {
      const response = await fetch('http://localhost:3000/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk)
      });

      const result = await response.json();
      console.log(`✓ Chunk ${chunk.chunkIndex} response:`, result.message);
    } catch (error) {
      console.error(`✗ Chunk ${chunk.chunkIndex} failed:`, error.message);
    }
  }

  // Wait a bit for async logging to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check log file
  const logPath = path.join(__dirname, '..', 'logs', 'processing-log.ndjson');

  if (fs.existsSync(logPath)) {
    console.log('\n✓ Log file created at:', logPath);

    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.trim().split('\n');

    console.log(`✓ Log entries: ${lines.length}`);
    console.log('\nFirst entry:');
    console.log(JSON.stringify(JSON.parse(lines[0]), null, 2));
  } else {
    console.log('\n⚠ No log file created (LOG_LEVEL may not be set)');
    console.log('Set LOG_LEVEL=INFO or LOG_LEVEL=DEBUG in .env to enable logging');
  }
}

testLogging().catch(console.error);