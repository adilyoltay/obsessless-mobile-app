/**
 * Supabase Edge Function: Analyze Voice
 * Kullanıcı ses girişlerini Gemini API ile analiz eder
 * Bu function, client tarafındaki API key güvenlik sorununu çözer
 * ✅ F-10 FIX: Added rate limiting (50 requests per 10 minutes per user)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withinRateLimit, createRateLimitResponse, logRateLimitHit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisRequest {
  text: string;
  userId: string;
  analysisType?: 'voice' | 'data' | 'mixed';
  context?: {
    source: 'today' | 'mood' | 'tracking' | 'cbt';
    timestamp?: number;
    metadata?: any;
  };
}

interface UnifiedAnalysisResult {
  category: 'MOOD' | 'CBT' | 'OCD' | 'ERP' | 'BREATHWORK' | 'UNKNOWN';
  confidence: number;
  summary: string;
  suggestions: string[];
  insights: {
    cbt?: {
      automaticThought: string;
      cognitiveDistortions: string[];
      evidenceFor: string[];
      evidenceAgainst: string[];
      balancedThought: string;
      mood: number;
    };
    mood?: {
      detectedMood: string;
      intensity: number;
      triggers: string[];
      suggestions: string[];
    };
    ocd?: {
      obsession: string;
      compulsion: string;
      avoidance: string[];
      erpSuggestion: string;
    };
    breathwork?: {
      technique: string;
      duration: number;
      benefits: string[];
    };
  };
  metadata?: {
    modelUsed: string;
    processingTime: number;
    timestamp: string;
  };
}

/**
 * Gemini API ile ses analizi yapar
 */
async function analyzeWithGemini(text: string, retryCount: number = 0): Promise<UnifiedAnalysisResult | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set');
    return null;
  }

  const SYSTEM_PROMPT = `
Sen ObsessLess uygulamasının AI asistanısın. OKB (Obsesif Kompulsif Bozukluk) ile mücadele eden kullanıcılara yardım ediyorsun.

Kullanıcının ses girişini analiz et ve şu kategorilerden birine ata:
- MOOD: Genel ruh hali, günlük duygular
- CBT: Olumsuz düşünceler, bilişsel çarpıtmalar
- OCD: Obsesyonlar, kompulsiyonlar, kaçınma davranışları  
- ERP: Maruz kalma ve tepki önleme ile ilgili
- BREATHWORK: Nefes egzersizleri, rahatlatma teknikleri
- UNKNOWN: Belirsiz veya kategorize edilemeyen

ÇIKTI FORMATI (JSON):
{
  "category": "kategori_adı",
  "confidence": 0.85,
  "summary": "Kısa özet",
  "suggestions": ["öneri1", "öneri2"],
  "insights": {
    "mood": { "detectedMood": "kaygılı", "intensity": 7, "triggers": ["iş"], "suggestions": ["öneri"] },
    "cbt": { "automaticThought": "düşünce", "cognitiveDistortions": ["felaketleştirme"], "evidenceFor": [], "evidenceAgainst": [], "balancedThought": "dengeli düşünce", "mood": 6 },
    "ocd": { "obsession": "obsesyon", "compulsion": "kompulsiyon", "avoidance": [], "erpSuggestion": "öneri" }
  }
}

Dil: Türkçe, ton: empatik ve destekleyici.
`;

  const prompt = `${SYSTEM_PROMPT}\n\nKullanıcı girişi: "${text}"`;

  try {
    const startTime = Date.now();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: prompt }] 
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          topK: 40,
          topP: 0.95,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error (${response.status}):`, errorText);
      
      // Retry logic
      if (retryCount < 2 && (response.status === 429 || response.status >= 500)) {
        console.log(`Retrying... (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return analyzeWithGemini(text, retryCount + 1);
      }
      
      return null;
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Invalid Gemini API response format:', data);
      return null;
    }

    let analysisText = data.candidates[0].content.parts[0].text.trim();
    
    // JSON extract
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysisText = jsonMatch[0];
    }

    const analysisResult = JSON.parse(analysisText) as UnifiedAnalysisResult;
    
    // Metadata ekle
    analysisResult.metadata = {
      modelUsed: GEMINI_MODEL,
      processingTime,
      timestamp: new Date().toISOString()
    };

    return analysisResult;

  } catch (error) {
    console.error('Gemini analysis error:', error);
    
    if (retryCount < 2) {
      console.log(`Retrying due to error... (attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return analyzeWithGemini(text, retryCount + 1);
    }
    
    return null;
  }
}

/**
 * Fallback analizi - Gemini başarısız olursa basit kurallarla kategorize eder
 */
function getFallbackAnalysis(text: string): UnifiedAnalysisResult {
  const lowerText = text.toLowerCase();
  
  // Basit keyword matching
  const moodKeywords = ['üzgün', 'mutlu', 'kaygılı', 'stresli', 'yorgun', 'enerjik', 'heyecanlı', 'kızgın'];
  const cbtKeywords = ['düşünüyorum', 'sanıyorum', 'korkarım', 'endişeliyim', 'hissediyorum'];
  const ocdKeywords = ['kontrol', 'temizlik', 'sayma', 'düzen', 'takıntı', 'kompulsiyon'];
  const breathworkKeywords = ['nefes', 'rahatla', 'sakinleş', 'meditasyon', 'soluk'];

  let category: UnifiedAnalysisResult['category'] = 'UNKNOWN';
  let confidence = 0.3;

  if (moodKeywords.some(keyword => lowerText.includes(keyword))) {
    category = 'MOOD';
    confidence = 0.6;
  } else if (cbtKeywords.some(keyword => lowerText.includes(keyword))) {
    category = 'CBT';
    confidence = 0.6;
  } else if (ocdKeywords.some(keyword => lowerText.includes(keyword))) {
    category = 'OCD';
    confidence = 0.6;
  } else if (breathworkKeywords.some(keyword => lowerText.includes(keyword))) {
    category = 'BREATHWORK';
    confidence = 0.6;
  }

  return {
    category,
    confidence,
    summary: `Metin analiz edildi: "${text.substring(0, 50)}..."`,
    suggestions: [
      'Bu durumla ilgili daha fazla bilgi verirseniz size daha iyi yardımcı olabilirim.',
      'Hislerinizi daha detaylı anlatmaya çalışın.'
    ],
    insights: {},
    metadata: {
      modelUsed: 'fallback-heuristic',
      processingTime: 0,
      timestamp: new Date().toISOString()
    }
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Request validation
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST method allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Supabase client oluştur
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { authorization: authHeader },
        },
      }
    );

    // Request body parse FIRST
    const requestData: AnalysisRequest = await req.json();
    const { text, userId, analysisType = 'voice', context } = requestData;

    if (!text || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: text, userId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Basic Authorization Check (Development Mode)
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    if (!token || token.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token format' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For development: Allow test users and basic validation
    console.log(`🔐 Processing request for user: ${userId}`);
    
    // Basic token validation - just check if it looks like a JWT
    const isJWT = token.split('.').length === 3;
    if (!isJWT) {
      return new Response(
        JSON.stringify({ error: 'Token is not a valid JWT format' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Allow test users and proceed with analysis
    console.log(`✅ Authorization passed for user: ${userId}`);

    // ✅ F-10 FIX: Rate limiting check (ENV configurable, defaults: 50 req/10min)
    const isWithinLimit = await withinRateLimit(supabaseClient, userId);
    
    if (!isWithinLimit) {
      console.log(`🚨 Rate limit exceeded for user ${userId.substring(0, 8)}...`);
      
      // Get current config for telemetry and response
      const config = { windowMinutes: 10, maxRequests: 50 }; // Fallback for display
      try {
        config.windowMinutes = parseInt(Deno.env.get('RATE_LIMIT_WINDOW_MIN') || '10', 10);
        config.maxRequests = parseInt(Deno.env.get('RATE_LIMIT_MAX') || '50', 10);
      } catch (e) { /* use fallback */ }
      
      // Log rate limit hit for telemetry
      await logRateLimitHit(supabaseClient, userId, 'analyze-voice', config.maxRequests, config.maxRequests);
      
      // Return 429 rate limit response
      return createRateLimitResponse(corsHeaders, config.windowMinutes, config.maxRequests);
    }

    console.log(`Processing analysis request: ${analysisType} for user ${userId}`);

    // Gemini ile analiz yap
    let result = await analyzeWithGemini(text);
    
    // Fallback kullan
    if (!result) {
      console.log('Gemini analysis failed, using fallback');
      result = getFallbackAnalysis(text);
    }

    // Log telemetry (optional - isterseniz Supabase'e kayıt edebilirsiniz)
    try {
      await supabaseClient
        .from('ai_interactions')
        .insert({
          user_id: userId,
          input_text: text,
          analysis_result: result,
          processing_type: analysisType,
          context: context,
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log interaction:', logError);
      // Log hatası uygulamayı durdurmamalı
    }

    return new Response(
      JSON.stringify({
        success: true,
        result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
