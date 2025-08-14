
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
      if (__DEV__) console.log('🔍 Fetching compulsions...');
      
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
        
         if (__DEV__) console.log(`✅ Compulsions synced: ${mergedCompulsions.length} total`);
        return mergedCompulsions;
      } catch (supabaseError) {
        if (__DEV__) console.warn('⚠️ Supabase sync failed, using offline data:', supabaseError);
        return localCompulsions;
      }
    } catch (error) {
      if (__DEV__) console.error('❌ Error fetching compulsions:', error);
      return [];
    }
  },

  /**
   * Çakışma güvenli birleştirme (Last-Write-Wins + çatışma günlüğü)
   * - ID bazında eşleşen kayıtlar için daha yeni `timestamp` kazanır
   * - Farklı alanlar varsa bir çatışma kaydı oluşturulur (AsyncStorage anahtarı: `sync_conflicts`)
   */
  mergeCompulsions(local: Compulsion[], remote: any[]): Compulsion[] {
    // Convert Supabase format to local format
    const remoteConverted: Compulsion[] = remote.map(r => ({
      id: r.id,
      // Prefer original label from subcategory if present; fallback to category
      type: r.subcategory || r.category,
      severity: r.resistance_level || 5, // Map resistance to severity
      resistanceLevel: r.resistance_level,
      duration: 0, // Not available in Supabase schema
      trigger: r.trigger,
      notes: r.notes,
      timestamp: new Date(r.timestamp),
      userId: r.user_id
    }));

    // Map'ler
    const localMap = new Map(local.map(item => [item.id, item]));
    const remoteMap = new Map(remoteConverted.map(item => [item.id, item]));

    const allIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
    const merged: Compulsion[] = [];
    const conflicts: Array<{ id: string; local: any; remote: any }> = [];

    allIds.forEach(id => {
      const l = localMap.get(id);
      const r = remoteMap.get(id);
      if (l && r) {
        const lt = new Date(l.timestamp).getTime();
        const rt = new Date(r.timestamp).getTime();
        const winner = lt >= rt ? l : r; // LWW

        // Alan farkı var mı? (timestamp hariç)
        const comparableLocal = { ...l, timestamp: undefined } as any;
        const comparableRemote = { ...r, timestamp: undefined } as any;
        if (JSON.stringify(comparableLocal) !== JSON.stringify(comparableRemote)) {
          conflicts.push({ id, local: l, remote: r });
        }
        merged.push(winner);
      } else if (l) {
        merged.push(l);
      } else if (r) {
        merged.push(r);
      }
    });

    // Çatışmaları arka planda kaydet (best-effort)
    if (conflicts.length > 0) {
      try {
        (async () => {
          const existing = await AsyncStorage.getItem('sync_conflicts');
          const arr = existing ? JSON.parse(existing) : [];
          arr.push({
            entity: 'compulsion',
            count: conflicts.length,
            at: new Date().toISOString(),
            conflicts: conflicts.slice(0, 20) // limit
          });
          await AsyncStorage.setItem('sync_conflicts', JSON.stringify(arr));
        })();
      } catch {}
    }

    return merged.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  async create(userId: string, data: CreateCompulsionData): Promise<Compulsion> {
    try {
      if (__DEV__) console.log('🔄 Creating compulsion...');
      
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
      
      if (__DEV__) console.log('✅ Compulsion saved to AsyncStorage');

      // Try to save to Supabase
      try {
        await supabaseService.saveCompulsion({
          user_id: userId,
          category: data.type,
          resistance_level: data.resistanceLevel,
          trigger: data.trigger,
          notes: data.notes
        });
        if (__DEV__) console.log('✅ Compulsion saved to Supabase');
      } catch (supabaseError) {
        if (__DEV__) console.warn('⚠️ Supabase save failed, compulsion saved offline:', supabaseError);
        // Continue with offline mode - data is already in AsyncStorage
      }
      
      return compulsion;
    } catch (error) {
      if (__DEV__) console.error('❌ Error creating compulsion:', error);
      throw error;
    }
  },

  async delete(userId: string, id: string): Promise<void> {
    try {
      if (__DEV__) console.log('🗑️ Deleting compulsion...');
      
      // Delete from AsyncStorage
      const existing = await this.getAll(userId);
      const filtered = existing.filter(c => c.id !== id);
      await AsyncStorage.setItem(`compulsions_${userId}`, JSON.stringify(filtered));
      
      if (__DEV__) console.log('✅ Compulsion deleted from AsyncStorage');

      // Try to delete from Supabase
      try {
        await supabaseService.deleteCompulsion(id);
        if (__DEV__) console.log('✅ Compulsion deleted from Supabase');
      } catch (supabaseError) {
        if (__DEV__) console.warn('⚠️ Supabase delete failed, compulsion deleted offline:', supabaseError);
        // Continue with offline mode - data is already removed from AsyncStorage
      }
    } catch (error) {
      if (__DEV__) console.error('❌ Error deleting compulsion:', error);
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
      if (__DEV__) console.error('❌ Error calculating stats:', error);
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
    queryKey: ['compulsions', user?.id],
    queryFn: () => compulsionService.getAll(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateCompulsion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: CreateCompulsionData) =>
      compulsionService.create(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compulsions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['compulsion-stats', user?.id] });
    },
  });
}

export function useDeleteCompulsion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => compulsionService.delete(user!.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compulsions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['compulsion-stats', user?.id] });
    },
  });
}

export function useCompulsionStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['compulsion-stats', user?.id],
    queryFn: () => compulsionService.getStats(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
