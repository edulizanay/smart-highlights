// Test to debug the concurrent processing issue where chunk 16 is sent as the second request

// Simulate the concurrent processing logic from content.js
async function processConcurrentChunks(chunks, maxConcurrent = 2) {
  let index = 0;
  const inProgress = new Map();
  const processedOrder = [];

  // Simulate processing a chunk
  const processChunk = async (chunk) => {
    const startTime = Date.now();
    console.log(`[${startTime}] Starting chunk ${chunk.chunkIndex} (array index ${chunk.arrayIndex})`);
    processedOrder.push(chunk.chunkIndex);

    // Simulate network delay (random between 100-500ms)
    const delay = Math.random() * 400 + 100;
    await new Promise(resolve => setTimeout(resolve, delay));

    console.log(`[${Date.now()}] Completed chunk ${chunk.chunkIndex} after ${delay.toFixed(0)}ms`);
    return chunk.chunkIndex;
  };

  console.log('\n=== STARTING CONCURRENT PROCESSING ===');
  console.log(`Total chunks: ${chunks.length}, Max concurrent: ${maxConcurrent}`);
  console.log('Chunks array:', chunks.map(c => `[${c.arrayIndex}]=${c.chunkIndex}`).join(', '));

  // Keep maxConcurrent requests running at all times
  while (index < chunks.length || inProgress.size > 0) {
    console.log(`\n--- Loop iteration: index=${index}, inProgress.size=${inProgress.size}`);
    console.log(`   InProgress chunks: ${Array.from(inProgress.keys()).join(', ')}`);

    // Start new requests up to the concurrent limit
    while (inProgress.size < maxConcurrent && index < chunks.length) {
      const chunk = chunks[index];
      console.log(`   Starting chunk at index ${index}: chunkIndex=${chunk.chunkIndex}`);

      const promise = processChunk(chunk).then(() => {
        console.log(`   [Cleanup] Deleting chunk ${chunk.chunkIndex} from inProgress`);
        inProgress.delete(chunk.chunkIndex);
      });

      inProgress.set(chunk.chunkIndex, promise);
      index++;

      console.log(`   After starting: index=${index}, inProgress.size=${inProgress.size}`);
    }

    // Wait for at least one to complete before continuing
    if (inProgress.size > 0) {
      console.log(`   Waiting for Promise.race() with ${inProgress.size} promises...`);
      await Promise.race(Array.from(inProgress.values()));
      console.log(`   Promise.race() resolved!`);

      // Add a small delay to see if cleanup has happened
      await new Promise(resolve => setTimeout(resolve, 10));
      console.log(`   After 10ms delay: inProgress.size=${inProgress.size}`);
    }
  }

  return processedOrder;
}

// Test with chunks similar to the real scenario
async function runTest() {
  console.log('=== TEST 1: Sequential chunks (expected behavior) ===');
  const sequentialChunks = [];
  for (let i = 0; i < 10; i++) {
    sequentialChunks.push({ chunkIndex: i, arrayIndex: i });
  }

  const order1 = await processConcurrentChunks(sequentialChunks, 2);
  console.log('\nFinal processing order:', order1);
  console.log('Expected: Mostly sequential (0,1,2,3,4,5,6,7,8,9)');

  // Check if the issue might be in chunk creation
  console.log('\n\n=== TEST 2: What if chunks array is misordered? ===');
  const misorderedChunks = [
    { chunkIndex: 0, arrayIndex: 0 },
    { chunkIndex: 16, arrayIndex: 1 },  // This could explain chunk 16 being second!
    { chunkIndex: 1, arrayIndex: 2 },
    { chunkIndex: 2, arrayIndex: 3 },
    { chunkIndex: 3, arrayIndex: 4 },
  ];

  const order2 = await processConcurrentChunks(misorderedChunks, 2);
  console.log('\nFinal processing order:', order2);
  console.log('If chunks array is wrong, we would see: 0,16,1,2,3');
}

// Run the test
runTest().catch(console.error);