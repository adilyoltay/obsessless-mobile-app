const fs = require('fs');
const path = require('path');
const glob = require('glob');

const repoRoot = path.resolve(__dirname, '..');
const flagsFile = path.join(repoRoot, 'constants', 'featureFlags.ts');

const source = fs.readFileSync(flagsFile, 'utf8');
const start = source.indexOf('const featureFlagState');
const end = source.indexOf('};', start);
const flagSection = source.slice(start, end);
const flagRegex = /^\s+([A-Z0-9_]+):/gm;
const flags = [];
let match;
while ((match = flagRegex.exec(flagSection)) !== null) {
  const name = match[1];
  flags.push(name);
}

const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
  cwd: repoRoot,
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'scripts/flag-audit.js',
    'constants/featureFlags.ts'
  ]
});

const unused = [];

for (const flag of flags) {
  let used = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    if (content.includes(flag)) {
      used = true;
      break;
    }
  }
  if (!used) {
    unused.push(flag);
  }
}

if (unused.length > 0) {
  console.log('Unused feature flags:');
  for (const flag of unused) {
    console.log(`- ${flag}`);
  }
} else {
  console.log('All feature flags are in use.');
}
