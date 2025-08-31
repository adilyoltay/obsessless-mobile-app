/**
 * Live Deletion Debug - Run this while app is running
 * Shows real-time deletion cache and storage state
 */

console.log('🔍 LIVE DELETION DEBUG - Run this in terminal while app runs');
console.log('====================================================\n');

// Sample problematic entry from logs
const PROBLEM_ENTRY = 'mood_ulzbmo_20250830T1743';
const USER_ID = 'a7742a37-ae66-4815-97a6-bef18945cd0c';

console.log(`🎯 Debugging entry: ${PROBLEM_ENTRY}`);
console.log(`👤 User ID: ${USER_ID}\n`);

console.log('📋 Steps to test deletion:');
console.log('1. Try to delete the problematic entry from UI');
console.log('2. Check deletion cache');  
console.log('3. Check if entry still appears in list');
console.log('4. Check storage locations\n');

console.log('🔍 Expected behavior after our fixes:');
console.log('✅ Deletion cache should contain the entry ID');
console.log('✅ Merge should filter out the entry');
console.log('✅ Entry should not appear in UI list');
console.log('✅ Storage should not contain the entry\n');

console.log('📱 Test now in your app, then check the terminal logs!');
