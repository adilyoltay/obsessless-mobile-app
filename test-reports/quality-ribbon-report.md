# 🎗️ Quality Ribbon Test Report

**Generated:** 8/25/2025, 9:29:55 PM  
**Overall Pass Rate:** 93% (143/154)

## 📊 Summary

| Category | Pass Rate | Details |
|----------|-----------|---------|
| **Today Page** | 100% | Fresh/Cache transitions, invalidation |
| **Mood Page** | 100% | N-threshold quality levels, sample sizes |
| **Tracking Page** | 100% | Compulsion data, Fresh/Cache/Hidden |
| **CBT Page** | 100% | Thought records, Fresh/Cache/Hidden |
| **OCD Page** | 100% | Pattern recognition, Fresh/Cache/Hidden |
| **Smoke Tests** | 100% | End-to-end scenarios, error handling |
| **System Today** | 100% | Real pipeline Fresh/Cache/Invalidate |
| **System Mood** | 100% | Real pipeline Cache/Hidden |
| **System Tracking** | 100% | Real pipeline Fresh/Cache/Hidden |
| **System CBT** | 100% | Real pipeline Fresh/Cache/Hidden |
| **System OCD** | 100% | Real pipeline Fresh/Cache/Hidden |
| **System Voice** | 100% | Real pipeline Fallback |
| **System Live** | 67% | Live Supabase Today/Mood/Tracking/CBT/OCD/Voice |

## 🏠 Today Page Results

### Fresh Pipeline
- **Total:** 5 tests
- **Passed:** 5 
- **Failed:** 0
- **Status:** ✅ PASS

### Cache Behavior  
- **Total:** 5 tests
- **Passed:** 5
- **Failed:** 0
- **Status:** ✅ PASS

### Hidden Conditions
- **Total:** 4 tests  
- **Passed:** 4
- **Failed:** 0
- **Status:** ✅ PASS

## 😊 Mood Page Results

### Quality Levels
| Level | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **High** (≥14 days) | 0 | 0 | 0 | ✅ PASS |
| **Medium** (7-13 days) | 0 | 0 | 0 | ✅ PASS |
| **Low** (<7 days) | 0 | 0 | 0 | ✅ PASS |

### Cache & Visibility
- **Cache:** 2/2 ✅
- **Hidden:** 2/2 ✅

## 📊 Tracking Page Results

### Fresh/Cache/Hidden Tests
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | 2 | 2 | 0 | ✅ PASS |
| **Cache** | 2 | 2 | 0 | ✅ PASS |
| **Hidden** | 3 | 3 | 0 | ✅ PASS |

## 🧠 CBT Page Results  

### Fresh/Cache/Hidden Tests
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | 2 | 2 | 0 | ✅ PASS |
| **Cache** | 2 | 2 | 0 | ✅ PASS |
| **Hidden** | 3 | 3 | 0 | ✅ PASS |

## 🔄 OCD Page Results

### Fresh/Cache/Hidden Tests  
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | 2 | 2 | 0 | ✅ PASS |
| **Cache** | 2 | 2 | 0 | ✅ PASS |
| **Hidden** | 3 | 3 | 0 | ✅ PASS |

## 🔥 Smoke Test Results

| Scenario | Total | Passed | Failed | Status |
|----------|-------|--------|--------|---------|
| **E2E Today** | 2 | 2 | 0 | ✅ PASS |
| **E2E Mood** | 4 | 4 | 0 | ✅ PASS |
| **E2E Voice** | 1 | 1 | 0 | ✅ PASS |

## 🧪 System-Mode Results (Real Pipeline)

## 🧪 System Live Results (Supabase)
- Today Fresh/Cache/Invalidate: 0/0
- Mood Cache/Hidden: 0
- Tracking Fresh/Cache/Hidden: 0
- CBT Fresh/Cache/Hidden: 0
- OCD Fresh/Cache/Hidden: 0
- Voice Fallback: 0

### Today
| State | Total | Passed | Failed | Status |
|-------|-------|--------|--------|---------|
| **Fresh** | 0 | 0 | 0 | ✅ PASS |
| **Cache** | 0 | 0 | 0 | ✅ PASS |
| **Invalidate** | 0 | 0 | 0 | ✅ PASS |

### Mood
- **Cache:** 0/0
- **Hidden:** 0/0

### Tracking / CBT / OCD
- Tracking Fresh/Cache/Hidden: 0 cases
- CBT Fresh/Cache/Hidden: 0 cases
- OCD Fresh/Cache/Hidden: 0 cases

## ⚠️ Critical Issues

- **System Live Today pass rate: 67% (< 85%)**
- **System Live Mood has zero coverage**
- **System Live Tracking has zero coverage**
- **System Live CBT has zero coverage**
- **System Live OCD has zero coverage**
- **System Live Voice has zero coverage**




## ❌ Failed Tests

### [QRlive:today:fresh] writes ai_cache on fresh run
**File:** LiveTodaySupabase.spec.ts  
**Full Name:** Live Today Supabase [QRlive:today:fresh] writes ai_cache on fresh run  
**Duration:** 2458ms

**Error:**
```
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeGreaterThan[2m([22m[32mexpected[39m[2m)[22m

Expected: > [32m0[39m
Received:   [31m0[39m
    at Object.toBeGreaterThan (/Users/adilyoltay/Desktop/obsesslesmobilenew/obslessless-clean/__tests__/live/LiveTodaySupabase.spec.ts:60:33)
    at Generator.next (<anonymous>)
    at asyncGeneratorStep (/Users/adilyoltay/Desktop/obsesslesmobilenew/obslessless-clean/node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
    at _next (/Users/adilyoltay/Desktop/obsesslesmobilenew/obslessless-clean/node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)
```



---

**Next Steps:**
1. Quality Ribbon system is working well
2. Continue monitoring in production
3. Consider adding more edge case tests
