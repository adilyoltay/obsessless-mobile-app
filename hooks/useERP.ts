
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { erpService } from '@/services/erpService';
import { CreateERPRequest } from '@/types/erp';

export const useERPExercises = () => {
  return useQuery({
    queryKey: ['erp-exercises'],
    queryFn: () => erpService.getExercises(),
  });
};

export const useCreateERPExercise = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateERPRequest) => erpService.createExercise(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-exercises'] });
    },
  });
};

export const useStartERPSession = () => {
  return useMutation({
    mutationFn: ({ exerciseId, initialAnxiety }: { exerciseId: string; initialAnxiety: number }) =>
      erpService.startSession(exerciseId, initialAnxiety),
  });
};

export const useUpdateERPSession = () => {
  return useMutation({
    mutationFn: ({ sessionId, anxietyLevel }: { sessionId: string; anxietyLevel: number }) =>
      erpService.updateSession(sessionId, anxietyLevel),
  });
};

export const useCompleteERPSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, finalAnxiety, notes }: { sessionId: string; finalAnxiety: number; notes?: string }) =>
      erpService.completeSession(sessionId, finalAnxiety, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-exercises'] });
    },
  });
};

export const useERPSessionHistory = (exerciseId: string) => {
  return useQuery({
    queryKey: ['erp-sessions', exerciseId],
    queryFn: () => erpService.getSessionHistory(exerciseId),
    enabled: !!exerciseId,
  });
};
