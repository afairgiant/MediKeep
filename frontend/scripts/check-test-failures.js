#!/usr/bin/env node

/**
 * Fails when a Vitest JSON report contains a failing test that is not listed
 * in known-test-failures.txt, so pre-existing failures do not hide new ones.
 *
 * Usage: node scripts/check-test-failures.js <vitest-json-report>
 *   Generate the report with: vitest run --reporter=json --outputFile=<path>
 */

const fs = require('fs');
const path = require('path');

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Usage: node scripts/check-test-failures.js <vitest-json-report>');
  process.exit(2);
}

const knownPath = path.join(__dirname, '..', 'known-test-failures.txt');
const known = new Set(
  fs
    .readFileSync(knownPath, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
);

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const cwd = process.cwd() + path.sep;
const failures = [];

for (const file of report.testResults) {
  const relative = file.name.startsWith(cwd) ? file.name.slice(cwd.length) : file.name;
  const fileFailed = file.status === 'failed' && file.assertionResults.length === 0;
  if (fileFailed) {
    failures.push(`${relative} :: (file failed to run: ${file.message || 'unknown error'})`);
  }
  for (const test of file.assertionResults) {
    if (test.status === 'failed') {
      failures.push(`${relative} :: ${test.fullName.trim()}`);
    }
  }
}

const unexpected = failures.filter(f => !known.has(f));
const fixed = [...known].filter(k => !failures.includes(k));

if (fixed.length > 0) {
  console.log('Known failures that passed this run (remove from known-test-failures.txt if fixed):');
  fixed.forEach(f => console.log(`  ${f}`));
}

if (unexpected.length > 0) {
  console.error(`\n${unexpected.length} unexpected test failure(s):`);
  unexpected.forEach(f => console.error(`  ${f}`));
  process.exit(1);
}

console.log(
  `OK: ${failures.length} failing test(s), all listed in known-test-failures.txt.`
);
