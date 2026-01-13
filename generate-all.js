#!/usr/bin/env node
/**
 * Generate all test fixtures
 *
 * Automatically discovers and runs all example generator scripts in the examples/ directory
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Discover all example generator files in the examples/ directory
 */
async function discoverExamples() {
  const examplesDir = join(__dirname, 'examples');
  const files = await readdir(examplesDir);

  const exampleFiles = files
    .filter(file => file.endsWith('.ts'))
    .sort();

  return exampleFiles;
}

/**
 * Load generator function from an example file
 */
async function loadGenerator(filename) {
  const modulePath = `./examples/${filename}`;
  const module = await import(modulePath);

  // Find the exported generator function (should start with 'generate')
  const generatorName = Object.keys(module).find(key => key.startsWith('generate'));

  if (!generatorName) {
    throw new Error(`No generator function found in ${filename}`);
  }

  return {
    fn: module[generatorName],
    name: generatorName,
    filename
  };
}

/**
 * Format a generator name for display
 */
function formatName(generatorName) {
  // Convert generateMetricBasic -> Metric (Basic)
  // Convert generateXYChartStackedBar -> XY Chart (Stacked Bar)
  // Convert generatePieChartNestedLegend -> Pie Chart (Nested Legend)
  return generatorName
    .replace(/^generate/, '')
    // Insert space before uppercase letters that follow lowercase letters
    // This keeps consecutive capitals together (XY stays as XY, not X Y)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^([^(]+?)(\s.+)?$/, (_, first, rest) => {
      // Split into main type and variant
      // e.g., "XY Chart Stacked Bar" -> "XY Chart (Stacked Bar)"
      if (rest) {
        return `${first} (${rest.trim()})`;
      }
      return first;
    });
}

async function generateAll() {
  console.log('Generating all test fixtures...\n');
  console.log('Discovering example generators...');

  const exampleFiles = await discoverExamples();
  console.log(`Found ${exampleFiles.length} example files\n`);

  const failures = [];
  let successCount = 0;

  for (const filename of exampleFiles) {
    try {
      const { fn, name } = await loadGenerator(filename);
      const displayName = formatName(name);

      await fn();

      console.log(`✓ Generated ${displayName}`);
      successCount++;
    } catch (err) {
      console.error(`✗ Failed to generate ${filename}:`, err.message);
      failures.push({ filename, error: err.message });
    }
  }

  const kibanaVersion = process.env.KIBANA_VERSION || 'v9.2.0';
  console.log(`\nOutput directory: ./output/${kibanaVersion}/`);

  if (failures.length > 0) {
    console.log(`\n⚠ ${failures.length} fixture(s) failed to generate:`);
    for (const { filename, error } of failures) {
      console.log(`  - ${filename}: ${error}`);
    }
  }

  if (successCount === 0) {
    console.error('\n✗ All fixtures failed to generate');
    process.exit(1);
  } else if (failures.length > 0) {
    console.log(`\n✓ Generated ${successCount}/${exampleFiles.length} fixtures successfully`);
  } else {
    console.log(`\n✓ All ${successCount} fixtures generated successfully`);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  generateAll()
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export { generateAll };
