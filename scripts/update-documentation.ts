#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

const deprecatedFeatures = [
  { name: 'Crisis Detection', marker: 'Crisis Detection' },
  { name: 'AI Chat', marker: 'AI Chat' },
];

async function getAllMarkdownFiles(dir: string): Promise<string[]> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await getAllMarkdownFiles(p)));
    else if (e.isFile() && p.endsWith('.md')) files.push(p);
  }
  return files;
}

function markDeprecated(content: string, feature: string): string {
  const re = new RegExp(`(${feature})`, 'g');
  return content.replace(re, '~~$1~~ *(Kaldırıldı - v3.0)*');
}

async function main() {
  const docsPath = path.join(__dirname, '..', 'docs');
  const files = await getAllMarkdownFiles(docsPath);
  let updatedCount = 0;
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let updated = false;
    for (const feat of deprecatedFeatures) {
      if (content.includes(feat.marker)) {
        const newContent = markDeprecated(content, feat.marker);
        if (newContent !== content) {
          // backup
          fs.writeFileSync(file + '.backup', content);
          fs.writeFileSync(file, newContent);
          updated = true;
          updatedCount++;
          content = newContent;
        }
      }
    }
    if (updated) console.log(`✅ Updated: ${file}`);
  }
  console.log(`📊 Docs updated: ${updatedCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


