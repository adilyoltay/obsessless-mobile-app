/**
 * Mood Data Flow Tester Fallback - Phase 2
 */

export const moodDataFlowTester = {
  generateQuickReport: async (userId: string) => {
    // AI mood data flow tester disabled - return empty report
    return {
      status: 'disabled',
      message: 'AI mood data flow testing disabled'
    };
  },
  
  runCompleteTest: async (...args: any[]) => {
    // AI mood data flow tester disabled
    return { status: 'disabled', results: [] };
  },
  
  getMoodDataSummary: async (...args: any[]) => {
    // AI mood data summary disabled
    return { entries: 0, summary: 'Disabled' };
  }
};
