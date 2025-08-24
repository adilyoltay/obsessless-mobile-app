/**
 * 🧪 E2E Tests - Today Page Quality Ribbon
 * 
 * End-to-end tests for Quality Ribbon system on Today page
 * Tests pipeline phases, adaptive suggestions, and user interactions
 */

describe('Today Page - Quality Ribbon E2E', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    
    // Navigate to Today page
    await element(by.text('Bugün')).tap();
    
    // Wait for initial load
    await waitFor(element(by.id('today-hero-section')))
      .toBeVisible()
      .withTimeout(5000);
  });

  describe('AI Pipeline Phases', () => {
    it('should show Phase 1 quick insights loading', async () => {
      // Check for loading state
      await expect(element(by.text('AI analizleri yükleniyor...'))).toBeVisible();
      
      // Wait for Phase 1 completion
      await waitFor(element(by.id('phase-1-insights')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should progress to Phase 2 deep analysis', async () => {
      // Wait for Phase 1 to complete
      await waitFor(element(by.id('phase-1-insights')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Check Phase 2 trigger
      await waitFor(element(by.text('Derin analiz yapılıyor...')))
        .toBeVisible()
        .withTimeout(2000);
      
      // Wait for Phase 2 completion
      await waitFor(element(by.id('deep-insights-complete')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Adaptive Suggestion Quality Ribbon', () => {
    beforeEach(async () => {
      // Add test data first
      await addTestMoodEntries(5);
      await addTestCompulsions(3);
      
      // Refresh to trigger pipeline
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Wait for adaptive suggestion to appear
      await waitFor(element(by.id('adaptive-suggestion-card')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should display Quality Ribbon with correct badges', async () => {
      // Check for Quality Ribbon container
      await expect(element(by.id('quality-ribbon'))).toBeVisible();
      
      // Check individual badges
      await expect(element(by.text('Fast')).or(element(by.text('Fresh')))).toBeVisible();
      await expect(element(by.text('Med')).or(element(by.text('High')))).toBeVisible();
      
      // Check sample size badge (format: n=X)
      await expect(element(by.text(by.label(/n=\d+/)))).toBeVisible();
    });

    it('should show different quality levels based on data volume', async () => {
      // Test with minimal data (should show Low quality)
      await clearAllData();
      await addTestMoodEntries(2);
      await element(by.id('today-scroll-view')).swipe('down');
      
      await waitFor(element(by.id('adaptive-suggestion-card')))
        .toBeVisible()
        .withTimeout(10000);
      
      await expect(element(by.text('Low'))).toBeVisible();
      
      // Test with rich data (should show High quality)
      await addTestMoodEntries(10);
      await addTestCBTRecords(5);
      await element(by.id('today-scroll-view')).swipe('down');
      
      await waitFor(element(by.text('High')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show Fresh vs Cache badges correctly', async () => {
      // First load - should show Fresh
      await element(by.id('today-scroll-view')).swipe('down');
      await waitFor(element(by.text('Fresh')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Immediate second load - should show Cache
      await element(by.id('today-scroll-view')).swipe('down');
      await waitFor(element(by.text('Cache')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('User Interactions', () => {
    beforeEach(async () => {
      await addTestMoodEntries(5);
      await element(by.id('today-scroll-view')).swipe('down');
      await waitFor(element(by.id('adaptive-suggestion-card')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should handle "Şimdi Dene" action correctly', async () => {
      // Get suggestion category to determine expected destination
      const suggestionText = await element(by.id('adaptive-suggestion-title')).getAttributes();
      
      // Tap "Şimdi Dene" button
      await element(by.text('Şimdi Dene')).tap();
      
      // Should navigate to appropriate page
      // This depends on the suggestion category (breathwork, mood, cbt, etc.)
      await waitFor(element(by.text('Nefes')).or(element(by.text('Mood')).or(element(by.text('CBT')))))
        .toBeVisible()
        .withTimeout(3000);
      
      // Navigate back to Today to verify card is gone
      await element(by.text('Bugün')).tap();
      await expect(element(by.id('adaptive-suggestion-card'))).not.toBeVisible();
    });

    it('should handle "Daha Sonra" action correctly', async () => {
      // Tap "Daha Sonra" button
      await element(by.text('Daha Sonra')).tap();
      
      // Card should disappear
      await waitFor(element(by.id('adaptive-suggestion-card')))
        .not.toBeVisible()
        .withTimeout(3000);
      
      // Should not show again immediately
      await element(by.id('today-scroll-view')).swipe('down');
      await waitFor(element(by.id('adaptive-suggestion-card')))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Pipeline Integration', () => {
    it('should handle AI_UNIFIED_PIPELINE flag disabled', async () => {
      // Disable unified pipeline flag (requires test configuration)
      await toggleFeatureFlag('AI_UNIFIED_PIPELINE', false);
      
      // Should fall back to heuristic analysis
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Should show Fast/Heuristic badges
      await waitFor(element(by.text('Fast')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should prioritize adaptive suggestions over breathwork suggestions', async () => {
      // Add data that would generate both types of suggestions
      await addTestMoodEntries(5);
      await addHighStressPatterns();
      
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Should only show adaptive suggestion (with Quality Ribbon)
      await expect(element(by.id('adaptive-suggestion-card'))).toBeVisible();
      await expect(element(by.id('quality-ribbon'))).toBeVisible();
      
      // Should NOT show breathwork suggestion card
      await expect(element(by.id('breathwork-suggestion-card'))).not.toBeVisible();
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle pipeline errors', async () => {
      // Simulate network error
      await device.setURLBlacklist(['**/api/**']);
      
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Should still show some form of content (fallback state)
      await expect(element(by.id('today-hero-section'))).toBeVisible();
      
      // Quality Ribbon should not appear if no valid data
      await expect(element(by.id('quality-ribbon'))).not.toBeVisible();
    });

    it('should handle missing quality metadata gracefully', async () => {
      // This tests the backwards compatibility
      // If meta prop is undefined, card should still render without ribbon
      
      await addTestMoodEntries(3);
      await simulateMetadataError();
      
      await element(by.id('today-scroll-view')).swipe('down');
      
      // Adaptive suggestion should appear
      await waitFor(element(by.id('adaptive-suggestion-card')))
        .toBeVisible()
        .withTimeout(10000);
      
      // But Quality Ribbon should not be present
      await expect(element(by.id('quality-ribbon'))).not.toBeVisible();
    });
  });

  // Helper functions
  const addTestMoodEntries = async (count) => {
    // Navigate to mood page and add entries
    await element(by.text('Mood')).tap();
    
    for (let i = 0; i < count; i++) {
      await element(by.id('add-mood-button')).tap();
      await element(by.id('mood-slider')).setValue((Math.random() * 10 + 1).toString());
      await element(by.text('Kaydet')).tap();
      await device.sleep(500); // Small delay between entries
    }
    
    // Return to Today page
    await element(by.text('Bugün')).tap();
  };

  const addTestCompulsions = async (count) => {
    await element(by.text('OCD')).tap();
    
    for (let i = 0; i < count; i++) {
      await element(by.id('add-compulsion-button')).tap();
      await element(by.text('washing')).tap(); // Select type
      await element(by.id('intensity-slider')).setValue((Math.random() * 10 + 1).toString());
      await element(by.text('Kaydet')).tap();
      await device.sleep(500);
    }
    
    await element(by.text('Bugün')).tap();
  };

  const addTestCBTRecords = async (count) => {
    await element(by.text('CBT')).tap();
    
    for (let i = 0; i < count; i++) {
      await element(by.id('new-thought-record-button')).tap();
      await element(by.id('situation-input')).typeText(`Test situation ${i}`);
      await element(by.id('automatic-thoughts-input')).typeText(`Test thought ${i}`);
      await element(by.id('mood-before-slider')).setValue((Math.random() * 10 + 1).toString());
      await element(by.id('balanced-thoughts-input')).typeText(`Balanced thought ${i}`);
      await element(by.id('mood-after-slider')).setValue((Math.random() * 10 + 1).toString());
      await element(by.text('Kaydet')).tap();
      await device.sleep(500);
    }
    
    await element(by.text('Bugün')).tap();
  };

  const clearAllData = async () => {
    // Clear AsyncStorage through dev menu or direct API call
    try {
      // Method 1: Use React Native's DevSettings to clear AsyncStorage
      await device.sendToHome();
      await device.launchApp({ 
        newInstance: false,
        url: 'obslessless://dev/clear-storage'
      });
      await device.sleep(1000);
      
      // Method 2: Alternative - clear through test endpoint if available
      // This assumes a test-only endpoint exists in dev mode
      /*
      await fetch('http://localhost:8081/test/clear-storage', {
        method: 'POST'
      });
      */
      
      // Method 3: Navigate to Settings and clear data (UI-based)
      await element(by.text('Ayarlar')).tap();
      if (await element(by.text('Test Verilerini Temizle')).isVisible()) {
        await element(by.text('Test Verilerini Temizle')).tap();
        await element(by.text('Onayla')).tap();
      }
      
      // Return to Today page
      await element(by.text('Bugün')).tap();
      await device.sleep(2000);
      
    } catch (error) {
      console.warn('clearAllData failed:', error);
      // Fallback: restart app to ensure clean state
      await device.reloadReactNative();
    }
  };

  const toggleFeatureFlag = async (flagName, value) => {
    try {
      // Method 1: Use AsyncStorage to override feature flag
      // This assumes feature flags check AsyncStorage for overrides in test mode
      const overrideKey = `test_flag_${flagName}`;
      
      await device.sendUserActivity({
        type: 'com.obsessless.test.set-flag',
        userInfo: {
          flagName: flagName,
          value: value,
          action: 'set'
        }
      });
      
      await device.sleep(500);
      
      // Method 2: Alternative - Navigate to dev settings if available
      if (__DEV__) {
        await element(by.text('Ayarlar')).tap();
        
        // Look for debug/developer options
        if (await element(by.text('Geliştirici Seçenekleri')).isVisible()) {
          await element(by.text('Geliştirici Seçenekleri')).tap();
          
          // Find the specific feature flag toggle
          const flagToggle = element(by.id(`flag-toggle-${flagName}`));
          if (await flagToggle.isVisible()) {
            const currentState = await flagToggle.getAttributes();
            // Toggle if needed to match desired value
            if ((value && currentState.value !== 'true') || (!value && currentState.value === 'true')) {
              await flagToggle.tap();
            }
          }
          
          // Go back to Today page
          await element(by.text('Bugün')).tap();
        }
      }
      
      // Method 3: Direct AsyncStorage manipulation (for test environment)
      // This would require a test bridge or deep link
      await device.launchApp({
        newInstance: false,
        url: `obslessless://test/flag?${flagName}=${value}`
      });
      
      await device.sleep(1000);
      
    } catch (error) {
      console.warn(`toggleFeatureFlag(${flagName}, ${value}) failed:`, error);
      
      // Fallback: Restart app with environment variable override
      await device.terminateApp();
      await device.launchApp({
        newInstance: true,
        environmentVariables: {
          [`TEST_${flagName}`]: value.toString(),
          'EXPO_PUBLIC_ENABLE_AI': value.toString() // For AI-related flags
        }
      });
    }
  };

  const addHighStressPatterns = async () => {
    // Add mood entries with high stress/anxiety patterns
    await element(by.text('Mood')).tap();
    
    const stressEntries = [
      { mood: 3, energy: 2, anxiety: 8 },
      { mood: 4, energy: 3, anxiety: 9 },
      { mood: 2, energy: 2, anxiety: 7 }
    ];
    
    for (const entry of stressEntries) {
      await element(by.id('add-mood-button')).tap();
      await element(by.id('mood-slider')).setValue(entry.mood.toString());
      await element(by.id('energy-slider')).setValue(entry.energy.toString());
      await element(by.id('anxiety-slider')).setValue(entry.anxiety.toString());
      await element(by.text('Kaydet')).tap();
      await device.sleep(500);
    }
    
    await element(by.text('Bugün')).tap();
  };

  const simulateMetadataError = async () => {
    try {
      // Method 1: Trigger network failure to cause metadata generation failure
      await device.setURLBlacklist([
        '**/supabase/**',
        '**/api/analyze/**',
        '**/gemini/**'
      ]);
      
      // Method 2: Use deep link to simulate metadata error condition
      await device.launchApp({
        newInstance: false,
        url: 'obslessless://test/simulate-error?type=metadata&component=qualityRibbon'
      });
      
      await device.sleep(1000);
      
      // Method 3: Force specific error condition through user activity
      await device.sendUserActivity({
        type: 'com.obsessless.test.simulate-error',
        userInfo: {
          errorType: 'metadata_generation_failure',
          component: 'extractUIQualityMeta',
          action: 'return_null'
        }
      });
      
      await device.sleep(500);
      
      // Method 4: Corrupt local data to cause parsing errors
      await device.sendUserActivity({
        type: 'com.obsessless.test.corrupt-data',
        userInfo: {
          dataType: 'pipeline_result',
          corruptionType: 'missing_metadata_fields'
        }
      });
      
    } catch (error) {
      console.warn('simulateMetadataError failed:', error);
      
      // Fallback: Use environment variable to force error condition
      await device.terminateApp();
      await device.launchApp({
        newInstance: true,
        environmentVariables: {
          'TEST_FORCE_METADATA_ERROR': 'true',
          'TEST_SIMULATE_NETWORK_FAILURE': 'true'
        }
      });
      
      // Navigate back to Today page if needed
      try {
        await element(by.text('Bugün')).tap();
      } catch {
        // Already on Today page or navigation failed
      }
    }
  };
});
