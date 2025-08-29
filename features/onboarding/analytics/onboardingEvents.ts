import { trackAIInteraction, AIEventType } from '@/services/telemetry/noopTelemetry';

export async function trackOnbView(step_id: string, progress_pct: number, variant?: string) {
  await trackAIInteraction(AIEventType.ONBOARDING_VIEW as any, { step_id, progress_pct, variant });
}

export async function trackOnbSelect(step_id: string, key: string, value: any) {
  await trackAIInteraction(AIEventType.ONBOARDING_SELECT as any, { step_id, key, value });
}

export async function trackOnbSkip(step_id: string, reason?: string) {
  await trackAIInteraction(AIEventType.ONBOARDING_SKIP as any, { step_id, reason });
}

export async function trackOnbReminder(enabled: boolean, time?: string, days_count?: number) {
  await trackAIInteraction(AIEventType.ONBOARDING_SET_REMINDER as any, { enabled, time, days_count });
}

export async function trackOnbComplete(steps_completed: number, flags: Record<string, any>, duration_ms: number) {
  await trackAIInteraction(AIEventType.ONBOARDING_COMPLETED, { steps_completed, flags, duration_ms });
}


