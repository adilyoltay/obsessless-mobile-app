#!/usr/bin/env node
/**
 * 🔒 Telemetry Audit Script
 * 
 * Audits trackAIInteraction calls to identify:
 * - Calls using old unsafe pattern (no flag check)
 * - Calls using new safe pattern (with flag wrapper)
 * - Overall progress on privacy compliance
 */

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function findFiles(dir, extensions = ['.ts', '.tsx']) {
  let files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files = files.concat(findFiles(fullPath, extensions));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip inaccessible directories
  }
  
  return files;
}

function auditFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const results = {
      unsafeCalls: 0,
      safeCalls: 0,
      flagChecks: 0,
      details: []
    };
    
    // Count different patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // Check for trackAIInteraction calls
      if (line.includes('trackAIInteraction(')) {
        // Check if it's using safe wrapper
        const context = lines.slice(Math.max(0, i - 3), i + 2).join('\n');
        
        if (context.includes('safeTrackAIInteraction')) {
          results.safeCalls++;
          results.details.push({
            type: 'safe',
            line: lineNumber,
            text: line.trim()
          });
        } else {
          results.unsafeCalls++;
          results.details.push({
            type: 'unsafe',
            line: lineNumber,
            text: line.trim()
          });
        }
      }
      
      // Check for feature flag checks
      if (line.includes('AI_TELEMETRY') && line.includes('isEnabled')) {
        results.flagChecks++;
        results.details.push({
          type: 'flag_check',
          line: lineNumber,
          text: line.trim()
        });
      }
    }
    
    return results;
  } catch (error) {
    return null;
  }
}

function main() {
  console.log(colorize('\n🔒 TELEMETRY PRIVACY AUDIT', 'cyan'));
  console.log(colorize('==============================', 'cyan'));
  
  const rootDir = process.cwd();
  const files = findFiles(rootDir);
  
  const summary = {
    totalFiles: 0,
    filesWithTelemetry: 0,
    totalUnsafeCalls: 0,
    totalSafeCalls: 0,
    totalFlagChecks: 0,
    problematicFiles: []
  };
  
  console.log(colorize(`\n📁 Scanning ${files.length} TypeScript files...`, 'yellow'));
  
  for (const file of files) {
    const result = auditFile(file);
    if (!result) continue;
    
    summary.totalFiles++;
    
    const totalCalls = result.unsafeCalls + result.safeCalls;
    if (totalCalls > 0) {
      summary.filesWithTelemetry++;
      summary.totalUnsafeCalls += result.unsafeCalls;
      summary.totalSafeCalls += result.safeCalls;
      summary.totalFlagChecks += result.flagChecks;
      
      const relativePath = path.relative(rootDir, file);
      
      if (result.unsafeCalls > 0) {
        summary.problematicFiles.push({
          file: relativePath,
          unsafeCalls: result.unsafeCalls,
          safeCalls: result.safeCalls,
          flagChecks: result.flagChecks,
          details: result.details
        });
      }
      
      // Show progress for files with many calls
      if (totalCalls > 3) {
        const status = result.unsafeCalls === 0 ? 
          colorize('✅ SAFE', 'green') : 
          colorize(`⚠️ ${result.unsafeCalls} UNSAFE`, 'red');
        console.log(`  ${relativePath}: ${totalCalls} calls ${status}`);
      }
    }
  }
  
  // Summary Report
  console.log(colorize('\n📊 AUDIT RESULTS', 'magenta'));
  console.log(colorize('=================', 'magenta'));
  
  const totalCalls = summary.totalUnsafeCalls + summary.totalSafeCalls;
  const safetyPercentage = totalCalls > 0 ? Math.round((summary.totalSafeCalls / totalCalls) * 100) : 0;
  
  console.log(`📁 Files scanned: ${summary.totalFiles}`);
  console.log(`🔍 Files with telemetry: ${summary.filesWithTelemetry}`);
  console.log(`📞 Total telemetry calls: ${totalCalls}`);
  console.log(`${colorize('✅ Safe calls:', 'green')} ${summary.totalSafeCalls}`);
  console.log(`${colorize('⚠️ Unsafe calls:', 'red')} ${summary.totalUnsafeCalls}`);
  console.log(`🔒 Flag checks found: ${summary.totalFlagChecks}`);
  console.log(`📈 Safety percentage: ${colorize(safetyPercentage + '%', safetyPercentage > 80 ? 'green' : safetyPercentage > 50 ? 'yellow' : 'red')}`);
  
  // Detailed problematic files
  if (summary.problematicFiles.length > 0) {
    console.log(colorize('\n🚨 FILES NEEDING ATTENTION', 'red'));
    console.log(colorize('============================', 'red'));
    
    summary.problematicFiles
      .sort((a, b) => b.unsafeCalls - a.unsafeCalls)
      .slice(0, 10) // Top 10 problematic files
      .forEach(fileInfo => {
        console.log(colorize(`\n📄 ${fileInfo.file}`, 'yellow'));
        console.log(`   ${colorize('⚠️ Unsafe calls:', 'red')} ${fileInfo.unsafeCalls}`);
        console.log(`   ${colorize('✅ Safe calls:', 'green')} ${fileInfo.safeCalls}`);
        console.log(`   ${colorize('🔒 Flag checks:', 'blue')} ${fileInfo.flagChecks}`);
        
        // Show first few unsafe calls
        const unsafeDetails = fileInfo.details.filter(d => d.type === 'unsafe').slice(0, 3);
        unsafeDetails.forEach(detail => {
          console.log(`   ${colorize(`Line ${detail.line}:`, 'red')} ${detail.text.substring(0, 80)}...`);
        });
      });
  }
  
  // Recommendations
  console.log(colorize('\n💡 RECOMMENDATIONS', 'cyan'));
  console.log(colorize('==================', 'cyan'));
  
  if (summary.totalUnsafeCalls > 0) {
    console.log('1. Replace trackAIInteraction with safeTrackAIInteraction');
    console.log('2. Import from @/features/ai/telemetry/telemetryHelpers');
    console.log('3. Consider batch operations for multiple calls');
  }
  
  if (safetyPercentage < 90) {
    console.log('4. Add feature flag checks before expensive telemetry operations');
    console.log('5. Use conditionalTrackAIInteraction for complex logic');
  }
  
  if (safetyPercentage >= 90) {
    console.log(colorize('🎉 Great job! Privacy compliance is looking good!', 'green'));
  }
  
  console.log(colorize('\n🔗 Next steps:', 'white'));
  console.log('- Run this script after each fix to track progress');
  console.log('- Focus on high-usage files first');
  console.log('- Test with AI_TELEMETRY disabled to verify no data leaks');
  
  console.log('');
  
  // Exit code based on results
  process.exit(summary.totalUnsafeCalls > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}
