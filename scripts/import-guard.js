#!/usr/bin/env node

/**
 * Import Guard System
 * 
 * KRITIK: Pre-commit hook sistemi - Import felaketlerini önler
 * Tehlikeli import pattern'lerini tespit eder ve commit'i engeller
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Yasaklı import pattern'leri
const FORBIDDEN_PATTERNS = [
  {
    pattern: /from ['"]\.\.\/\.\.\/src\//g,
    message: "YASAK: ../../src/ import'u kullanmayın. @/ alias kullanın.",
    severity: 'CRITICAL'
  },
  {
    pattern: /from ['"]src\//g,
    message: "YASAK: src/ import'u kullanmayın. Mevcut yapıya uygun import yapın.",
    severity: 'CRITICAL'
  },
  {
    pattern: /require\(['"]src\//g,
    message: "YASAK: require('src/') kullanmayın. @/ alias kullanın.",
    severity: 'CRITICAL'
  },
  {
    pattern: /import.*from ['"]\.\.\/\.\.\/\.\.\/src/g,
    message: "YASAK: Çok derin relative import. @/ alias kullanın.",
    severity: 'CRITICAL'
  },
  {
    pattern: /import.*from ['"].*\/src\//g,
    message: "UYARI: src/ referansı şüpheli. Kontrol edin.",
    severity: 'WARNING'
  }
];

// Kontrol edilecek dosya uzantıları
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Git'ten değişen dosyaları al
function getChangedFiles() {
  try {
    const gitDiff = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return gitDiff.split('\n').filter(file => 
      file && FILE_EXTENSIONS.some(ext => file.endsWith(ext))
    );
  } catch (error) {
    console.log('Git diff alınamadı, tüm dosyalar kontrol edilecek');
    return getAllRelevantFiles();
  }
}

// Tüm ilgili dosyaları al (fallback)
function getAllRelevantFiles() {
  const files = [];
  
  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // node_modules, .git gibi dizinleri atla
          if (!item.startsWith('.') && item !== 'node_modules' && item !== 'ios' && item !== 'android') {
            scanDirectory(fullPath);
          }
        } else if (FILE_EXTENSIONS.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Dizin okunamadı, devam et
    }
  }
  
  scanDirectory('.');
  return files;
}

// Dosyayı kontrol et
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];
    
    FORBIDDEN_PATTERNS.forEach(({ pattern, message, severity }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
          violations.push({
            file: filePath,
            line: lineNumber,
            pattern: match,
            message,
            severity
          });
        });
      }
    });
    
    return violations;
  } catch (error) {
    console.warn(`⚠️  Dosya okunamadı: ${filePath}`);
    return [];
  }
}

// Ana kontrol fonksiyonu
function main() {
  console.log('🛡️  Import Guard System - Başlatılıyor...\n');
  
  const filesToCheck = getChangedFiles();
  
  if (filesToCheck.length === 0) {
    console.log('✅ Kontrol edilecek dosya bulunamadı.');
    process.exit(0);
  }
  
  console.log(`📁 ${filesToCheck.length} dosya kontrol ediliyor...\n`);
  
  let criticalViolations = 0;
  let warningViolations = 0;
  
  filesToCheck.forEach(file => {
    const violations = checkFile(file);
    
    violations.forEach(violation => {
      const icon = violation.severity === 'CRITICAL' ? '🚨' : '⚠️';
      const color = violation.severity === 'CRITICAL' ? '\x1b[31m' : '\x1b[33m';
      const reset = '\x1b[0m';
      
      console.log(`${icon} ${color}${violation.severity}${reset}: ${violation.file}:${violation.line}`);
      console.log(`   Pattern: ${violation.pattern}`);
      console.log(`   Message: ${violation.message}`);
      console.log('');
      
      if (violation.severity === 'CRITICAL') {
        criticalViolations++;
      } else {
        warningViolations++;
      }
    });
  });
  
  // Sonuç raporu
  if (criticalViolations > 0) {
    console.log(`🚨 ${criticalViolations} KRİTİK import ihlali bulundu!`);
    console.log('💡 Düzeltme önerileri:');
    console.log('   - ../../src/ yerine @/ alias kullanın');
    console.log('   - src/ referanslarını kaldırın');
    console.log('   - Mevcut dizin yapısına uygun import yapın');
    console.log('\nCommit engellenmiştir. Lütfen önce hataları düzeltin.\n');
    process.exit(1);
  }
  
  if (warningViolations > 0) {
    console.log(`⚠️  ${warningViolations} uyarı bulundu. Kontrol etmeyi unutmayın.`);
  }
  
  console.log('✅ Import kontrolü başarılı. Commit devam edebilir.\n');
  process.exit(0);
}

// CLI mode kontrolü
if (require.main === module) {
  main();
}

module.exports = { checkFile, FORBIDDEN_PATTERNS }; 