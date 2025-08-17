import dataStandardizer from '@/utils/dataStandardization';
import supabaseService from '@/services/supabase';

interface UICompulsionInput {
  type: string;
  resistanceLevel: number;
  trigger?: string;
  notes?: string;
}

export function useStandardizedCompulsion(userId?: string) {
  const submitCompulsion = async (input: UICompulsionInput): Promise<void> => {
    if (!userId) return;
    const standardized = dataStandardizer.standardizeCompulsionData({
      user_id: userId,
      category: input.type,
      subcategory: input.type,
      resistance_level: input.resistanceLevel,
      trigger: input.trigger || '',
      notes: input.notes || '',
      timestamp: new Date(),
    });
    await supabaseService.saveCompulsion(standardized);
  };

  return { submitCompulsion };
}


