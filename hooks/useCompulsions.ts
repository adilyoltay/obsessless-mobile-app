
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Compulsion {
  id: string;
  type: string;
  severity: number;
  resistanceLevel: number;
  duration: number;
  trigger?: string;
  notes?: string;
  timestamp: Date;
  userId: string;
}

export interface CreateCompulsionData {
  type: string;
  severity: number;
  resistanceLevel: number;
  duration: number;
  trigger?: string;
  notes?: string;
}

// Mock API service for demo
const compulsionService = {
  async getAll(userId: string): Promise<Compulsion[]> {
    const stored = await AsyncStorage.getItem(`compulsions_${userId}`);
    return stored ? JSON.parse(stored) : [];
  },

  async create(userId: string, data: CreateCompulsionData): Promise<Compulsion> {
    const compulsion: Compulsion = {
      id: Date.now().toString(),
      ...data,
      timestamp: new Date(),
      userId,
    };

    const existing = await this.getAll(userId);
    const updated = [...existing, compulsion];
    await AsyncStorage.setItem(`compulsions_${userId}`, JSON.stringify(updated));
    
    return compulsion;
  },

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.getAll(userId);
    const filtered = existing.filter(c => c.id !== id);
    await AsyncStorage.setItem(`compulsions_${userId}`, JSON.stringify(filtered));
  },

  async getStats(userId: string) {
    const compulsions = await this.getAll(userId);
    const today = new Date().toDateString();
    const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      total: compulsions.length,
      today: compulsions.filter(c => new Date(c.timestamp).toDateString() === today).length,
      thisWeek: compulsions.filter(c => new Date(c.timestamp) >= thisWeek).length,
      averageResistance: compulsions.reduce((sum, c) => sum + c.resistanceLevel, 0) / compulsions.length || 0,
    };
  }
};

export function useCompulsions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['compulsions', user?.uid],
    queryFn: () => compulsionService.getAll(user!.uid),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateCompulsion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: CreateCompulsionData) =>
      compulsionService.create(user!.uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compulsions', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['compulsion-stats', user?.uid] });
    },
  });
}

export function useDeleteCompulsion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => compulsionService.delete(user!.uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compulsions', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['compulsion-stats', user?.uid] });
    },
  });
}

export function useCompulsionStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['compulsion-stats', user?.uid],
    queryFn: () => compulsionService.getStats(user!.uid),
    enabled: !!user?.uid,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
