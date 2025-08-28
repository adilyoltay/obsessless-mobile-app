/**
 * Intelligent Mood Merge Service Fallback - Phase 2
 */

export class IntelligentMoodMergeService {
  static async intelligentMerge(...args: any[]) {
    // AI mood merge disabled - use simple merge
    console.log('🚫 AI Intelligent Mood Merge disabled:', args);
    return null; // Let the service handle normal merge
  }
  
  static async shouldMerge(...args: any[]) {
    // AI merge decision disabled - never merge
    return false;
  }
}
