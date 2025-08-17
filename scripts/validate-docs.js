const fs = require('fs');
const path = require('path');

const required = [
  'README.md',
  'docs/ARCHITECTURE_OVERVIEW.md',
  'docs/AI_OVERVIEW.md',
  'docs/FEATURE_STATUS_MATRIX.md',
  'docs/DEVELOPMENT_ROADMAP_2025.md',
  'docs/CONTRIBUTING_AND_SETUP.md',
  'docs/TESTING_STRATEGY_OVERVIEW.md',
  'docs/UX_DESIGN_GUIDE.md',
  'docs/security-guide.md',
];

const root = process.cwd();
const missing = required.filter((p) => !fs.existsSync(path.join(root, p)));

if (missing.length > 0) {
  console.error('Docs validation failed. Missing files:');
  missing.forEach((m) => console.error(' - ' + m));
  process.exit(1);
}

function mustContain(file, tokens) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  return tokens.every((t) => content.includes(t));
}

const checks = [
  ['docs/AI_OVERVIEW.md', ['Gemini', 'Insights', 'Telemetry']],
  ['docs/UX_DESIGN_GUIDE.md', ['Master Prompt', 'FAB', 'Kategori']],
  ['docs/TESTING_STRATEGY_OVERVIEW.md', ['Telemetry', 'Offline-first']],
];

const failed = checks.filter(([file, tokens]) => !mustContain(file, tokens));
if (failed.length > 0) {
  console.error('Docs validation failed. Content checks missing tokens:');
  failed.forEach(([file]) => console.error(' - ' + file));
  process.exit(2);
}

console.log('Docs validation passed.');
