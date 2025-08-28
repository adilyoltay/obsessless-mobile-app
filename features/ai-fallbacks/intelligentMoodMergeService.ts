/**
 * Intelligent Mood Merge Service Fallback - Phase 2
 */

export const intelligentMergeService = {
  async intelligentMoodMerge(...args: any[]) {
    // AI mood merge disabled - use simple merge fallback
    console.log('🚫 AI Intelligent Mood Merge disabled, using simple fallback');
    const [localEntries = [], remoteEntries = []] = args;
    
    // Simple merge: remote entries take precedence
    return {
      mergedEntries: remoteEntries,
      conflicts: [],
      stats: {
        syncSuccess: true,
        localPreserved: 0,
        remoteAccepted: remoteEntries.length,
        conflictsResolved: 0
      }
    };
  },
  
  async shouldMerge(...args: any[]) {
    // AI merge decision disabled - always use simple merge
    return true; // Allow simple merge to proceed
  }
};
