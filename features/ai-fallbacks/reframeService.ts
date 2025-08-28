/**
 * Reframe Service Fallback - Phase 2
 */

export const generateReframes = async (text: string, userId?: string) => {
  // AI reframes disabled - return empty array
  console.log('🚫 AI Reframes disabled:', text);
  
  return [];
};
