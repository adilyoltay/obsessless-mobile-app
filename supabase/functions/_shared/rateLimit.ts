// ✅ F-10 FIX: Edge Function Rate Limiting Helper
// Shared rate limiting utility for analyze-voice and analyze-audio-storage

/**
 * Get rate limit parameters from environment or use defaults
 */
function getRateLimitConfig(): { windowMinutes: number; maxRequests: number } {
  const windowMinutes = parseInt(Deno.env.get('RATE_LIMIT_WINDOW_MIN') || '10', 10);
  const maxRequests = parseInt(Deno.env.get('RATE_LIMIT_MAX') || '50', 10);
  
  // Validation to prevent misconfigurations
  const validWindow = Math.max(1, Math.min(windowMinutes, 60)); // 1-60 minutes
  const validMax = Math.max(1, Math.min(maxRequests, 1000)); // 1-1000 requests
  
  return { windowMinutes: validWindow, maxRequests: validMax };
}

/**
 * Check if user is within rate limit for AI API calls
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @param windowMinutes - Time window in minutes (optional, uses ENV or default: 10)
 * @param maxRequests - Maximum requests allowed in window (optional, uses ENV or default: 50)
 * @returns Promise<boolean> - true if within limit, false if exceeded
 */
export async function withinRateLimit(
  supabase: any, 
  userId: string, 
  windowMinutes?: number, 
  maxRequests?: number
): Promise<boolean> {
  try {
    // Use environment variables or passed parameters or defaults
    const config = getRateLimitConfig();
    const effectiveWindow = windowMinutes ?? config.windowMinutes;
    const effectiveMax = maxRequests ?? config.maxRequests;
    
    const windowStart = new Date(Date.now() - effectiveWindow * 60 * 1000).toISOString();
    
    console.log(`🔍 Rate limit check: userId=${userId.substring(0, 8)}..., window=${effectiveWindow}min, max=${effectiveMax} (ENV: RATE_LIMIT_WINDOW_MIN=${Deno.env.get('RATE_LIMIT_WINDOW_MIN') || 'default'}, RATE_LIMIT_MAX=${Deno.env.get('RATE_LIMIT_MAX') || 'default'})`);
    
    // Count AI telemetry events in the time window for this user
    const { count, error } = await supabase
      .from('ai_telemetry')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart);

    if (error) {
      console.warn('⚠️ Rate-limit check failed, proceeding fail-open:', error.message);
      // FAIL-OPEN: Allow request when rate limit check fails
      // This prevents AI service outage due to database issues
      return true;
    }

    const currentCount = count || 0;
    const withinLimit = currentCount < effectiveMax;
    
    console.log(`📊 Rate limit status: ${currentCount}/${effectiveMax} requests in last ${effectiveWindow}min - ${withinLimit ? 'ALLOWED' : 'BLOCKED'}`);
    
    return withinLimit;
    
  } catch (error) {
    console.error('❌ Rate limit check exception:', error);
    // FAIL-OPEN: Allow request on unexpected errors
    return true;
  }
}

/**
 * Standard rate limit response for 429 errors
 * @param corsHeaders - CORS headers to include
 * @param windowMinutes - Time window that was checked
 * @param maxRequests - Max requests allowed
 * @returns Response object with 429 status
 */
export function createRateLimitResponse(corsHeaders: Record<string, string>, windowMinutes: number, maxRequests: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'rate_limited',
      message: `Rate limit exceeded: ${maxRequests} requests per ${windowMinutes} minutes`,
      retryAfter: Math.ceil(windowMinutes * 60), // seconds
      details: {
        windowMinutes,
        maxRequests,
        timestamp: new Date().toISOString()
      }
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(windowMinutes * 60))
      }
    }
  );
}

/**
 * Log rate limit hit for telemetry
 * @param supabase - Supabase client
 * @param userId - User ID that hit the limit  
 * @param functionName - Name of the edge function
 * @param currentCount - Current request count
 * @param maxRequests - Max allowed requests
 */
export async function logRateLimitHit(
  supabase: any,
  userId: string,
  functionName: string,
  currentCount: number,
  maxRequests: number
): Promise<void> {
  try {
    await supabase
      .from('ai_telemetry')
      .insert({
        user_id: userId,
        event_type: 'AI_RATE_LIMIT_HIT',
        event_data: {
          function: functionName,
          currentCount,
          maxRequests,
          timestamp: Date.now(),
          blocked: true
        },
        session_id: null,
        timestamp: new Date().toISOString()
      });
    
    console.log(`🚨 Rate limit telemetry logged for user ${userId.substring(0, 8)}... in ${functionName}`);
  } catch (error) {
    console.warn('⚠️ Failed to log rate limit telemetry:', error);
    // Don't throw - telemetry failure shouldn't block the response
  }
}
