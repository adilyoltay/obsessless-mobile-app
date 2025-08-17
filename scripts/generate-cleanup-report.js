/* eslint-env node */
// #!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/* global __dirname */
const outDir = process.argv[2] || path.join(__dirname, '.deprecations');

function readLines(p) {
  try {
    return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const crisis = readLines(path.join(outDir, 'deprecated-crisis.txt'));
  const chat = readLines(path.join(outDir, 'deprecated-chat.txt'));
  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      crisis: crisis.length,
      chat: chat.length,
    },
    nextActions: [
      'Tag safe removals (import/type/enum) and create PR edits',
      'Flag critical references for manual review',
      'Update docs with deprecation marks',
    ],
  };
  const out = path.join(outDir, 'cleanup-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`✅ Cleanup report written: ${out}`);
}

main();


