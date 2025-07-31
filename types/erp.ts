
export interface ERPExercise {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  category: ERPCategory;
  difficulty: ERPDifficulty;
  duration: number; // minutes
  targetAnxiety: number; // 1-10 scale
  instructions: string[];
  instructionsEn: string[];
  preparations?: string[];
  preparationsEn?: string[];
  tips?: string[];
  tipsEn?: string[];
  warnings?: string[];
  warningsEn?: string[];
  relatedCompulsions: string[]; // CompulsionType[]
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERPSession {
  id: string;
  userId: string;
  exerciseId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  targetDuration: number; // seconds
  completed: boolean;
  anxietyLevels: AnxietyReading[];
  initialAnxiety: number;
  peakAnxiety: number;
  finalAnxiety: number;
  notes?: string;
  helpUsed: boolean;
  difficulty: ERPDifficulty;
  success: boolean;
  improvementPercent?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnxietyReading {
  timestamp: number;
  level: number; // 1-10
  notes?: string;
}

export type ERPCategory = 'contamination' | 'checking' | 'symmetry' | 'harm' | 'religious' | 'sexual' | 'hoarding' | 'mental' | 'other';

export type ERPDifficulty = 1 | 2 | 3 | 4 | 5;

export interface ERPProgress {
  userId: string;
  exerciseId: string;
  totalSessions: number;
  completedSessions: number;
  averageAnxietyReduction: number;
  bestAnxietyReduction: number;
  consecutiveCompletions: number;
  lastSessionDate: Date;
  nextRecommendedDate: Date;
  masteryLevel: number; // 0-100
  isUnlocked: boolean;
  personalBest: {
    lowestFinalAnxiety: number;
    longestDuration: number;
    fastestImprovement: number;
  };
}

export interface ERPLibrary {
  exercises: ERPExercise[];
  categories: ERPCategoryInfo[];
  userProgress: Record<string, ERPProgress>;
}

export interface ERPCategoryInfo {
  id: ERPCategory;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  color: string;
  difficulty: ERPDifficulty;
  recommendedOrder: number;
}

export interface ERPStatistics {
  totalExercises: number;
  completedExercises: number;
  averageAnxietyReduction: number;
  totalTimeSpent: number; // minutes
  currentStreak: number;
  longestStreak: number;
  masteredExercises: number;
  nextMilestone: {
    type: 'sessions' | 'exercises' | 'time' | 'streak';
    current: number;
    target: number;
    reward: string;
  };
}

// Exercise templates for different compulsion types
export interface ERPExerciseTemplate {
  compulsionType: string;
  difficulty: ERPDifficulty;
  exercises: Partial<ERPExercise>[];
}

// Session recording data
export interface ERPSessionData {
  exerciseId: string;
  startTime: Date;
  targetDuration: number;
  initialAnxiety: number;
}

// Real-time session state
export interface ERPSessionState {
  isActive: boolean;
  isPaused: boolean;
  currentExercise?: ERPExercise;
  startTime?: Date;
  elapsedTime: number;
  targetDuration: number;
  currentAnxiety: number;
  anxietyHistory: AnxietyReading[];
  phase: 'preparation' | 'exposure' | 'response_prevention' | 'completion';
}

export interface CreateERPRequest {
  exerciseId: string;
  targetDuration: number;
  notes?: string;
}
