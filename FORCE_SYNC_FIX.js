/**
 * 🚨 EMERGENCY SYNC FIX
 * Purpose: Fix localStorage vs Supabase inconsistency
 * Issue: UI shows 6 entries but system thinks 4
 */

// Paste this in Chrome DevTools Console while on Mood page

async function emergencySyncFix() {
  console.log('🚨 Starting Emergency Sync Fix...');
  
  try {
    // 1. Clear all mood-related localStorage
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('mood_')) {
        keys.push(key);
      }
    }
    
    console.log(`🧹 Found ${keys.length} mood-related localStorage keys`);
    keys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`❌ Removed: ${key}`);
    });
    
    // 2. Clear AsyncStorage mood data (React Native)
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.includes('mood_'));
    
    console.log(`🧹 Found ${moodKeys.length} AsyncStorage mood keys`);
    await AsyncStorage.multiRemove(moodKeys);
    console.log('❌ Cleared AsyncStorage mood data');
    
    // 3. Force invalidate React Query cache
    if (window.queryClient) {
      await window.queryClient.invalidateQueries({ queryKey: ['mood'] });
      await window.queryClient.invalidateQueries({ queryKey: ['ai'] });
      console.log('🔄 Invalidated React Query cache');
    }
    
    // 4. Reload page to force fresh data fetch
    console.log('✅ Emergency sync fix completed');
    console.log('🔄 Reloading page to get fresh data...');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Emergency sync fix failed:', error);
  }
}

// Run the fix
emergencySyncFix();
