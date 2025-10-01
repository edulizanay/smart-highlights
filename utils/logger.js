// ABOUTME: Consolidated logging utility for chunk processing
// ABOUTME: Uses NDJSON format for safe concurrent appends

const fs = require('fs').promises;
const path = require('path');

/**
 * Log chunk processing data to consolidated NDJSON file
 * Each line is a complete JSON object for safe concurrent appends
 */
async function logChunkProcessing(runId, chunkIndex, totalChunks, paragraphs, llmResult) {
  try {
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '..', 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    // Create log entry
    const logEntry = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      chunkIndex,
      totalChunks,
      paragraphCount: Object.keys(paragraphs).length,
      highlightCount: llmResult.highlights ? llmResult.highlights.length : 0,
      // Only include full data in DEBUG mode
      ...(process.env.LOG_LEVEL === 'DEBUG' && {
        paragraphs,
        highlights: llmResult.highlights,
        rawResponse: llmResult.rawResponse
      })
    };

    // Append as single line (NDJSON format)
    const logLine = JSON.stringify(logEntry) + '\n';
    const logPath = path.join(logsDir, 'processing-log.ndjson');

    await fs.appendFile(logPath, logLine, 'utf8');
  } catch (error) {
    // Don't throw - logging failures shouldn't break the response
    console.error('Failed to write log:', error.message);
  }
}

module.exports = {
  logChunkProcessing
};