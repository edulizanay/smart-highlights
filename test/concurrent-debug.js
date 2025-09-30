// Debug the exact concurrent processing issue

async function processConcurrentChunks(chunks, maxConcurrent = 2) {
  let index = 0;
  const inProgress = new Map();
  const sendOrder = [];

  // Simulate processing a chunk
  const processChunk = async (chunk) => {
    sendOrder.push(chunk.chunkIndex);
    console.log(`🚀 SENDING chunk ${chunk.chunkIndex} (array position ${chunk.arrayPos})`);

    // Simulate network delay
    const delay = Math.random() * 100 + 50;
    await new Promise(resolve => setTimeout(resolve, delay));

    console.log(`✅ COMPLETED chunk ${chunk.chunkIndex} after ${delay.toFixed(0)}ms`);
    return chunk.chunkIndex;
  };

  console.log('\n=== DEBUGGING CONCURRENT PROCESSING ===');

  // The exact same logic from content.js
  while (index < chunks.length || inProgress.size > 0) {
    console.log(`\n--- LOOP: index=${index}, inProgress.size=${inProgress.size}`);
    console.log(`    InProgress chunks: [${Array.from(inProgress.keys()).join(', ')}]`);

    // Start new requests up to the concurrent limit
    while (inProgress.size < maxConcurrent && index < chunks.length) {
      const chunk = chunks[index];
      console.log(`    About to start chunk at index ${index}: chunkIndex=${chunk.chunkIndex}`);

      const promise = processChunk(chunk).then(() => {
        console.log(`    [CLEANUP] Removing chunk ${chunk.chunkIndex} from inProgress`);
        inProgress.delete(chunk.chunkIndex);
      });

      inProgress.set(chunk.chunkIndex, promise);
      index++;
      console.log(`    Started! New state: index=${index}, inProgress.size=${inProgress.size}`);
    }

    // Wait for at least one to complete before continuing
    if (inProgress.size > 0) {
      console.log(`    ⏳ Waiting for Promise.race() with ${inProgress.size} promises...`);
      await Promise.race(Array.from(inProgress.values()));
      console.log(`    🏁 Promise.race() resolved!`);

      // Small delay to observe cleanup timing
      await new Promise(resolve => setTimeout(resolve, 5));
      console.log(`    After cleanup: inProgress.size=${inProgress.size}`);
    }
  }

  return sendOrder;
}

// Test with realistic chunk structure
async function runDebugTest() {
  // Create chunks like the real system
  const chunks = [];
  for (let i = 0; i < 10; i++) {
    chunks.push({
      chunkIndex: i,
      arrayPos: i,
      paragraphs: { [`para_${i}`]: `Content for paragraph ${i}` }
    });
  }

  console.log('Input chunks:', chunks.map(c => `[${c.arrayPos}]=${c.chunkIndex}`).join(', '));

  const sendOrder = await processConcurrentChunks(chunks, 2);

  console.log('\n=== RESULTS ===');
  console.log('Send order:', sendOrder);
  console.log('Expected:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]');

  if (sendOrder.join(',') !== '0,1,2,3,4,5,6,7,8,9') {
    console.log('🚨 BUG DETECTED! Chunks sent out of order!');
  } else {
    console.log('✅ Chunks sent in correct order');
  }
}

runDebugTest().catch(console.error);