import supabaseService from '@/services/supabase';

export type LiveResultStatus = 'pass' | 'fail';

export interface LiveResultPayload {
  runId: string;
  userId: string;
  tag: string; // [QRlive:category:sub]
  status: LiveResultStatus;
  details?: Record<string, any>;
}

/**
 * Dev-only helper to write live test results for the active user.
 */
export async function postLiveResult(payload: LiveResultPayload): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  const { runId, userId, tag, status, details } = payload;
  try {
    await supabaseService.supabaseClient.from('ai_live_results').insert({
      run_id: runId,
      user_id: userId,
      tag,
      status,
      details: details || null,
    });
  } catch (e) {
    // best-effort
  }
}



