#!/usr/bin/env node

/**
 * Fails when a Vitest JSON report contains a failing test that is not listed
 * in known-test-failures.txt, so pre-existing failures do not hide new ones.
 *
 * Usage: node scripts/check-test-failures.js <vitest-json-report>
 *          [--exit-code <vitest exit code>] [--log <vitest console output>]
 *   Generate the report with: vitest run --reporter=json --outputFile.json=<path>
 *
 * Vitest's exit code and console output are checked as well, because the JSON
 * report omits unhandled errors and cannot exist at all if vitest crashes. The
 * run fails if vitest exited nonzero without any failing test to explain it, or
 * if its output reports unhandled errors.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const reportPath = args[0];
const optionValue = name => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
if (!reportPath) {
  console.error(
    'Usage: node scripts/check-test-failures.js <vitest-json-report> [--exit-code <n>] [--log <file>]'
  );
  process.exit(2);
}
const exitCode = optionValue('--exit-code');
const logPath = optionValue('--log');

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
  // A file can fail without any failed assertion (import error, hook or teardown
  // failure), even when other assertions in it passed.
  const fileFailed =
    file.status === 'failed' &&
    !file.assertionResults.some(test => test.status === 'failed');
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
const problems = [];

if (exitCode !== undefined && !/^\d+$/.test(exitCode)) {
  problems.push(`vitest exit code is missing or invalid: "${exitCode}"`);
} else if (exitCode !== undefined && exitCode !== '0' && failures.length === 0) {
  problems.push(
    `vitest exited with code ${exitCode} but the report lists no failing test`
  );
}

if (logPath) {
  const log = fs.readFileSync(logPath, 'utf8');
  if (/Vitest caught \d+ unhandled errors? (during|between)/i.test(log)) {
    problems.push('vitest output reports unhandled errors');
  }
}
const fixed = [...known].filter(k => !failures.includes(k));

if (fixed.length > 0) {
  console.log('Known failures that passed this run (remove from known-test-failures.txt if fixed):');
  fixed.forEach(f => console.log(`  ${f}`));
}

if (problems.length > 0) {
  console.error('\nTest run problem(s) not explained by the JSON report:');
  problems.forEach(p => console.error(`  ${p}`));
}

if (unexpected.length > 0) {
  console.error(`\n${unexpected.length} unexpected test failure(s):`);
  unexpected.forEach(f => console.error(`  ${f}`));
}

if (unexpected.length > 0 || problems.length > 0) {
  process.exit(1);
}

console.log(
  `OK: ${failures.length} failing test(s), all listed in known-test-failures.txt.`
);
