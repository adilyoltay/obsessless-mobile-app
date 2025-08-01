#!/usr/bin/env node

/**
 * Import Guard Script
 * 
 * Bu script, tehlikeli import pattern'lerini tespit eder ve commit'i engeller
 * Pre-commit hook olarak çalıştırılmalıdır
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Tehlikeli import pattern'leri
const FORBIDDEN_PATTERNS = [
  /from\s+['"]\.\.\/\.\.\/src\//,     // ../../src imports
  /from\s+['"]src\//,                  // src/ imports
  /require\s*\(\s*['"]src\//,          // require('src/')
  /import\s+.*\s+from\s+['"]src\//,    // import from 'src/'
];

// Kontrol edilecek dosya uzantıları
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Hataları sakla
const errors = [];

// Proje kök dizini
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Dosyaları tara
function scanFiles() {
  const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
    cwd: PROJECT_ROOT,
    ignore: [
      'node_modules/**',
      'ios/**',
      'android/**',
      '.expo/**',
      'scripts/**',
      'dist/**',
      'build/**'
    ]
  });

  files.forEach(file => {
    checkFile(path.join(PROJECT_ROOT, file));
  });
}

// Tek bir dosyayı kontrol et
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    FORBIDDEN_PATTERNS.forEach(pattern => {
      if (pattern.test(line)) {
        errors.push({
          file: path.relative(PROJECT_ROOT, filePath),
          line: index + 1,
          content: line.trim(),
          pattern: pattern.toString()
        });
      }
    });
  });
}

// Ana fonksiyon
function main() {
  console.log('🔍 Import Guard: Checking for dangerous import patterns...\n');
  
  scanFiles();
  
  if (errors.length > 0) {
    console.error('❌ DANGEROUS IMPORTS DETECTED!\n');
    console.error('The following files contain forbidden import patterns:\n');
    
    errors.forEach(error => {
      console.error(`📁 ${error.file}:${error.line}`);
      console.error(`   ${error.content}`);
      console.error(`   Pattern: ${error.pattern}\n`);
    });
    
    console.error('🚫 COMMIT BLOCKED!');
    console.error('\n✅ To fix this:');
    console.error('1. Replace src/ imports with @/ alias');
    console.error('2. Use proper import paths from project root');
    console.error('3. Never create or import from src/ directory\n');
    
    process.exit(1);
  }
  
  console.log('✅ Import Guard: All imports are safe!\n');
}

// Script'i çalıştır
main(); 