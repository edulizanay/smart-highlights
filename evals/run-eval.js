// ABOUTME: Eval runner that compares expected highlights against LLM output
// ABOUTME: Reads directly from processing-log.ndjson and calculates accuracy metrics
//
// Usage: node evals/run-eval.js --run-id=1 --range=5-12
// Reads directly from logs/processing-log.ndjson

const fs = require('fs');
const path = require('path');

/**
 * Extract test case from NDJSON log file
 * @param {string} logFilePath - Path to NDJSON log file
 * @param {Object} options - Extraction options {runId, startPara, endPara}
 * @returns {object} Structured test case with chunks and LLM outputs
 */
function extractFromLog(logFilePath, options = {}) {
  const { runId, startPara, endPara } = options;

  const logContent = fs.readFileSync(logFilePath, 'utf-8');
  const lines = logContent.trim().split('\n');

  const chunks = [];
  let maxRunId = 0;

  // First pass: find max run_id if we need latest
  if (!runId) {
    for (const line of lines) {
      if (!line.trim()) continue;
      const logEntry = JSON.parse(line);
      if (logEntry.run_id > maxRunId) {
        maxRunId = logEntry.run_id;
      }
    }
  }

  const targetRunId = runId || maxRunId;

  for (const line of lines) {
    if (!line.trim()) continue;

    const logEntry = JSON.parse(line);

    // Filter by run_id
    if (logEntry.run_id !== targetRunId) continue;

    const chunkIndex = logEntry.chunkIndex;
    const paragraphs = logEntry.paragraphs || {};
    const highlights = logEntry.highlights || [];

    // Filter paragraphs by range if specified
    let filteredParagraphs = paragraphs;
    if (startPara !== undefined && endPara !== undefined) {
      filteredParagraphs = {};
      for (const paraId in paragraphs) {
        const paraNum = parseInt(paraId.replace('para_', ''));
        if (paraNum >= startPara && paraNum <= endPara) {
          filteredParagraphs[paraId] = paragraphs[paraId];
        }
      }

      // Skip chunk if no paragraphs in range
      if (Object.keys(filteredParagraphs).length === 0) continue;
    }

    // Transform highlights array into organized structure by paragraph ID
    const llmOutput = {};

    // Initialize all paragraphs with empty arrays
    for (const paraId in filteredParagraphs) {
      llmOutput[paraId] = {
        terms: [],
        concepts: [],
        examples: []
      };
    }

    // Populate highlights from LLM response
    for (const highlight of highlights) {
      const paraId = highlight.id;
      if (llmOutput[paraId]) {
        llmOutput[paraId].terms = highlight.terms || [];
        llmOutput[paraId].concepts = highlight.concepts || [];
        llmOutput[paraId].examples = highlight.examples || [];
      }
    }

    chunks.push({
      chunk_id: `chunk_${chunkIndex}`,
      paragraphs: filteredParagraphs,
      llm_output: llmOutput
    });
  }

  return {
    name: `Article Test - Run ${targetRunId}`,
    chunks: chunks
  };
}

/**
 * Calculate evaluation metrics by comparing expected vs found highlights
 * @param {Object} goldStandard - Expected highlights by paragraph
 * @param {Array} llmOutput - Actual LLM output chunks
 * @param {Object} options - Optional range filter {start, end}
 * @returns {Object} Metrics by category and overall totals
 */
function calculateMetrics(goldStandard, llmOutput, options = {}) {
  const { start, end } = options;

  // Build lookup map from LLM output
  const llmMap = {};
  llmOutput.forEach(chunk => {
    Object.keys(chunk.llm_output).forEach(paraId => {
      llmMap[paraId] = chunk.llm_output[paraId];
    });
  });

  // Initialize category tracking
  const categories = {
    terms: { found: [], missed: [], wrong: [] },
    concepts: { found: [], missed: [], wrong: [] },
    examples: { found: [], missed: [], wrong: [] }
  };

  // Get paragraphs to evaluate
  const paragraphIds = Object.keys(goldStandard.paragraphs);
  const filteredParaIds = paragraphIds.filter(paraId => {
    if (!start || !end) return true;
    const paraNum = parseInt(paraId.replace('para_', ''));
    return paraNum >= start && paraNum <= end;
  });

  // Compare each paragraph
  filteredParaIds.forEach(paraId => {
    const expected = goldStandard.paragraphs[paraId]?.expected;
    const foundData = llmMap[paraId];

    if (!expected) return; // Skip if no gold standard for this paragraph

    // Process each category
    ['terms', 'concepts', 'examples'].forEach(category => {
      const expectedSet = new Set(expected[category] || []);
      const foundSet = new Set(foundData?.[category] || []);

      // Track found (correct matches)
      expectedSet.forEach(item => {
        if (foundSet.has(item)) {
          categories[category].found.push(item);
        } else {
          categories[category].missed.push(item);
        }
      });

      // Track wrong (found but not expected)
      foundSet.forEach(item => {
        if (!expectedSet.has(item)) {
          categories[category].wrong.push(item);
        }
      });
    });
  });

  // Calculate metrics per category
  const categoryMetrics = {};
  let totalExpected = 0;
  let totalCorrect = 0;

  ['terms', 'concepts', 'examples'].forEach(category => {
    const cat = categories[category];
    const expected = cat.found.length + cat.missed.length;
    const correct = cat.found.length;
    const accuracy = expected > 0
      ? Math.round((correct / expected) * 10000) / 100
      : 0;

    categoryMetrics[category] = {
      expected,
      correct,
      accuracy,
      found: cat.found,
      missed: cat.missed,
      wrong: cat.wrong
    };

    totalExpected += expected;
    totalCorrect += correct;
  });

  // Calculate overall metrics
  const overallAccuracy = totalExpected > 0
    ? Math.round((totalCorrect / totalExpected) * 10000) / 100
    : 0;

  return {
    categories: categoryMetrics,
    overall: {
      totalExpected,
      totalCorrect,
      accuracy: overallAccuracy
    }
  };
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const rangeArg = args.find(arg => arg.startsWith('--range='));
  const runIdArg = args.find(arg => arg.startsWith('--run-id='));
  const expectedHighlightsArg = args.find(arg => arg.startsWith('--expected='));

  let range = null;
  if (rangeArg) {
    const [start, end] = rangeArg.replace('--range=', '').split('-').map(Number);
    range = { start, end };
  }

  const runId = runIdArg ? parseInt(runIdArg.replace('--run-id=', '')) : null;

  const expectedHighlightsPath = expectedHighlightsArg
    ? expectedHighlightsArg.replace('--expected=', '')
    : path.join(__dirname, 'expected-highlights.json');

  return { range, runId, expectedHighlightsPath };
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

/**
 * Display results in terminal with category breakdown
 */
function displayResults(metrics, range) {
  console.log('\n' + '='.repeat(60));
  console.log(colors.bold + 'EVALUATION RESULTS' + colors.reset);
  if (range) {
    console.log(`Range: paragraphs ${range.start}-${range.end}`);
  }
  console.log('='.repeat(60) + '\n');

  // Display each category
  ['terms', 'concepts', 'examples'].forEach(category => {
    const cat = metrics.categories[category];

    console.log(colors.bold + category.toUpperCase() + colors.reset);
    console.log('-----');
    console.log(`Accuracy: ${cat.accuracy}% (${cat.correct}/${cat.expected} correct)\n`);

    if (cat.found.length > 0) {
      console.log(`Expected (${cat.expected}):`);
      cat.found.forEach(item => {
        console.log(`  ${colors.green}✓${colors.reset} "${item}"`);
      });
      console.log();
    }

    if (cat.missed.length > 0) {
      console.log(`Missed (${cat.missed.length}):`);
      cat.missed.forEach(item => {
        console.log(`  ${colors.red}✗${colors.reset} "${item}"`);
      });
      console.log();
    }

    if (cat.wrong.length > 0) {
      console.log(`Wrong (${cat.wrong.length}):`);
      cat.wrong.forEach(item => {
        console.log(`  ${colors.red}✗${colors.reset} "${item}"`);
      });
      console.log();
    }

    console.log('='.repeat(60) + '\n');
  });

  // Overall summary
  console.log(colors.bold + 'OVERALL SUMMARY' + colors.reset);
  console.log('---------------');
  console.log(`Total Accuracy: ${metrics.overall.accuracy}% (${metrics.overall.totalCorrect}/${metrics.overall.totalExpected} correct)`);
  console.log('  Terms: ' + metrics.categories.terms.accuracy + '%' + ` (${metrics.categories.terms.correct}/${metrics.categories.terms.expected})`);
  console.log('  Concepts: ' + metrics.categories.concepts.accuracy + '%' + ` (${metrics.categories.concepts.correct}/${metrics.categories.concepts.expected})`);
  console.log('  Examples: ' + metrics.categories.examples.accuracy + '%' + ` (${metrics.categories.examples.correct}/${metrics.categories.examples.expected})`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Save results to file
 */
function saveResults(metrics, range) {
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `run-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  const output = {
    timestamp: new Date().toISOString(),
    range: range || 'all',
    metrics
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  console.log(`Results saved to: ${filepath}`);
}

/**
 * Main execution when run directly
 */
if (require.main === module) {
  try {
    const { range, runId, expectedHighlightsPath } = parseArgs();

    console.log('Loading data...');
    console.log(`  Expected highlights: ${expectedHighlightsPath}`);
    console.log(`  Run ID: ${runId || 'latest'}`);
    if (range) {
      console.log(`  Paragraph range: ${range.start}-${range.end}`);
    }

    // Load expected highlights
    const expectedHighlights = JSON.parse(fs.readFileSync(expectedHighlightsPath, 'utf-8'));

    // Extract from NDJSON log
    const logPath = path.join(__dirname, '..', 'logs', 'processing-log.ndjson');
    console.log(`  Extracting from: ${logPath}`);

    const extracted = extractFromLog(logPath, {
      runId,
      startPara: range?.start,
      endPara: range?.end
    });

    if (extracted.chunks.length === 0) {
      console.error('\n✗ No data found matching criteria');
      process.exit(1);
    }

    console.log(`  Found ${extracted.chunks.length} chunks`);
    console.log('\nCalculating metrics...');

    const metrics = calculateMetrics(expectedHighlights, extracted.chunks, range);

    displayResults(metrics, range);
    saveResults(metrics, range);

  } catch (error) {
    console.error('Error running eval:', error.message);
    process.exit(1);
  }
}

module.exports = { calculateMetrics, extractFromLog };
