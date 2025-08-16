import { dataStandardizer } from '@/utils/dataStandardization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';

class DataComplianceService {
  async exportUserData(userId: string): Promise<any> {
    const collected = await this.collectAllUserData(userId);
    const standardized = await dataStandardizer.standardizeBatch(collected, (item) => item);
    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      data: standardized,
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.markForDeletion(userId);
    await this.scheduleHardDelete(userId, 30);
  }

  // implementasyon
  private async collectAllUserData(userId: string): Promise<any[]> {
    const exportItems: any[] = [];
    // Local moods (son 30 gün)
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - i * 86400000);
      const key = `mood_entries_${userId}_${d.toISOString().split('T')[0]}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) exportItems.push(...JSON.parse(raw).map((x: any) => ({ type: 'mood_entry', ...x })));
      } catch {}
    }
    // Remote pulls (best-effort)
    try {
      const compulsions = await supabaseService.getCompulsions(userId);
      exportItems.push(...compulsions.map((x: any) => ({ type: 'compulsion', ...x })));
    } catch {}
    try {
      const erp = await supabaseService.getERPSessions(userId);
      exportItems.push(...erp.map((x: any) => ({ type: 'erp_session', ...x })));
    } catch {}
    return exportItems;
  }

  private async markForDeletion(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`user_delete_mark_${userId}`, new Date().toISOString());
    } catch {}
  }

  private async scheduleHardDelete(userId: string, days: number): Promise<void> {
    try {
      const at = new Date(Date.now() + days * 86400000).toISOString();
      await AsyncStorage.setItem(`user_hard_delete_at_${userId}`, at);
    } catch {}
  }
}

export const dataCompliance = new DataComplianceService();
export default dataCompliance;


