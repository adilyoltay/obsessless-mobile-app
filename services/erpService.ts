
import { ERPExercise, ERPSession, CreateERPRequest, AnxietyReading } from '@/types/erp';

// Mock data for development
let mockExercises: ERPExercise[] = [
  {
    id: '1',
    title: 'Kapıyı Kontrol Etmeme',
    description: 'Kapıyı sadece bir kez kontrol edip arkasına bakmama egzersizi',
    category: 'checking',
    difficulty: 2,
    targetDuration: 15,
    instructions: [
      'Kapıyı normal şekilde kilitle',
      'Bir kez kontrol et',
      'Geri dönme ve tekrar kontrol etme'
    ],
    createdAt: new Date(),
    completedSessions: 5,
    averageAnxiety: 7.2
  },
  {
    id: '2',
    title: 'Ellerimi Yıkamama',
    description: 'Kirli hissetsem bile ellerimi fazla yıkamama egzersizi',
    category: 'contamination',
    difficulty: 4,
    targetDuration: 30,
    instructions: [
      'Normal günlük aktiviteleri yap',
      'Kirli hissettiklerinde ellerini yıkama',
      '30 dakika boyunca dayan'
    ],
    createdAt: new Date(),
    completedSessions: 2,
    averageAnxiety: 8.5
  }
];

let mockSessions: ERPSession[] = [];

class ERPService {
  async getExercises(): Promise<ERPExercise[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockExercises), 500);
    });
  }

  async createExercise(data: CreateERPRequest): Promise<ERPExercise> {
    const newExercise: ERPExercise = {
      ...data,
      id: Date.now().toString(),
      createdAt: new Date(),
      completedSessions: 0,
      averageAnxiety: 0
    };
    
    mockExercises.push(newExercise);
    return newExercise;
  }

  async startSession(exerciseId: string, initialAnxiety: number): Promise<ERPSession> {
    const session: ERPSession = {
      id: Date.now().toString(),
      exerciseId,
      startTime: new Date(),
      duration: 0,
      initialAnxiety,
      peakAnxiety: initialAnxiety,
      finalAnxiety: 0,
      completed: false,
      anxietyReadings: [{
        timestamp: Date.now(),
        level: initialAnxiety
      }]
    };

    mockSessions.push(session);
    return session;
  }

  async updateSession(sessionId: string, anxietyLevel: number): Promise<void> {
    const session = mockSessions.find(s => s.id === sessionId);
    if (session) {
      session.anxietyReadings.push({
        timestamp: Date.now(),
        level: anxietyLevel
      });
      session.peakAnxiety = Math.max(session.peakAnxiety, anxietyLevel);
    }
  }

  async completeSession(sessionId: string, finalAnxiety: number, notes?: string): Promise<ERPSession> {
    const session = mockSessions.find(s => s.id === sessionId);
    if (session) {
      session.endTime = new Date();
      session.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
      session.finalAnxiety = finalAnxiety;
      session.notes = notes;
      session.completed = true;

      // Update exercise stats
      const exercise = mockExercises.find(e => e.id === session.exerciseId);
      if (exercise) {
        exercise.completedSessions++;
        exercise.lastSession = new Date();
        
        // Recalculate average anxiety
        const allSessions = mockSessions.filter(s => s.exerciseId === exercise.id && s.completed);
        const totalAnxiety = allSessions.reduce((sum, s) => sum + s.finalAnxiety, 0);
        exercise.averageAnxiety = totalAnxiety / allSessions.length;
      }
    }
    
    return session!;
  }

  async getSessionHistory(exerciseId: string): Promise<ERPSession[]> {
    return mockSessions.filter(s => s.exerciseId === exerciseId && s.completed);
  }
}

export const erpService = new ERPService();
