#!/usr/bin/env node

/**
 * 🔎 Feature Flag Audit Script
 * - Lists all flags defined in constants/featureFlags.ts
 * - Finds usages across the repo (FEATURE_FLAGS.isEnabled('<FLAG>') and store usage)
 * - Reports potentially unused flags and a usage summary
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FLAGS_FILE = path.join(ROOT, 'constants', 'featureFlags.ts');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function walk(dir, ignore = ['node_modules', '.git', 'ios/Pods', 'android/.gradle', 'android/build']) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (ignore.some(ig => e.name.includes(ig))) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full, ignore));
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) files.push(full);
  }
  return files;
}

function extractFlags(src) {
  // Grab object literal keys under featureFlagState
  const objectStart = src.indexOf('const featureFlagState');
  if (objectStart === -1) return [];
  const braceStart = src.indexOf('{', objectStart);
  const braceEnd = src.indexOf('};', braceStart);
  const objText = src.slice(braceStart + 1, braceEnd);
  const keys = [];
  const keyRegex = /\n\s*([A-Z0-9_]+)\s*:/g;
  let m;
  while ((m = keyRegex.exec(objText))) {
    keys.push(m[1]);
  }
  return keys;
}

function main() {
  const flagsSrc = readFileSafe(FLAGS_FILE);
  if (!flagsSrc) {
    console.error('❌ featureFlags.ts not found');
    process.exit(1);
  }

  const flags = extractFlags(flagsSrc);
  const files = walk(ROOT);

  const usage = {};
  for (const f of flags) usage[f] = { count: 0, files: new Set() };

  const patterns = flags.map(f => ({
    flag: f,
    // Match FEATURE_FLAGS.isEnabled('FLAG') or \"FLAG\" elsewhere
    regex: new RegExp(`FEATURE_FLAGS\\.isEnabled\\(\\s*['\"']${f}['\"']\\s*\)`, 'g')
  }));

  for (const file of files) {
    const content = readFileSafe(file);
    for (const p of patterns) {
      const matches = content.match(p.regex);
      if (matches && matches.length) {
        usage[p.flag].count += matches.length;
        usage[p.flag].files.add(path.relative(ROOT, file));
      }
    }
  }

  // Produce report
  const unused = [];
  const summary = [];
  for (const f of flags) {
    const count = usage[f].count;
    const filesArr = Array.from(usage[f].files);
    summary.push({ flag: f, count, files: filesArr });
    if (count === 0) unused.push(f);
  }

  console.log('\n🔎 Feature Flag Audit Report');
  console.log('===============================');
  console.log(`Total flags: ${flags.length}`);
  console.log(`Used flags:  ${flags.length - unused.length}`);
  console.log(`Unused flags: ${unused.length}`);

  if (unused.length) {
    console.log('\n⚠️ Potentially unused flags:');
    unused.forEach(f => console.log(` - ${f}`));
  } else {
    console.log('\n✅ No unused flags detected.');
  }

  console.log('\n📄 Usage details:');
  summary
    .sort((a, b) => a.flag.localeCompare(b.flag))
    .forEach(s => {
      console.log(` - ${s.flag}: ${s.count} uses`);
      if (s.files.length) {
        console.log(`   files: ${s.files.slice(0, 5).join(', ')}${s.files.length > 5 ? ' …' : ''}`);
      }
    });
}

main();


