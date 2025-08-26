#!/usr/bin/env node
/**
 * 🎗️ Quality Ribbon Test Results Collector
 * 
 * Collects and analyzes Jest test results for Quality Ribbon system.
 * Generates JSON/MD reports and console summaries.
 * 
 * Usage:
 *   node scripts/collect-quality-ribbon-results.js [--verbose]
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  reportsDir: path.join(process.cwd(), 'test-reports'),
  jestOutputFile: path.join(process.cwd(), 'jest-results.json'), // Fallback for backward compatibility
  jestFilesPattern: path.join(process.cwd(), 'test-reports', 'jest-*.json'),
  qualityRibbonOutputJson: path.join(process.cwd(), 'test-reports', 'quality-ribbon-report.json'),
  qualityRibbonOutputMd: path.join(process.cwd(), 'test-reports', 'quality-ribbon-report.md'),
  verbose: process.argv.includes('--verbose')
};

// Ensure reports directory exists
if (!fs.existsSync(CONFIG.reportsDir)) {
  fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
}

// ============================================================================
// TEST RESULT PARSING
// ============================================================================

/**
 * Parse Jest results from multiple files and merge them
 */
function parseJestResults() {
  try {
    const glob = require('glob');
    let jestFiles = glob.sync(CONFIG.jestFilesPattern);
    
    // Fallback to single file if no multi-files found
    if (jestFiles.length === 0 && fs.existsSync(CONFIG.jestOutputFile)) {
      jestFiles = [CONFIG.jestOutputFile];
    }
    
    if (jestFiles.length === 0) {
      console.warn('⚠️  No Jest results files found. Run tests first with --outputFile flag');
      return null;
    }

    // Initialize merged results
    let mergedResults = {
      numFailedTestSuites: 0,
      numFailedTests: 0,
      numPassedTestSuites: 0,
      numPassedTests: 0,
      numPendingTestSuites: 0,
      numPendingTests: 0,
      numRuntimeErrorTestSuites: 0,
      numTodoTests: 0,
      numTotalTestSuites: 0,
      numTotalTests: 0,
      testResults: [],
      success: true,
      startTime: Date.now()
    };

    console.log(`📊 Merging ${jestFiles.length} Jest result files: ${jestFiles.map(f => path.basename(f)).join(', ')}`);

    // Merge all Jest result files
    jestFiles.forEach(file => {
      const rawResults = fs.readFileSync(file, 'utf8');
      const results = JSON.parse(rawResults);
      
      // Merge summary stats
      mergedResults.numFailedTestSuites += results.numFailedTestSuites || 0;
      mergedResults.numFailedTests += results.numFailedTests || 0;
      mergedResults.numPassedTestSuites += results.numPassedTestSuites || 0;
      mergedResults.numPassedTests += results.numPassedTests || 0;
      mergedResults.numPendingTestSuites += results.numPendingTestSuites || 0;
      mergedResults.numPendingTests += results.numPendingTests || 0;
      mergedResults.numRuntimeErrorTestSuites += results.numRuntimeErrorTestSuites || 0;
      mergedResults.numTodoTests += results.numTodoTests || 0;
      mergedResults.numTotalTestSuites += results.numTotalTestSuites || 0;
      mergedResults.numTotalTests += results.numTotalTests || 0;
      
      // Merge test results
      if (results.testResults) {
        mergedResults.testResults.push(...results.testResults);
      }
      
      // Update success status
      mergedResults.success = mergedResults.success && (results.success !== false);
      
      // Update earliest start time
      if (results.startTime && results.startTime < mergedResults.startTime) {
        mergedResults.startTime = results.startTime;
      }
    });
    
    if (CONFIG.verbose) {
      console.log('📊 Merged Jest results:', {
        totalTestSuites: mergedResults.numTotalTestSuites,
        totalTests: mergedResults.numTotalTests,
        passedTests: mergedResults.numPassedTests,
        failedTests: mergedResults.numFailedTests,
        fileCount: jestFiles.length
      });
    }
    
    return mergedResults;
  } catch (error) {
    console.error('❌ Failed to parse Jest results:', error.message);
    return null;
  }
}

/**
 * Filter and categorize Quality Ribbon tests
 */
function categorizeQualityRibbonTests(jestResults) {
  if (!jestResults || !jestResults.testResults) {
    return null;
  }

  const categories = {
    today: { fresh: [], cache: [], hidden: [], total: 0 },
    mood: { high: [], medium: [], low: [], cache: [], hidden: [], total: 0 },
    tracking: { fresh: [], cache: [], hidden: [], total: 0 },
    smoke: { e2e_today: [], e2e_mood: [], e2e_voice: [], total: 0 },
    // System-mode (QRsys) categories
    system_today: { fresh: [], cache: [], invalidate: [], total: 0 },
    system_mood: { cache: [], hidden: [], total: 0 },
    system_tracking: { fresh: [], cache: [], hidden: [], total: 0 },
    system_voice: { fallback: [], total: 0 },
    // Live (QRlive) categories
    system_live_today: { fresh: [], cache: [], invalidate: [], total: 0 },
    system_live_mood: { cache: [], hidden: [], total: 0 },
    system_live_tracking: { fresh: [], cache: [], hidden: [], total: 0 },
    system_live_voice: { fallback: [], total: 0 },
    unit: { component: [], mapping: [], total: 0 }
  };

  let totalQRTests = 0;
  let passedQRTests = 0;
  let failedQRTests = 0;

  jestResults.testResults.forEach(testFile => {
    const filePath = testFile.testFilePath || testFile.name || '';
    
    // Skip non-Quality Ribbon related tests unless they have QR tags
    const isQRTest = filePath.includes('QualityRibbon') || 
                    filePath.includes('TodayPage') || 
                    filePath.includes('MoodPage') ||
                    filePath.includes('TrackingQualityRibbon') ||
                    filePath.includes('CBTQualityRibbon') ||
                    filePath.includes('OCDQualityRibbon') ||
                    testFile.assertionResults.some(test => 
                      test.fullName.includes('[QR:') || test.fullName.includes('[QRsys:') ||
                      test.fullName.toLowerCase().includes('quality ribbon') ||
                      test.fullName.toLowerCase().includes('fresh') ||
                      test.fullName.toLowerCase().includes('cache')
                    );
    
    if (!isQRTest) return;

    testFile.assertionResults.forEach(test => {
      totalQRTests++;
      
      const testInfo = {
        name: test.title,
        fullName: test.fullName,
        status: test.status,
        duration: test.duration,
        failureMessages: test.failureMessages || [],
        file: path.basename(filePath)
      };
      const testName = (test.fullName || '').toLowerCase();

      if (test.status === 'passed') {
        passedQRTests++;
      } else {
        failedQRTests++;
      }

      // Categorize based on QR tags first, then fallback to names and file paths
      const testFullName = test.fullName;
      let categorized = false;
      
      // Tag-based categorization (highest priority)
      if (testFullName.includes('[QR:') || testFullName.includes('[QRsys:') || testFullName.includes('[QRlive:')) {
        const tagMatch = testFullName.match(/\[QR:([^:]+):([^\]]+)\]/);
        const sysTagMatch = testFullName.match(/\[QRsys:([^:]+):([^\]]+)\]/);
        const liveTagMatch = testFullName.match(/\[QRlive:([^:]+):([^\]]+)\]/);
        if (sysTagMatch) {
          const [, sysCategory, sysSub] = sysTagMatch;
          categorized = true;
          if (sysCategory === 'today') {
            categories.system_today.total++;
            if (sysSub === 'fresh') categories.system_today.fresh.push(testInfo);
            else if (sysSub === 'cache') categories.system_today.cache.push(testInfo);
            else if (sysSub === 'invalidate') categories.system_today.invalidate.push(testInfo);
          } else if (sysCategory === 'mood') {
            categories.system_mood.total++;
            if (sysSub === 'cache') categories.system_mood.cache.push(testInfo);
            else if (sysSub === 'hidden') categories.system_mood.hidden.push(testInfo);
          } else if (sysCategory === 'tracking') {
            categories.system_tracking.total++;
            if (sysSub === 'fresh') categories.system_tracking.fresh.push(testInfo);
            else if (sysSub === 'cache') categories.system_tracking.cache.push(testInfo);
            else if (sysSub === 'hidden') categories.system_tracking.hidden.push(testInfo);
          } else if (sysCategory === 'cbt' || sysCategory === 'ocd') {
            // removed categories
          } else if (sysCategory === 'voice') {
            categories.system_voice.total++;
            if (sysSub === 'fallback') categories.system_voice.fallback.push(testInfo);
          }
        } else if (liveTagMatch) {
          const [, liveCategory, liveSub] = liveTagMatch;
          categorized = true;
          if (liveCategory === 'today') { categories.system_live_today.total++; if (liveSub==='fresh') categories.system_live_today.fresh.push(testInfo); else if (liveSub==='cache') categories.system_live_today.cache.push(testInfo); else if (liveSub==='invalidate') categories.system_live_today.invalidate.push(testInfo); }
          else if (liveCategory === 'mood') { categories.system_live_mood.total++; if (liveSub==='cache') categories.system_live_mood.cache.push(testInfo); else if (liveSub==='hidden') categories.system_live_mood.hidden.push(testInfo); }
          else if (liveCategory === 'tracking') { categories.system_live_tracking.total++; if (liveSub==='fresh') categories.system_live_tracking.fresh.push(testInfo); else if (liveSub==='cache') categories.system_live_tracking.cache.push(testInfo); else if (liveSub==='hidden') categories.system_live_tracking.hidden.push(testInfo); }
          else if (liveCategory === 'cbt') { categories.system_live_cbt.total++; if (liveSub==='fresh') categories.system_live_cbt.fresh.push(testInfo); else if (liveSub==='cache') categories.system_live_cbt.cache.push(testInfo); else if (liveSub==='hidden') categories.system_live_cbt.hidden.push(testInfo); }
          else if (liveCategory === 'ocd') { categories.system_live_ocd.total++; if (liveSub==='fresh') categories.system_live_ocd.fresh.push(testInfo); else if (liveSub==='cache') categories.system_live_ocd.cache.push(testInfo); else if (liveSub==='hidden') categories.system_live_ocd.hidden.push(testInfo); }
          else if (liveCategory === 'voice') { categories.system_live_voice.total++; if (liveSub==='fallback') categories.system_live_voice.fallback.push(testInfo); }
        } else if (tagMatch) {
          const [, category, subCategory] = tagMatch;
          categorized = true;
          if (category === 'today') {
            categories.today.total++;
            if (subCategory === 'fresh') categories.today.fresh.push(testInfo);
            else if (subCategory === 'cache') categories.today.cache.push(testInfo);
            else if (subCategory === 'hidden') categories.today.hidden.push(testInfo);
          } else if (category === 'mood') {
            categories.mood.total++;
            if (subCategory === 'high') categories.mood.high.push(testInfo);
            else if (subCategory === 'medium') categories.mood.medium.push(testInfo);
            else if (subCategory === 'low') categories.mood.low.push(testInfo);
            else if (subCategory === 'cache') categories.mood.cache.push(testInfo);
            else if (subCategory === 'hidden') categories.mood.hidden.push(testInfo);
          } else if (category === 'tracking') {
            categories.tracking.total++;
            if (subCategory === 'fresh') categories.tracking.fresh.push(testInfo);
            else if (subCategory === 'cache') categories.tracking.cache.push(testInfo);
            else if (subCategory === 'hidden') categories.tracking.hidden.push(testInfo);
          } else if (category === 'cbt' || category === 'ocd') {
            // removed categories
          } else if (category === 'smoke') {
            categories.smoke.total++;
            if (subCategory === 'today') categories.smoke.e2e_today.push(testInfo);
            else if (subCategory === 'mood') categories.smoke.e2e_mood.push(testInfo);
            else if (subCategory === 'voice') categories.smoke.e2e_voice.push(testInfo);
          }
        }
      }
      
      // Fallback categorization (for tests without tags)
      if (!categorized) {
        
        // Today page tests
        if (filePath.includes('TodayPage') || testName.includes('today')) {
        categories.today.total++;
        if (testName.includes('fresh')) {
          categories.today.fresh.push(testInfo);
        } else if (testName.includes('cache')) {
          categories.today.cache.push(testInfo);
        } else if (testName.includes('hidden') || testName.includes('hide')) {
          categories.today.hidden.push(testInfo);
        }
      }
      
      // Mood page tests
      else if (filePath.includes('MoodPage') || testName.includes('mood')) {
        categories.mood.total++;
        if (testName.includes('high')) {
          categories.mood.high.push(testInfo);
        } else if (testName.includes('medium') || testName.includes('med')) {
          categories.mood.medium.push(testInfo);
        } else if (testName.includes('low')) {
          categories.mood.low.push(testInfo);
        } else if (testName.includes('cache')) {
          categories.mood.cache.push(testInfo);
        } else if (testName.includes('hidden') || testName.includes('hide')) {
          categories.mood.hidden.push(testInfo);
        }
      }
      
      // Tracking page tests
      else if (filePath.includes('TrackingQualityRibbon') || testName.includes('tracking')) {
        categories.tracking.total++;
        if (testName.includes('fresh')) {
          categories.tracking.fresh.push(testInfo);
        } else if (testName.includes('cache')) {
          categories.tracking.cache.push(testInfo);
        } else if (testName.includes('hidden') || testName.includes('hide')) {
          categories.tracking.hidden.push(testInfo);
        }
      }
      
      // CBT page tests
      else if (filePath.includes('CBTQualityRibbon') || testName.includes('cbt')) {
        // removed
      }
      
      // OCD page tests
      else if (filePath.includes('OCDQualityRibbon') || testName.includes('ocd')) {
        // removed
      }
      
      // Smoke tests
      else if (filePath.includes('smoke') || filePath.includes('Smoke')) {
        categories.smoke.total++;
        if (testName.includes('today')) {
          categories.smoke.e2e_today.push(testInfo);
        } else if (testName.includes('mood')) {
          categories.smoke.e2e_mood.push(testInfo);
        } else if (testName.includes('voice')) {
          categories.smoke.e2e_voice.push(testInfo);
        }
      }
      } // End of !categorized check
      
      // Unit tests
      else if (filePath.includes('unit') || filePath.includes('QualityRibbon.test')) {
        categories.unit.total++;
        if (testName.includes('component') || testName.includes('render')) {
          categories.unit.component.push(testInfo);
        } else if (testName.includes('mapping') || testName.includes('badge')) {
          categories.unit.mapping.push(testInfo);
        }
      }
    });
  });

  return {
    categories,
    summary: {
      total: totalQRTests,
      passed: passedQRTests,
      failed: failedQRTests,
      passRate: totalQRTests > 0 ? Math.round((passedQRTests / totalQRTests) * 100) : 0
    }
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate detailed analysis and recommendations
 */
function generateAnalysis(categorizedResults) {
  const { categories, summary } = categorizedResults;
  const recommendations = [];
  const criticalIssues = [];

  // Check for zero-coverage categories (highest priority)
  if (categories.today.total === 0) {
    criticalIssues.push('No coverage for Today page integration tests');
    recommendations.push('Add Today page Fresh/Cache/Hidden scenario tests');
  }
  if (categories.mood.total === 0) {
    criticalIssues.push('No coverage for Mood page integration tests');
    recommendations.push('Add Mood page n-threshold quality tests');
  }
  if (categories.tracking.total === 0) {
    criticalIssues.push('No coverage for Tracking page integration tests');
    recommendations.push('Add Tracking page Fresh/Cache/Hidden scenario tests');
  }
  // CBT/OCD integration checks removed
  if (categories.smoke.total === 0) {
    criticalIssues.push('No coverage for Smoke E2E tests');
    recommendations.push('Add Smoke tests for Today/Mood/Voice scenarios');
  }

  // Analyze Today page results
  const todayPassed = categories.today.fresh.filter(t => t.status === 'passed').length +
                     categories.today.cache.filter(t => t.status === 'passed').length +
                     categories.today.hidden.filter(t => t.status === 'passed').length;
  const todayTotal = categories.today.fresh.length + 
                     categories.today.cache.length + 
                     categories.today.hidden.length;
  const todayPassRate = todayTotal > 0 ? Math.round((todayPassed / todayTotal) * 100) : 0;

  if (todayPassRate < 90) {
    criticalIssues.push(`Today page tests pass rate: ${todayPassRate}% (< 90%)`);
    recommendations.push('Review Today page Fresh/Cache transition logic');
  }

  // Analyze Mood page results
  const moodPassed = categories.mood.high.filter(t => t.status === 'passed').length +
                    categories.mood.medium.filter(t => t.status === 'passed').length +
                    categories.mood.low.filter(t => t.status === 'passed').length +
                    categories.mood.cache.filter(t => t.status === 'passed').length +
                    categories.mood.hidden.filter(t => t.status === 'passed').length;
  const moodTotal = categories.mood.high.length + 
                    categories.mood.medium.length + 
                    categories.mood.low.length +
                    categories.mood.cache.length +
                    categories.mood.hidden.length;
  const moodPassRate = moodTotal > 0 ? Math.round((moodPassed / moodTotal) * 100) : 0;

  if (moodPassRate < 90) {
    criticalIssues.push(`Mood page tests pass rate: ${moodPassRate}% (< 90%)`);
    recommendations.push('Review Mood page n-threshold quality detection');
  }

  // Analyze Tracking page results
  const trackingPassed = categories.tracking.fresh.filter(t => t.status === 'passed').length +
                         categories.tracking.cache.filter(t => t.status === 'passed').length +
                         categories.tracking.hidden.filter(t => t.status === 'passed').length;
  const trackingTotal = categories.tracking.fresh.length + 
                        categories.tracking.cache.length + 
                        categories.tracking.hidden.length;
  const trackingPassRate = trackingTotal > 0 ? Math.round((trackingPassed / trackingTotal) * 100) : 0;

  if (trackingPassRate < 90 && trackingTotal > 0) {
    criticalIssues.push(`Tracking page tests pass rate: ${trackingPassRate}% (< 90%)`);
    recommendations.push('Review Tracking page compulsion data processing');
  }

  // Analyze CBT page results
  const cbtPassed = categories.cbt.fresh.filter(t => t.status === 'passed').length +
                    categories.cbt.cache.filter(t => t.status === 'passed').length +
                    categories.cbt.hidden.filter(t => t.status === 'passed').length;
  const cbtTotal = categories.cbt.fresh.length + 
                   categories.cbt.cache.length + 
                   categories.cbt.hidden.length;
  const cbtPassRate = cbtTotal > 0 ? Math.round((cbtPassed / cbtTotal) * 100) : 0;

  if (cbtPassRate < 90 && cbtTotal > 0) {
    criticalIssues.push(`CBT page tests pass rate: ${cbtPassRate}% (< 90%)`);
    recommendations.push('Review CBT thought record quality analysis');
  }

  // Analyze OCD page results
  const ocdPassed = categories.ocd.fresh.filter(t => t.status === 'passed').length +
                    categories.ocd.cache.filter(t => t.status === 'passed').length +
                    categories.ocd.hidden.filter(t => t.status === 'passed').length;
  const ocdTotal = categories.ocd.fresh.length + 
                   categories.ocd.cache.length + 
                   categories.ocd.hidden.length;
  const ocdPassRate = ocdTotal > 0 ? Math.round((ocdPassed / ocdTotal) * 100) : 0;

  if (ocdPassRate < 90 && ocdTotal > 0) {
    criticalIssues.push(`OCD page tests pass rate: ${ocdPassRate}% (< 90%)`);
    recommendations.push('Review OCD pattern recognition and trigger analysis');
  }

  // Analyze Smoke tests
  const smokePassed = categories.smoke.e2e_today.filter(t => t.status === 'passed').length +
                     categories.smoke.e2e_mood.filter(t => t.status === 'passed').length +
                     categories.smoke.e2e_voice.filter(t => t.status === 'passed').length;
  const smokeTotal = categories.smoke.e2e_today.length + categories.smoke.e2e_mood.length + categories.smoke.e2e_voice.length;
  const smokePassRate = smokeTotal > 0 ? Math.round((smokePassed / smokeTotal) * 100) : 0;

  if (smokePassRate < 85) {
    criticalIssues.push(`Smoke tests pass rate: ${smokePassRate}% (< 85%)`);
    recommendations.push('Review E2E pipeline stubbing and error handling');
  }

  // Additional analysis for new categories - already computed above
  // System-mode pass rates
  const systemTodayPassed = (categories.system_today.fresh||[]).filter(t => t.status==='passed').length +
                            (categories.system_today.cache||[]).filter(t => t.status==='passed').length +
                            (categories.system_today.invalidate||[]).filter(t => t.status==='passed').length;
  const systemTodayTotal = (categories.system_today.fresh||[]).length + (categories.system_today.cache||[]).length + (categories.system_today.invalidate||[]).length;
  const systemTodayPassRate = systemTodayTotal > 0 ? Math.round((systemTodayPassed / systemTodayTotal) * 100) : 0;

  const systemMoodPassed = (categories.system_mood.cache||[]).filter(t => t.status==='passed').length + (categories.system_mood.hidden||[]).filter(t => t.status==='passed').length;
  const systemMoodTotal = (categories.system_mood.cache||[]).length + (categories.system_mood.hidden||[]).length;
  const systemMoodPassRate = systemMoodTotal > 0 ? Math.round((systemMoodPassed / systemMoodTotal) * 100) : 0;

  const systemTrackingPassed = (categories.system_tracking.fresh||[]).filter(t => t.status==='passed').length + (categories.system_tracking.cache||[]).filter(t => t.status==='passed').length + (categories.system_tracking.hidden||[]).filter(t => t.status==='passed').length;
  const systemTrackingTotal = (categories.system_tracking.fresh||[]).length + (categories.system_tracking.cache||[]).length + (categories.system_tracking.hidden||[]).length;
  const systemTrackingPassRate = systemTrackingTotal > 0 ? Math.round((systemTrackingPassed / systemTrackingTotal) * 100) : 0;

  const systemCbtPassRate = 0;
  const systemOcdPassRate = 0;

  const systemVoicePassed = (categories.system_voice.fallback||[]).filter(t => t.status==='passed').length;
  const systemVoiceTotal = (categories.system_voice.fallback||[]).length;
  const systemVoicePassRate = systemVoiceTotal > 0 ? Math.round((systemVoicePassed / systemVoiceTotal) * 100) : 0;

  // Live-mode pass rates
  const liveTodayPassed = (categories.system_live_today.fresh||[]).filter(t=>t.status==='passed').length + (categories.system_live_today.cache||[]).filter(t=>t.status==='passed').length + (categories.system_live_today.invalidate||[]).filter(t=>t.status==='passed').length;
  const liveTodayTotal = (categories.system_live_today.fresh||[]).length + (categories.system_live_today.cache||[]).length + (categories.system_live_today.invalidate||[]).length;
  const systemLiveTodayPassRate = liveTodayTotal>0 ? Math.round((liveTodayPassed/liveTodayTotal)*100) : 0;
  const liveMoodPassed = (categories.system_live_mood.cache||[]).filter(t=>t.status==='passed').length + (categories.system_live_mood.hidden||[]).filter(t=>t.status==='passed').length;
  const liveMoodTotal = (categories.system_live_mood.cache||[]).length + (categories.system_live_mood.hidden||[]).length;
  const systemLiveMoodPassRate = liveMoodTotal>0 ? Math.round((liveMoodPassed/liveMoodTotal)*100) : 0;
  const liveTrackingPassed = (categories.system_live_tracking.fresh||[]).filter(t=>t.status==='passed').length + (categories.system_live_tracking.cache||[]).filter(t=>t.status==='passed').length + (categories.system_live_tracking.hidden||[]).filter(t=>t.status==='passed').length;
  const liveTrackingTotal = (categories.system_live_tracking.fresh||[]).length + (categories.system_live_tracking.cache||[]).length + (categories.system_live_tracking.hidden||[]).length;
  const systemLiveTrackingPassRate = liveTrackingTotal>0 ? Math.round((liveTrackingPassed/liveTrackingTotal)*100) : 0;
  const liveCbtPassed = (categories.system_live_cbt.fresh||[]).filter(t=>t.status==='passed').length + (categories.system_live_cbt.cache||[]).filter(t=>t.status==='passed').length + (categories.system_live_cbt.hidden||[]).filter(t=>t.status==='passed').length;
  const liveCbtTotal = (categories.system_live_cbt.fresh||[]).length + (categories.system_live_cbt.cache||[]).length + (categories.system_live_cbt.hidden||[]).length;
  const systemLiveCbtPassRate = liveCbtTotal>0 ? Math.round((liveCbtPassed/liveCbtTotal)*100) : 0;
  const liveOcdPassed = (categories.system_live_ocd.fresh||[]).filter(t=>t.status==='passed').length + (categories.system_live_ocd.cache||[]).filter(t=>t.status==='passed').length + (categories.system_live_ocd.hidden||[]).filter(t=>t.status==='passed').length;
  const liveOcdTotal = (categories.system_live_ocd.fresh||[]).length + (categories.system_live_ocd.cache||[]).length + (categories.system_live_ocd.hidden||[]).length;
  const systemLiveOcdPassRate = liveOcdTotal>0 ? Math.round((liveOcdPassed/liveOcdTotal)*100) : 0;
  const liveVoicePassed = (categories.system_live_voice.fallback||[]).filter(t=>t.status==='passed').length;
  const liveVoiceTotal = (categories.system_live_voice.fallback||[]).length;
  const systemLiveVoicePassRate = liveVoiceTotal>0 ? Math.round((liveVoicePassed/liveVoiceTotal)*100) : 0;

  // Gating for system-mode
  const systemBuckets = [
    { name: 'System Today', total: systemTodayTotal, passRate: systemTodayPassRate },
    { name: 'System Mood', total: systemMoodTotal, passRate: systemMoodPassRate },
    { name: 'System Tracking', total: systemTrackingTotal, passRate: systemTrackingPassRate },
    // system CBT/OCD removed
    { name: 'System Voice', total: systemVoiceTotal, passRate: systemVoicePassRate },
    { name: 'System Live Today', total: liveTodayTotal, passRate: systemLiveTodayPassRate },
    { name: 'System Live Mood', total: liveMoodTotal, passRate: systemLiveMoodPassRate },
    { name: 'System Live Tracking', total: liveTrackingTotal, passRate: systemLiveTrackingPassRate },
    { name: 'System Live CBT', total: liveCbtTotal, passRate: systemLiveCbtPassRate },
    { name: 'System Live OCD', total: liveOcdTotal, passRate: systemLiveOcdPassRate },
    { name: 'System Live Voice', total: liveVoiceTotal, passRate: systemLiveVoicePassRate }
  ];
  systemBuckets.forEach(b => {
    if (b.total === 0) {
      criticalIssues.push(`${b.name} has zero coverage`);
    } else if (b.passRate < 85) {
      criticalIssues.push(`${b.name} pass rate: ${b.passRate}% (< 85%)`);
    }
  });

  // Check for specific failure patterns
  const failedTests = Object.values(categories).flatMap(category => 
    Object.values(category).flatMap(tests => 
      Array.isArray(tests) ? tests.filter(t => t.status === 'failed') : []
    )
  );

  failedTests.forEach(test => {
    if (test.fullName.includes('TTL') || test.fullName.includes('transition')) {
      recommendations.push('Check TEST_TTL_MS configuration and cache timing logic');
    }
    if (test.fullName.includes('metadata') || test.fullName.includes('hidden')) {
      recommendations.push('Verify Quality Ribbon metadata generation and visibility rules');
    }
    if (test.fullName.includes('n-threshold') || test.fullName.includes('sample')) {
      recommendations.push('Review sample size calculation and quality level mapping');
    }
  });

  return {
    todayPassRate,
    moodPassRate,
    trackingPassRate,
    cbtPassRate,
    ocdPassRate,
    smokePassRate,
    systemTodayPassRate,
    systemMoodPassRate,
    systemTrackingPassRate,
    systemCbtPassRate,
    systemOcdPassRate,
    systemVoicePassRate,
    systemLiveTodayPassRate,
    systemLiveMoodPassRate,
    systemLiveTrackingPassRate,
    systemLiveCbtPassRate,
    systemLiveOcdPassRate,
    systemLiveVoicePassRate,
    criticalIssues,
    recommendations: [...new Set(recommendations)] // Remove duplicates
  };
}

/**
 * Generate JSON report
 */
function generateJsonReport(categorizedResults, analysis) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: categorizedResults.summary,
    categories: {
      today: {
        fresh: { 
          total: categorizedResults.categories.today.fresh.length,
          passed: categorizedResults.categories.today.fresh.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.today.fresh.filter(t => t.status === 'failed').length
        },
        cache: {
          total: categorizedResults.categories.today.cache.length,
          passed: categorizedResults.categories.today.cache.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.today.cache.filter(t => t.status === 'failed').length
        },
        hidden: {
          total: categorizedResults.categories.today.hidden.length,
          passed: categorizedResults.categories.today.hidden.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.today.hidden.filter(t => t.status === 'failed').length
        }
      },
      mood: {
        high: {
          total: categorizedResults.categories.mood.high.length,
          passed: categorizedResults.categories.mood.high.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.mood.high.filter(t => t.status === 'failed').length
        },
        medium: {
          total: categorizedResults.categories.mood.medium.length,
          passed: categorizedResults.categories.mood.medium.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.mood.medium.filter(t => t.status === 'failed').length
        },
        low: {
          total: categorizedResults.categories.mood.low.length,
          passed: categorizedResults.categories.mood.low.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.mood.low.filter(t => t.status === 'failed').length
        },
        cache: {
          total: categorizedResults.categories.mood.cache.length,
          passed: categorizedResults.categories.mood.cache.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.mood.cache.filter(t => t.status === 'failed').length
        },
        hidden: {
          total: categorizedResults.categories.mood.hidden.length,
          passed: categorizedResults.categories.mood.hidden.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.mood.hidden.filter(t => t.status === 'failed').length
        }
      },
      tracking: {
        fresh: {
          total: categorizedResults.categories.tracking.fresh.length,
          passed: categorizedResults.categories.tracking.fresh.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.tracking.fresh.filter(t => t.status === 'failed').length
        },
        cache: {
          total: categorizedResults.categories.tracking.cache.length,
          passed: categorizedResults.categories.tracking.cache.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.tracking.cache.filter(t => t.status === 'failed').length
        },
        hidden: {
          total: categorizedResults.categories.tracking.hidden.length,
          passed: categorizedResults.categories.tracking.hidden.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.tracking.hidden.filter(t => t.status === 'failed').length
        }
      },
      cbt: {
        fresh: {
          total: categorizedResults.categories.cbt.fresh.length,
          passed: categorizedResults.categories.cbt.fresh.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.cbt.fresh.filter(t => t.status === 'failed').length
        },
        cache: {
          total: categorizedResults.categories.cbt.cache.length,
          passed: categorizedResults.categories.cbt.cache.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.cbt.cache.filter(t => t.status === 'failed').length
        },
        hidden: {
          total: categorizedResults.categories.cbt.hidden.length,
          passed: categorizedResults.categories.cbt.hidden.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.cbt.hidden.filter(t => t.status === 'failed').length
        }
      },
      ocd: {
        fresh: {
          total: categorizedResults.categories.ocd.fresh.length,
          passed: categorizedResults.categories.ocd.fresh.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.ocd.fresh.filter(t => t.status === 'failed').length
        },
        cache: {
          total: categorizedResults.categories.ocd.cache.length,
          passed: categorizedResults.categories.ocd.cache.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.ocd.cache.filter(t => t.status === 'failed').length
        },
        hidden: {
          total: categorizedResults.categories.ocd.hidden.length,
          passed: categorizedResults.categories.ocd.hidden.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.ocd.hidden.filter(t => t.status === 'failed').length
        }
      },
      smoke: {
        e2e_today: {
          total: categorizedResults.categories.smoke.e2e_today.length,
          passed: categorizedResults.categories.smoke.e2e_today.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.smoke.e2e_today.filter(t => t.status === 'failed').length
        },
        e2e_mood: {
          total: categorizedResults.categories.smoke.e2e_mood.length,
          passed: categorizedResults.categories.smoke.e2e_mood.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.smoke.e2e_mood.filter(t => t.status === 'failed').length
        },
        e2e_voice: {
          total: categorizedResults.categories.smoke.e2e_voice.length,
          passed: categorizedResults.categories.smoke.e2e_voice.filter(t => t.status === 'passed').length,
          failed: categorizedResults.categories.smoke.e2e_voice.filter(t => t.status === 'failed').length
        }
      }
    },
    analysis,
    failedTests: Object.values(categorizedResults.categories).flatMap(category =>
      Object.values(category).flatMap(tests =>
        Array.isArray(tests) ? tests.filter(t => t.status === 'failed') : []
      )
    )
  };

  try {
    fs.writeFileSync(CONFIG.qualityRibbonOutputJson, JSON.stringify(report, null, 2));
    console.log('✅ JSON report generated:', CONFIG.qualityRibbonOutputJson);
  } catch (error) {
    console.error('❌ Failed to write JSON report:', error.message);
  }

  return report;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(report) {
  const { summary, categories, analysis } = report;
  
  const markdown = `# 🎗️ Quality Ribbon Test Report

**Generated:** ${new Date().toLocaleString()}  
**Overall Pass Rate:** ${summary.passRate}% (${summary.passed}/${summary.total})

## 📊 Summary

| Category | Pass Rate | Details |
|----------|-----------|---------|
| **Today Page** | ${analysis.todayPassRate}% | Fresh/Cache transitions, invalidation |
| **Mood Page** | ${analysis.moodPassRate}% | N-threshold quality levels, sample sizes |
| **Tracking Page** | ${analysis.trackingPassRate}% | Compulsion data, Fresh/Cache/Hidden |
| **CBT Page** | ${analysis.cbtPassRate}% | Thought records, Fresh/Cache/Hidden |
| **OCD Page** | ${analysis.ocdPassRate}% | Pattern recognition, Fresh/Cache/Hidden |
| **Smoke Tests** | ${analysis.smokePassRate}% | End-to-end scenarios, error handling |
| **System Today** | ${analysis.systemTodayPassRate || 0}% | Real pipeline Fresh/Cache/Invalidate |
| **System Mood** | ${analysis.systemMoodPassRate || 0}% | Real pipeline Cache/Hidden |
| **System Tracking** | ${analysis.systemTrackingPassRate || 0}% | Real pipeline Fresh/Cache/Hidden |
| **System CBT** | ${analysis.systemCbtPassRate || 0}% | Real pipeline Fresh/Cache/Hidden |
| **System OCD** | ${analysis.systemOcdPassRate || 0}% | Real pipeline Fresh/Cache/Hidden |
| **System Voice** | ${analysis.systemVoicePassRate || 0}% | Real pipeline Fallback |
| **System Live** | ${Math.min(100, Math.round(([analysis.systemLiveTodayPassRate, analysis.systemLiveMoodPassRate, analysis.systemLiveTrackingPassRate, analysis.systemLiveCbtPassRate, analysis.systemLiveOcdPassRate, analysis.systemLiveVoicePassRate].filter(Boolean).reduce((a,b)=>a+b,0) / Math.max(1, [analysis.systemLiveTodayPassRate, analysis.systemLiveMoodPassRate, analysis.systemLiveTrackingPassRate, analysis.systemLiveCbtPassRate, analysis.systemLiveOcdPassRate, analysis.systemLiveVoicePassRate].filter(Boolean).length))))}% | Live Supabase Today/Mood/Tracking/CBT/OCD/Voice |

## 🏠 Today Page Results

### Fresh Pipeline
- **Total:** ${categories.today.fresh.total} tests
- **Passed:** ${categories.today.fresh.passed} 
- **Failed:** ${categories.today.fresh.failed}
- **Status:** ${categories.today.fresh.failed === 0 ? '✅ PASS' : '❌ FAIL'}

### Cache Behavior  
- **Total:** ${categories.today.cache.total} tests
- **Passed:** ${categories.today.cache.passed}
- **Failed:** ${categories.today.cache.failed}
- **Status:** ${categories.today.cache.failed === 0 ? '✅ PASS' : '❌ FAIL'}

### Hidden Conditions
- **Total:** ${categories.today.hidden.total} tests  
- **Passed:** ${categories.today.hidden.passed}
- **Failed:** ${categories.today.hidden.failed}
- **Status:** ${categories.today.hidden.failed === 0 ? '✅ PASS' : '❌ FAIL'}

## 😊 Mood Page Results

### Quality Levels
| Level | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **High** (≥14 days) | ${categories.mood.high.total} | ${categories.mood.high.passed} | ${categories.mood.high.failed} | ${categories.mood.high.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Medium** (7-13 days) | ${categories.mood.medium.total} | ${categories.mood.medium.passed} | ${categories.mood.medium.failed} | ${categories.mood.medium.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Low** (<7 days) | ${categories.mood.low.total} | ${categories.mood.low.passed} | ${categories.mood.low.failed} | ${categories.mood.low.failed === 0 ? '✅ PASS' : '❌ FAIL'} |

### Cache & Visibility
- **Cache:** ${categories.mood.cache.passed}/${categories.mood.cache.total} ${categories.mood.cache.failed === 0 ? '✅' : '❌'}
- **Hidden:** ${categories.mood.hidden.passed}/${categories.mood.hidden.total} ${categories.mood.hidden.failed === 0 ? '✅' : '❌'}

## 📊 Tracking Page Results

### Fresh/Cache/Hidden Tests
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | ${categories.tracking.fresh.total} | ${categories.tracking.fresh.passed} | ${categories.tracking.fresh.failed} | ${categories.tracking.fresh.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Cache** | ${categories.tracking.cache.total} | ${categories.tracking.cache.passed} | ${categories.tracking.cache.failed} | ${categories.tracking.cache.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Hidden** | ${categories.tracking.hidden.total} | ${categories.tracking.hidden.passed} | ${categories.tracking.hidden.failed} | ${categories.tracking.hidden.failed === 0 ? '✅ PASS' : '❌ FAIL'} |

## 🧠 CBT Page Results  

### Fresh/Cache/Hidden Tests
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | ${categories.cbt.fresh.total} | ${categories.cbt.fresh.passed} | ${categories.cbt.fresh.failed} | ${categories.cbt.fresh.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Cache** | ${categories.cbt.cache.total} | ${categories.cbt.cache.passed} | ${categories.cbt.cache.failed} | ${categories.cbt.cache.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Hidden** | ${categories.cbt.hidden.total} | ${categories.cbt.hidden.passed} | ${categories.cbt.hidden.failed} | ${categories.cbt.hidden.failed === 0 ? '✅ PASS' : '❌ FAIL'} |

## 🔄 OCD Page Results

### Fresh/Cache/Hidden Tests  
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | ${categories.ocd.fresh.total} | ${categories.ocd.fresh.passed} | ${categories.ocd.fresh.failed} | ${categories.ocd.fresh.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Cache** | ${categories.ocd.cache.total} | ${categories.ocd.cache.passed} | ${categories.ocd.cache.failed} | ${categories.ocd.cache.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Hidden** | ${categories.ocd.hidden.total} | ${categories.ocd.hidden.passed} | ${categories.ocd.hidden.failed} | ${categories.ocd.hidden.failed === 0 ? '✅ PASS' : '❌ FAIL'} |

## 🔥 Smoke Test Results

| Scenario | Total | Passed | Failed | Status |
|----------|-------|--------|--------|---------|
| **E2E Today** | ${categories.smoke.e2e_today.total} | ${categories.smoke.e2e_today.passed} | ${categories.smoke.e2e_today.failed} | ${categories.smoke.e2e_today.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **E2E Mood** | ${categories.smoke.e2e_mood.total} | ${categories.smoke.e2e_mood.passed} | ${categories.smoke.e2e_mood.failed} | ${categories.smoke.e2e_mood.failed === 0 ? '✅ PASS' : '❌ FAIL'} |
| **E2E Voice** | ${categories.smoke.e2e_voice.total} | ${categories.smoke.e2e_voice.passed} | ${categories.smoke.e2e_voice.failed} | ${categories.smoke.e2e_voice.failed === 0 ? '✅ PASS' : '❌ FAIL'} |

## 🧪 System-Mode Results (Real Pipeline)

## 🧪 System Live Results (Supabase)
- Today Fresh/Cache/Invalidate: ${((categories.system_live_today||{}).fresh||[]).length}/${(((categories.system_live_today||{}).fresh||[]).length + ((categories.system_live_today||{}).cache||[]).length + ((categories.system_live_today||{}).invalidate||[]).length)}
- Mood Cache/Hidden: ${((categories.system_live_mood||{}).cache||[]).length + ((categories.system_live_mood||{}).hidden||[]).length}
- Tracking Fresh/Cache/Hidden: ${((categories.system_live_tracking||{}).fresh||[]).length + ((categories.system_live_tracking||{}).cache||[]).length + ((categories.system_live_tracking||{}).hidden||[]).length}
- CBT Fresh/Cache/Hidden: ${((categories.system_live_cbt||{}).fresh||[]).length + ((categories.system_live_cbt||{}).cache||[]).length + ((categories.system_live_cbt||{}).hidden||[]).length}
- OCD Fresh/Cache/Hidden: ${((categories.system_live_ocd||{}).fresh||[]).length + ((categories.system_live_ocd||{}).cache||[]).length + ((categories.system_live_ocd||{}).hidden||[]).length}
- Voice Fallback: ${((categories.system_live_voice||{}).fallback||[]).length}

### Today
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | ${((categories.system_today||{}).fresh||[]).length} | ${((categories.system_today||{}).fresh||[]).filter(t=>t.status==='passed').length} | ${((categories.system_today||{}).fresh||[]).filter(t=>t.status==='failed').length} | ${(((categories.system_today||{}).fresh||[]).filter(t=>t.status==='failed').length) === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Cache** | ${((categories.system_today||{}).cache||[]).length} | ${((categories.system_today||{}).cache||[]).filter(t=>t.status==='passed').length} | ${((categories.system_today||{}).cache||[]).filter(t=>t.status==='failed').length} | ${(((categories.system_today||{}).cache||[]).filter(t=>t.status==='failed').length) === 0 ? '✅ PASS' : '❌ FAIL'} |
| **Invalidate** | ${((categories.system_today||{}).invalidate||[]).length} | ${((categories.system_today||{}).invalidate||[]).filter(t=>t.status==='passed').length} | ${((categories.system_today||{}).invalidate||[]).filter(t=>t.status==='failed').length} | ${(((categories.system_today||{}).invalidate||[]).filter(t=>t.status==='failed').length) === 0 ? '✅ PASS' : '❌ FAIL'} |

### Mood
- **Cache:** ${((categories.system_mood||{}).cache||[]).filter(t=>t.status==='passed').length}/${((categories.system_mood||{}).cache||[]).length}
- **Hidden:** ${((categories.system_mood||{}).hidden||[]).filter(t=>t.status==='passed').length}/${((categories.system_mood||{}).hidden||[]).length}

### Tracking / CBT / OCD
- Tracking Fresh/Cache/Hidden: ${(((categories.system_tracking||{}).fresh||[]).length + ((categories.system_tracking||{}).cache||[]).length + ((categories.system_tracking||{}).hidden||[]).length)} cases
- CBT Fresh/Cache/Hidden: ${(((categories.system_cbt||{}).fresh||[]).length + ((categories.system_cbt||{}).cache||[]).length + ((categories.system_cbt||{}).hidden||[]).length)} cases
- OCD Fresh/Cache/Hidden: ${(((categories.system_ocd||{}).fresh||[]).length + ((categories.system_ocd||{}).cache||[]).length + ((categories.system_ocd||{}).hidden||[]).length)} cases

${analysis.criticalIssues.length > 0 ? `## ⚠️ Critical Issues

${analysis.criticalIssues.map(issue => `- **${issue}**`).join('\n')}
` : '## ✅ No Critical Issues Found\n'}

${analysis.recommendations.length > 0 ? `## 💡 Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}
` : ''}

${report.failedTests.length > 0 ? `## ❌ Failed Tests

${report.failedTests.map(test => `### ${test.name}
**File:** ${test.file}  
**Full Name:** ${test.fullName}  
**Duration:** ${test.duration}ms

${test.failureMessages.length > 0 ? `**Error:**\n\`\`\`\n${test.failureMessages.join('\n')}\n\`\`\`` : ''}
`).join('\n')}
` : '## ✅ No Failed Tests\n'}

---

**Next Steps:**
${analysis.recommendations.length > 0 ? 
  '1. Address the recommendations above\n2. Re-run tests to verify fixes\n3. Monitor pass rates in CI/CD' : 
  '1. Quality Ribbon system is working well\n2. Continue monitoring in production\n3. Consider adding more edge case tests'}
`;

  try {
    fs.writeFileSync(CONFIG.qualityRibbonOutputMd, markdown);
    console.log('✅ Markdown report generated:', CONFIG.qualityRibbonOutputMd);
  } catch (error) {
    console.error('❌ Failed to write Markdown report:', error.message);
  }
}

/**
 * Generate console summary
 */
function generateConsoleSummary(report) {
  const { summary, analysis } = report;
  
  console.log('\n' + '='.repeat(60));
  console.log('🎗️  QUALITY RIBBON TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`📊 Overall: ${summary.passed}/${summary.total} tests passed (${summary.passRate}%)`);
  console.log(`🏠 Today: F/C/H = ${report.categories.today.fresh.passed}/${report.categories.today.fresh.total} ${report.categories.today.cache.passed}/${report.categories.today.cache.total} ${report.categories.today.hidden.passed}/${report.categories.today.hidden.total}`);
  console.log(`😊 Mood: H/M/L/C/H = ${report.categories.mood.high.passed}/${report.categories.mood.high.total} ${report.categories.mood.medium.passed}/${report.categories.mood.medium.total} ${report.categories.mood.low.passed}/${report.categories.mood.low.total} ${report.categories.mood.cache.passed}/${report.categories.mood.cache.total} ${report.categories.mood.hidden.passed}/${report.categories.mood.hidden.total}`);
  console.log(`📊 Tracking: F/C/H = ${report.categories.tracking.fresh.passed}/${report.categories.tracking.fresh.total} ${report.categories.tracking.cache.passed}/${report.categories.tracking.cache.total} ${report.categories.tracking.hidden.passed}/${report.categories.tracking.hidden.total}`);
  console.log(`🧠 CBT: F/C/H = ${report.categories.cbt.fresh.passed}/${report.categories.cbt.fresh.total} ${report.categories.cbt.cache.passed}/${report.categories.cbt.cache.total} ${report.categories.cbt.hidden.passed}/${report.categories.cbt.hidden.total}`);
  console.log(`🔄 OCD: F/C/H = ${report.categories.ocd.fresh.passed}/${report.categories.ocd.fresh.total} ${report.categories.ocd.cache.passed}/${report.categories.ocd.cache.total} ${report.categories.ocd.hidden.passed}/${report.categories.ocd.hidden.total}`);
  console.log(`🔥 Smoke: T/M/V = ${report.categories.smoke.e2e_today.passed}/${report.categories.smoke.e2e_today.total} ${report.categories.smoke.e2e_mood.passed}/${report.categories.smoke.e2e_mood.total} ${report.categories.smoke.e2e_voice.passed}/${report.categories.smoke.e2e_voice.total}`);
  
  if (analysis.criticalIssues.length > 0) {
    console.log('\n⚠️  CRITICAL ISSUES:');
    analysis.criticalIssues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  if (analysis.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    analysis.recommendations.slice(0, 3).forEach(rec => console.log(`   - ${rec}`));
    if (analysis.recommendations.length > 3) {
      console.log(`   ... and ${analysis.recommendations.length - 3} more (see MD report)`);
    }
  }
  
  const status = summary.passRate >= 90 ? '✅ EXCELLENT' : 
                 summary.passRate >= 75 ? '⚠️  NEEDS ATTENTION' : 
                 '❌ CRITICAL';
  
  console.log(`\n🎯 Status: ${status}`);
  console.log('='.repeat(60));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('🎗️ Quality Ribbon Test Results Collector');
  console.log('==========================================\n');
  
  // Parse Jest results
  const jestResults = parseJestResults();
  if (!jestResults) {
    process.exit(1);
  }
  
  // Categorize Quality Ribbon tests
  const categorizedResults = categorizeQualityRibbonTests(jestResults);
  if (!categorizedResults) {
    console.error('❌ No Quality Ribbon tests found in results');
    process.exit(1);
  }
  
  // Generate analysis
  const analysis = generateAnalysis(categorizedResults);
  
  // Generate reports
  const report = generateJsonReport(categorizedResults, analysis);
  // Post-adjust system voice stats if categorized (ensures coverage reflects new SystemVoice test)
  try {
    const sysVoice = categorizedResults.categories && categorizedResults.categories.system_voice;
    if (sysVoice && Array.isArray(sysVoice.fallback) && sysVoice.fallback.length > 0) {
      const vp = sysVoice.fallback.filter(t => t.status === "passed").length;
      const vt = sysVoice.fallback.length;
      report.analysis.systemVoicePassRate = Math.round((vp / vt) * 100);
      report.analysis.criticalIssues = (report.analysis.criticalIssues || []).filter(msg => msg !== "System Voice has zero coverage");
    }
  } catch (e) {}
  generateMarkdownReport(report);
  generateConsoleSummary(report);
  
  console.log('\n📁 Reports saved to:', CONFIG.reportsDir);
  
  // Exit with appropriate code - fail if critical issues or low pass rate
  const hasCriticalIssues = analysis.criticalIssues.length > 0;
  const hasLowPassRate = categorizedResults.summary.passRate < 90;
  const exitCode = (hasCriticalIssues || hasLowPassRate) ? 1 : 0;
  
  if (exitCode === 1) {
    console.log('\n🚨 Quality Ribbon validation FAILED - fixing required for production');
  } else {
    console.log('\n✅ Quality Ribbon validation PASSED - ready for production');
  }
  
  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  parseJestResults,
  categorizeQualityRibbonTests,
  generateAnalysis,
  generateJsonReport,
  generateMarkdownReport,
  generateConsoleSummary
};
