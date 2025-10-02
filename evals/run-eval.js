// ABOUTME: Eval runner that compares expected highlights against LLM output
// ABOUTME: Supports multiple modes (study/general) with dynamic category evaluation
//
// Usage:
//   node evals/run-eval.js --range=5-12 --mode=study
//   node evals/run-eval.js --range=5-12 --mode=general

const fs = require('fs');
const path = require('path');
const { processWithLLM } = require('../processors/llm-processor');
const { logChunkProcessing } = require('../utils/logger');
const { loadModeConfig } = require('../processors/config-loader');

/**
 * Normalize text by removing trailing punctuation and normalizing quotes for comparison
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizePunctuation(text) {
  return text
    .replace(/[\u201C\u201D]/g, '"')  // Normalize curly double quotes to straight
    .replace(/[\u2018\u2019]/g, "'")  // Normalize curly single quotes/apostrophes to straight
    .replace(/[.,!?;:]+$/g, '')  // Remove trailing punctuation
    .trim();
}

/**
 * Load paragraphs from raw-paragraphs.json
 * @param {Object} options - Filter options {start, end}
 * @returns {Object} Filtered paragraphs object
 */
function loadRawParagraphs(options = {}) {
  const { start, end } = options;
  const rawPath = path.join(__dirname, 'raw-paragraphs.json');

  if (!fs.existsSync(rawPath)) {
    throw new Error(`Raw paragraphs file not found: ${rawPath}\nRun capture first from the browser extension.`);
  }

  const allParagraphs = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

  // Filter by range if specified
  if (start !== undefined && end !== undefined) {
    const filtered = {};
    Object.keys(allParagraphs).forEach(paraId => {
      const paraNum = parseInt(paraId.replace('para_', ''));
      if (paraNum >= start && paraNum <= end) {
        filtered[paraId] = allParagraphs[paraId];
      }
    });
    return filtered;
  }

  return allParagraphs;
}

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
 * @param {Array} categories - Categories to evaluate (e.g., ['terms', 'concepts', 'examples'])
 * @param {Object} options - Optional range filter {start, end}
 * @returns {Object} Metrics by category and overall totals
 */
function calculateMetrics(goldStandard, llmOutput, categories, options = {}) {
  const { start, end } = options;

  // Build lookup map from LLM output
  const llmMap = {};
  llmOutput.forEach(chunk => {
    Object.keys(chunk.llm_output).forEach(paraId => {
      llmMap[paraId] = chunk.llm_output[paraId];
    });
  });

  // Initialize category tracking
  const categoryData = {};
  categories.forEach(cat => {
    categoryData[cat] = { found: [], missed: [], wrong: [] };
  });

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
    categories.forEach(category => {
      const expectedItems = (expected[category] || []).map(normalizePunctuation);
      const foundItems = (foundData?.[category] || []).map(normalizePunctuation);

      const expectedSet = new Set(expectedItems);
      const foundSet = new Set(foundItems);

      // Track found (correct matches)
      expectedSet.forEach(item => {
        if (foundSet.has(item)) {
          categoryData[category].found.push(item);
        } else {
          categoryData[category].missed.push(item);
        }
      });

      // Track wrong (found but not expected)
      foundSet.forEach(item => {
        if (!expectedSet.has(item)) {
          categoryData[category].wrong.push(item);
        }
      });
    });
  });

  // Calculate metrics per category
  const categoryMetrics = {};
  let totalExpected = 0;
  let totalCorrect = 0;

  categories.forEach(category => {
    const cat = categoryData[category];
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

  // Calculate character counts for over/under highlighting analysis
  const charCountsByCategory = {};
  categories.forEach(category => {
    const expectedChars = categoryData[category].found.concat(categoryData[category].missed)
      .join('').length;
    const llmChars = categoryData[category].found.concat(categoryData[category].wrong)
      .join('').length;

    charCountsByCategory[category] = {
      expected: expectedChars,
      llm: llmChars,
      diff: llmChars - expectedChars,
      percentDiff: expectedChars > 0
        ? Math.round(((llmChars - expectedChars) / expectedChars) * 10000) / 100
        : 0
    };
  });

  const totalExpectedChars = Object.values(charCountsByCategory).reduce((sum, cat) => sum + cat.expected, 0);
  const totalLlmChars = Object.values(charCountsByCategory).reduce((sum, cat) => sum + cat.llm, 0);

  return {
    categories: categoryMetrics,
    overall: {
      totalExpected,
      totalCorrect,
      accuracy: overallAccuracy
    },
    charCounts: {
      byCategory: charCountsByCategory,
      total: {
        expected: totalExpectedChars,
        llm: totalLlmChars,
        diff: totalLlmChars - totalExpectedChars,
        percentDiff: totalExpectedChars > 0
          ? Math.round(((totalLlmChars - totalExpectedChars) / totalExpectedChars) * 10000) / 100
          : 0
      }
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
  const modeArg = args.find(arg => arg.startsWith('--mode='));

  let range = null;
  if (rangeArg) {
    const [start, end] = rangeArg.replace('--range=', '').split('-').map(Number);
    range = { start, end };
  }

  const runId = runIdArg ? parseInt(runIdArg.replace('--run-id=', '')) : null;

  const expectedHighlightsPath = expectedHighlightsArg
    ? expectedHighlightsArg.replace('--expected=', '')
    : path.join(__dirname, 'expected-highlights.json');

  const mode = modeArg ? modeArg.replace('--mode=', '') : 'study';

  return { range, runId, expectedHighlightsPath, mode };
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
function displayResults(metrics, range, categories) {
  console.log('\n' + '='.repeat(60));
  console.log(colors.bold + 'EVALUATION RESULTS' + colors.reset);
  if (range) {
    console.log(`Range: paragraphs ${range.start}-${range.end}`);
  }
  console.log('='.repeat(60) + '\n');

  // Display each category
  categories.forEach(category => {
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
  categories.forEach(category => {
    const cat = metrics.categories[category];
    const displayName = category.charAt(0).toUpperCase() + category.slice(1);
    console.log(`  ${displayName}: ${cat.accuracy}% (${cat.correct}/${cat.expected})`);
  });
  console.log('');

  // Character count comparison
  console.log(colors.bold + 'HIGHLIGHT VOLUME' + colors.reset);
  console.log('----------------');

  categories.forEach(category => {
    const cat = metrics.charCounts.byCategory[category];
    const sign = cat.diff > 0 ? '+' : '';
    const percentSign = cat.percentDiff > 0 ? '+' : '';

    console.log(`${category.charAt(0).toUpperCase() + category.slice(1)}: ${cat.expected} → ${cat.llm} chars (${sign}${cat.diff}, ${percentSign}${cat.percentDiff}%)`);
  });

  console.log('');
  console.log(`Total: ${metrics.charCounts.total.expected} → ${metrics.charCounts.total.llm} chars (${metrics.charCounts.total.diff > 0 ? '+' : ''}${metrics.charCounts.total.diff}, ${metrics.charCounts.total.percentDiff > 0 ? '+' : ''}${metrics.charCounts.total.percentDiff}%)`);

  if (metrics.charCounts.total.percentDiff > 20) {
    console.log(colors.red + '⚠ Over-highlighting detected (>20% more than expected)' + colors.reset);
  } else if (metrics.charCounts.total.percentDiff < -20) {
    console.log(colors.red + '⚠ Under-highlighting detected (>20% less than expected)' + colors.reset);
  } else {
    console.log(colors.green + '✓ Highlighting volume within acceptable range' + colors.reset);
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Save results to file
 */
function saveResults(metrics, range, mode) {
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `run-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  const output = {
    timestamp: new Date().toISOString(),
    mode: mode,
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
  (async () => {
    try {
      const { range, runId, expectedHighlightsPath, mode } = parseArgs();

      // Load mode configuration
      const modeConfig = loadModeConfig(mode);
      const categories = modeConfig.categories;

      console.log('Loading data...');
      console.log(`  Mode: ${mode}`);
      console.log(`  Categories: ${categories.join(', ')}`);
      console.log(`  Expected highlights: ${expectedHighlightsPath}`);
      if (range) {
        console.log(`  Paragraph range: ${range.start}-${range.end}`);
      }

      // Load paragraphs from raw-paragraphs.json
      console.log('  Loading paragraphs from: evals/raw-paragraphs.json');
      const paragraphs = loadRawParagraphs({ start: range?.start, end: range?.end });
      const paraCount = Object.keys(paragraphs).length;

      if (paraCount === 0) {
        console.error('\n✗ No paragraphs found matching criteria');
        process.exit(1);
      }

      console.log(`  Loaded ${paraCount} paragraphs`);

      // Process through LLM
      console.log('\nProcessing paragraphs through LLM...');
      console.time('LLM Processing');

      const llmResult = await processWithLLM(paragraphs, mode);
      console.timeEnd('LLM Processing');

      // Generate new run_id for this eval
      const evalRunId = Date.now();

      // Log results
      if (process.env.LOG_LEVEL === 'DEBUG' || process.env.LOG_LEVEL === 'INFO') {
        await logChunkProcessing(evalRunId, 0, 1, paragraphs, llmResult);
        console.log(`  Logged as run_id: ${evalRunId}`);
      }

      // Convert to expected format for metrics - dynamically based on categories
      const chunks = [{
        chunk_id: 'eval_chunk',
        paragraphs: paragraphs,
        llm_output: llmResult.highlights.reduce((acc, h) => {
          acc[h.id] = {};
          categories.forEach(cat => {
            acc[h.id][cat] = h[cat] || [];
          });
          return acc;
        }, {})
      }];

      // Load expected highlights and calculate metrics
      const expectedHighlights = JSON.parse(fs.readFileSync(expectedHighlightsPath, 'utf-8'));
      console.log('\nCalculating metrics...');

      const metrics = calculateMetrics(expectedHighlights, chunks, categories, range);

      displayResults(metrics, range, categories);
      saveResults(metrics, range, mode);

    } catch (error) {
      console.error('Error running eval:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { calculateMetrics, extractFromLog };
