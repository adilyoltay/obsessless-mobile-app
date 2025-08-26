# 📋 QA Manual Test Checklist

## 🎯 Test Objective
Comprehensive manual testing of Quality Ribbon and AI features based on QA_TESTING_GUIDE.md

**Test Date:** `[Fill in date]`  
**Tester:** `[Fill in name]`  
**App Version:** `[Fill in version]`  
**Platform:** `[iOS/Android/Web]`

---

## ✅ Pre-Test Setup

### Initial Checks
- [ ] App launches without crashes
- [ ] Bottom navigation shows all 5 tabs (Today, Mood, CBT, Tracking, Breathwork, Settings)
- [ ] Console is open in browser (for web testing)
- [ ] Network connection is stable

### Test Data Preparation
- [ ] Clear all existing data (or use fresh install)
- [ ] Have mood entries ready to add (various values 1-10)
- [ ] Prepare sample CBT scenarios
- [ ] Plan compulsion tracking entries

---

## 🏠 Today (Bugün) Sayfası - Priority: HIGH

### Test Scenario: Multi-module AI Analysis

**Step 1: Initial State Check**
- [ ] Navigate to Today page
- [ ] Verify hero section displays (healing points, streak counter)
- [ ] Look for "AI analizleri yükleniyor..." message
- [ ] **Expected:** Basic layout loads without errors

**Step 2: Add Basic Data**
- [ ] Add 2-3 mood entries (different values: low=3, medium=6, high=8)
- [ ] Add 1-2 compulsion records
- [ ] Optionally add 1 CBT thought record
- [ ] **Expected:** Data saves successfully

**Step 3: Trigger AI Pipeline**
- [ ] Swipe down to refresh Today page
- [ ] Watch for Phase 1 → Phase 2 progression
- [ ] **Console Check:** Look for:
  - `🚀 UNIFIED PIPELINE: Processing with mixed content`
  - `✅ Phase 2: Deep insights loaded with ALL MODULE DATA`
- [ ] **Expected:** Pipeline completes within 5 seconds

**Step 4: Quality Ribbon Verification**
- [ ] Look for AdaptiveSuggestionCard appearing
- [ ] Check top-right corner for Quality Ribbon badges
- [ ] **Expected Badges:**
  - Source: `[Fast]` or `[Fresh]` (green/yellow background)
  - Quality: `[Med]` or `[High]` (based on data amount)
  - Sample: `[n=X]` where X = total data points
  - Age: `[Xm]` where X = minutes since analysis
- [ ] **Expected:** All badges visible and correctly formatted

**Step 5: Analytics Verification**
- [ ] **Console Check:** Look for:
  - `📊 Minimal CBT analytics: sampleSize=X, volatility=X`
  - `📊 Minimal Tracking analytics: sampleSize=X, volatility=X`  
  - `📊 Default quality metadata set for Today suggestion`
- [ ] **Expected:** Analytics show appropriate sample sizes

**Step 6: User Interaction Test**
- [ ] Click "Şimdi Dene" button
- [ ] **Expected:** Navigates to appropriate page (Breathwork/CBT/etc.)
- [ ] Go back, find suggestion again
- [ ] Click "Daha Sonra" 
- [ ] **Expected:** Card disappears
- [ ] **Optional:** Wait 2+ hours, check if reappears

**Result: Today Page**
- [ ] ✅ PASS - All tests completed successfully
- [ ] ❌ FAIL - Issues found (document below)

**Issues Found:**
```
[Document any issues here]
```

---

## 💭 Mood Sayfası - Priority: HIGH

### Test Scenario: Clinical-Grade Mood Analytics

**Step 1: Mood Entry Creation**
- [ ] Navigate to Mood page
- [ ] Click "+" button
- [ ] Fill mood values (mood: 4, energy: 3, anxiety: 7)
- [ ] Add notes: "Feeling anxious about work presentation"
- [ ] Save entry
- [ ] **Expected:** Entry appears in list

**Step 2: Bulk Data for Quality Testing**
- [ ] Add 5-10 mood entries across different days
- [ ] Use varied mood levels (1-10 range)
- [ ] Include mix with/without notes
- [ ] **Expected:** All entries save and display correctly

**Step 3: Trigger Mood AI Pipeline**
- [ ] Pull to refresh on Mood page
- [ ] **Console Check:** Watch for:
  - `🚀 Mood AI Pipeline triggered with unified system`
  - `📊 Quality metadata for mood suggestion: {...}`
  - `📊 Enhanced mood analytics attached to result`
- [ ] **Expected:** Pipeline processing completes

**Step 4: Advanced Quality Ribbon Test**
- [ ] Wait for AdaptiveSuggestionCard to appear
- [ ] **Expected Quality Ribbon (with 7+ entries):**
  - Source: `[Fresh]` (green background)
  - Quality: `[High]` (green background)
  - Sample: `[n=10+]`
  - Age: `[Xm]` (recent analysis)
- [ ] Verify badge colors match expectations
- [ ] **Expected:** High-quality ribbon for sufficient data

**Step 5: Clinical Analytics Verification**
- [ ] **Console Check:** Look for detailed analytics:
```javascript
📊 Mood analytics: confidence=0.85, sampleSize=10, volatility=0.8
📊 Quality metadata for mood suggestion: {
  source: 'unified',
  qualityLevel: 'high', 
  sampleSize: 15,
  freshnessMs: 120000
}
```
- [ ] **Expected:** Analytics show clinical-grade metrics

**Step 6: Dashboard Integration**
- [ ] Check mood charts updated
- [ ] Verify patterns display
- [ ] Test weekly/monthly views
- [ ] **Expected:** Visual data reflects new entries

**Result: Mood Page**
- [ ] ✅ PASS - All tests completed successfully
- [ ] ❌ FAIL - Issues found (document below)

**Issues Found:**
```
[Document any issues here]
```

---

## 🧠 CBT (Düşünce Kaydı) Sayfası - Priority: MEDIUM

### Test Scenario: CBT Analytics Integration

**Step 1: Create Thought Record**
- [ ] Navigate to CBT page  
- [ ] Click "Yeni Düşünce Kaydı"
- [ ] Fill complete form:
  - **Situation:** "Worried about deadline"
  - **Automatic thoughts:** "I'll never finish on time"
  - **Emotions:** "Anxiety (8/10), Stress (7/10)"
  - **Mood Before:** 3/10
  - **Balanced thoughts:** "I have skills to manage this"
  - **Mood After:** 6/10
- [ ] Save record
- [ ] **Expected:** Record saves with before/after improvement

**Step 2: Multiple Records for Analytics**
- [ ] Create 3-5 CBT records with different:
  - Mood before values (1-10)
  - Mood after values (showing improvement)
  - Various situations and thoughts
- [ ] **Expected:** All records save successfully

**Step 3: CBT Analytics Pipeline Test**
- [ ] Go back to Today page (CBT analytics processes there)
- [ ] **Console Check:** Look for:
  - `📊 Minimal CBT analytics: sampleSize=5, volatility=0.8, weeklyDelta=1.2`
- [ ] **Expected:** CBT analytics appear in pipeline logs

**Step 4: CBT Quality Metrics**
- [ ] Check if CBT-specific adaptive suggestions appear
- [ ] **Expected Quality Ribbon (if suggestions show):**
  - Source: `[Fresh]` or `[Fast]`
  - Quality: `[Med]` (medium for 3-5 records)
  - Sample: `[n=5]`
- [ ] **Analytics Content Expected:**
  - sampleSize: Count of CBT records
  - volatility: Mood improvement variation
  - weeklyDelta: Trend over time

**Step 5: CBT Dashboard Check**  
- [ ] Review thought records list
- [ ] Check progress indicators
- [ ] Look for mood improvement trends
- [ ] **Expected:** Dashboard reflects CBT progress

**Result: CBT Page**
- [ ] ✅ PASS - All tests completed successfully
- [ ] ❌ FAIL - Issues found (document below)

**Issues Found:**
```
[Document any issues here]
```

---

## 📊 Tracking (OCD) Sayfası - Priority: MEDIUM

### Test Scenario: OCD Pattern Recognition

**Step 1: Compulsion Recording**
- [ ] Navigate to Tracking page
- [ ] Click "Yeni Kayıt"
- [ ] Fill compulsion details:
  - **Type:** Hand washing  
  - **Intensity:** 7/10
  - **Duration:** 5 minutes
  - **Resistance Level:** 3/5
  - **Location:** Bathroom
  - **Trigger:** Touched doorknob
- [ ] Save record
- [ ] **Expected:** Record appears in tracking list

**Step 2: Pattern Data Generation**
- [ ] Create 10+ compulsion records across different days
- [ ] Vary types (washing, checking, organizing)
- [ ] Use different resistance levels (1-5)
- [ ] Spread across different times of day
- [ ] **Expected:** Diverse tracking data created

**Step 3: Tracking Analytics Pipeline**
- [ ] Return to Today page for analytics processing
- [ ] **Console Check:** Look for:
  - `📊 Minimal Tracking analytics: sampleSize=12, volatility=2.1, weeklyDelta=-1.2`
- [ ] **Expected:** Tracking analytics in pipeline

**Step 4: Pattern Analysis Verification**
- [ ] **Analytics Interpretation Expected:**
  - sampleSize: Total compulsions count
  - volatility: Daily compulsion count variation
  - weeklyDelta: Recent vs older trends (negative = improvement)
  - baselines.compulsions: Daily average
- [ ] **Expected:** Meaningful pattern metrics

**Step 5: Insights & Trends**
- [ ] Check weekly patterns display
- [ ] Look for peak times analysis  
- [ ] Review resistance trends
- [ ] Examine trigger analysis
- [ ] **Expected:** Visual insights from tracking data

**Result: Tracking Page**
- [ ] ✅ PASS - All tests completed successfully
- [ ] ❌ FAIL - Issues found (document below)

**Issues Found:**
```
[Document any issues here]
```

---

## 🫁 Breathwork (Nefes) Sayfası - Priority: LOW

### Test Scenario: Anxiety Reduction Tracking

**Step 1: Breathing Session**
- [ ] Navigate to Breathwork page
- [ ] Select breathing technique (4-7-8 or box breathing)
- [ ] Set anxiety level BEFORE: 8/10
- [ ] Complete full breathing session
- [ ] Set anxiety level AFTER: 5/10  
- [ ] Save session
- [ ] **Expected:** Session records anxiety improvement

**Step 2: Multiple Sessions**
- [ ] Complete 3-5 breathwork sessions across different days
- [ ] Try different techniques
- [ ] Vary before/after anxiety levels
- [ ] **Expected:** Session history builds up

**Step 3: Integration with AI Pipeline**
- [ ] Check Today page for breathwork analytics
- [ ] Look for breathwork suggestions in adaptive cards
- [ ] **Console Check:** Monitor for breathwork-related logs
- [ ] **Expected:** Breathwork data integrates with overall analytics

**Result: Breathwork Page**
- [ ] ✅ PASS - All tests completed successfully  
- [ ] ❌ FAIL - Issues found (document below)

**Issues Found:**
```
[Document any issues here]
```

---

## ⚙️ Settings (Ayarlar) Sayfası - Priority: LOW

### Test Scenario: AI Feature Control

**Step 1: AI Settings Control**
- [ ] Navigate to Settings page
- [ ] Find AI feature toggles
- [ ] Turn Unified Pipeline OFF
- [ ] Go to Today page, refresh
- [ ] **Expected:** Should see heuristic fallback
- [ ] Turn Unified Pipeline back ON
- [ ] **Expected:** Returns to full AI analysis

**Step 2: Debug Mode Testing**
- [ ] Enable debug mode in settings
- [ ] Enable verbose logging
- [ ] Return to Today page, refresh
- [ ] **Console Check:** Should see more detailed logs
- [ ] **Expected:** Enhanced debugging information

**Result: Settings Page**
- [ ] ✅ PASS - All tests completed successfully
- [ ] ❌ FAIL - Issues found (document below)

**Issues Found:**
```
[Document any issues here]
```

---

## 🔄 Cross-Page Integration Tests - Priority: HIGH

### Test Scenario: Full Pipeline Integration

**Step 1: Comprehensive Data Setup**
- [ ] Day 1 Data Creation:
  - [ ] 3 mood entries (varied levels)
  - [ ] 2 CBT records (with before/after improvement)
  - [ ] 5 compulsion records (different types)
  - [ ] 2 breathwork sessions
- [ ] **Expected:** Rich dataset for analysis

**Step 2: Full Pipeline Test**
- [ ] Go to Today page, pull to refresh
- [ ] **Console Check:** Look for "ALL module data" logs
- [ ] **Expected Quality Ribbon:**
  - Source: `[Fresh]` (green)
  - Quality: `[High]` (green) 
  - Sample: `[n=12+]`
  - Age: Recent (under 5 minutes)
- [ ] **Expected:** High-quality comprehensive analysis

**Step 3: Quality Evolution Test**  
- [ ] Start with minimal data → should show `[Fast][Low][n=2]`
- [ ] Add more data gradually
- [ ] Watch quality progression: `[Fresh][Med][n=5]` → `[Fresh][High][n=10+]`
- [ ] **Expected:** Quality improves with more data

**Step 4: Suggestion Prioritization**
- [ ] With AdaptiveSuggestion showing, other suggestions should be hidden
- [ ] Dismiss AdaptiveSuggestion
- [ ] **Expected:** Other suggestions (Breathwork, etc.) may appear
- [ ] Test cooldown periods work correctly

**Result: Integration Tests**
- [ ] ✅ PASS - All tests completed successfully
- [ ] ❌ FAIL - Issues found (document below)

**Issues Found:**
```
[Document any issues here]
```

---

## 📊 Final Test Summary

### Overall Results
- [ ] **Today Page:** ✅ PASS / ❌ FAIL
- [ ] **Mood Page:** ✅ PASS / ❌ FAIL  
- [ ] **CBT Page:** ✅ PASS / ❌ FAIL
- [ ] **Tracking Page:** ✅ PASS / ❌ FAIL
- [ ] **Breathwork Page:** ✅ PASS / ❌ FAIL
- [ ] **Settings Page:** ✅ PASS / ❌ FAIL
- [ ] **Integration Tests:** ✅ PASS / ❌ FAIL

### Quality Ribbon Success Rate
- [ ] Badge display accuracy: ___% 
- [ ] Source type correctness: ___%
- [ ] Quality level accuracy: ___%
- [ ] Freshness calculation: ___%
- [ ] User interactions: ___%

### Critical Issues Found
```
[List any blocking or critical issues]

Priority: High/Medium/Low
Impact: UI/Data/Performance/Security
Steps to reproduce:
1. 
2.
3.

Expected vs Actual behavior:
```

### Performance Notes
- [ ] Pipeline processing time: ___ seconds (target: <3s)
- [ ] UI responsiveness: Good/Fair/Poor
- [ ] Memory usage: Normal/High/Concerning  
- [ ] Battery impact: Minimal/Moderate/High

### Recommendations
```
[Provide recommendations for improvements or next steps]
```

---

## 🎯 Test Completion

**Date Completed:** `[Fill in]`  
**Total Test Time:** `[Fill in]` minutes  
**Overall Status:** `[PASS/FAIL/CONDITIONAL PASS]`

**Next Actions:**
- [ ] Address critical issues
- [ ] Schedule regression testing
- [ ] Update documentation if needed
- [ ] Plan performance improvements

---

**Tester Signature:** `[Fill in]`  
**Review Date:** `[Fill in]`  
**Reviewed By:** `[Fill in]`
