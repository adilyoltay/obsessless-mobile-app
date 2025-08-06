
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';

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

// Enhanced service with Supabase integration
const compulsionService = {
  async getAll(userId: string): Promise<Compulsion[]> {
    try {
      console.log('🔍 Fetching compulsions...');
      
      // Try to get from AsyncStorage first (offline-first)
      const stored = await AsyncStorage.getItem(`compulsions_${userId}`);
      const localCompulsions: Compulsion[] = stored ? JSON.parse(stored) : [];
      
      // Try to sync with Supabase
      try {
        const supabaseCompulsions = await supabaseService.getCompulsions(userId);
        
        // Merge local and remote data (prioritize local for offline changes)
        const mergedCompulsions = this.mergeCompulsions(localCompulsions, supabaseCompulsions);
        
        // Update AsyncStorage with merged data
        await AsyncStorage.setItem(`compulsions_${userId}`, JSON.stringify(mergedCompulsions));
        
        console.log(`✅ Compulsions synced: ${mergedCompulsions.length} total`);
        return mergedCompulsions;
      } catch (supabaseError) {
        console.warn('⚠️ Supabase sync failed, using offline data:', supabaseError);
        return localCompulsions;
      }
    } catch (error) {
      console.error('❌ Error fetching compulsions:', error);
      return [];
    }
  },

  mergeCompulsions(local: Compulsion[], remote: any[]): Compulsion[] {
    // Convert Supabase format to local format
    const remoteConverted: Compulsion[] = remote.map(r => ({
      id: r.id,
      type: r.category,
      severity: r.resistance_level || 5, // Map resistance to severity
      resistanceLevel: r.resistance_level,
      duration: 0, // Not available in Supabase schema
      trigger: r.trigger,
      notes: r.notes,
      timestamp: new Date(r.timestamp),
      userId: r.user_id
    }));

    // Create a map of all compulsions by ID
    const compulsionMap = new Map();
    
    // Add remote compulsions first
    remoteConverted.forEach(comp => compulsionMap.set(comp.id, comp));
    
    // Override with local compulsions (they might have offline changes)
    local.forEach(comp => compulsionMap.set(comp.id, comp));
    
    return Array.from(compulsionMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  async create(userId: string, data: CreateCompulsionData): Promise<Compulsion> {
    try {
      console.log('🔄 Creating compulsion...');
      
      const compulsion: Compulsion = {
        id: Date.now().toString(),
        ...data,
        timestamp: new Date(),
        userId,
      };

      // Save to AsyncStorage first (offline-first)
      const existing = await this.getAll(userId);
      const updated = [...existing, compulsion];
      await AsyncStorage.setItem(`compulsions_${userId}`, JSON.stringify(updated));
      
      console.log('✅ Compulsion saved to AsyncStorage');

      // Try to save to Supabase
      try {
        await supabaseService.saveCompulsion({
          user_id: userId,
          category: data.type,
          resistance_level: data.resistanceLevel,
          trigger: data.trigger,
          notes: data.notes
        });
        console.log('✅ Compulsion saved to Supabase');
      } catch (supabaseError) {
        console.warn('⚠️ Supabase save failed, compulsion saved offline:', supabaseError);
        // Continue with offline mode - data is already in AsyncStorage
      }
      
      return compulsion;
    } catch (error) {
      console.error('❌ Error creating compulsion:', error);
      throw error;
    }
  },

  async delete(userId: string, id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting compulsion...');
      
      // Delete from AsyncStorage
      const existing = await this.getAll(userId);
      const filtered = existing.filter(c => c.id !== id);
      await AsyncStorage.setItem(`compulsions_${userId}`, JSON.stringify(filtered));
      
      console.log('✅ Compulsion deleted from AsyncStorage');

      // Try to delete from Supabase
      try {
        await supabaseService.deleteCompulsion(id);
        console.log('✅ Compulsion deleted from Supabase');
      } catch (supabaseError) {
        console.warn('⚠️ Supabase delete failed, compulsion deleted offline:', supabaseError);
        // Continue with offline mode - data is already removed from AsyncStorage
      }
    } catch (error) {
      console.error('❌ Error deleting compulsion:', error);
      throw error;
    }
  },

  async getStats(userId: string) {
    try {
      const compulsions = await this.getAll(userId);
      const today = new Date().toDateString();
      const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      return {
        total: compulsions.length,
        today: compulsions.filter(c => new Date(c.timestamp).toDateString() === today).length,
        thisWeek: compulsions.filter(c => new Date(c.timestamp) >= thisWeek).length,
        averageResistance: compulsions.reduce((sum, c) => sum + c.resistanceLevel, 0) / compulsions.length || 0,
      };
    } catch (error) {
      console.error('❌ Error calculating stats:', error);
      return {
        total: 0,
        today: 0,
        thisWeek: 0,
        averageResistance: 0,
      };
    }
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
