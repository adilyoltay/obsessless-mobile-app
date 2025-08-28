/**
 * Edge AI Service Fallback - Phase 2
 */

export const edgeAIService = {
  cleanupOldTempFiles: async (hoursThreshold: number) => {
    // AI edge service disabled - no temp files to clean
    console.log(`🚫 AI Edge Service disabled: cleanup ${hoursThreshold}h threshold`);
  }
};
