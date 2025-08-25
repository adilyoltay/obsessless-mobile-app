/**
 * Supabase Edge Function: Analyze Audio via Storage
 * 🚀 BÜYÜK DOSYALAR için: Storage URL üzerinden ses analizi
 * Avantaj: Base64 encoding yok, memory efficient
 * ✅ F-10 FIX: Added rate limiting (50 requests per 10 minutes per user)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withinRateLimit, createRateLimitResponse, logRateLimitHit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StorageAudioRequest {
  audioPath: string; // Storage path, not base64!
  userId: string;
  languageCode?: string;
  analysisType?: 'voice' | 'data' | 'mixed';
  context?: {
    source: 'today' | 'mood' | 'tracking' | 'cbt';
    timestamp?: number;
    metadata?: any;
  };
}

/**
 * Google STT ile Storage'dan audio dosyasını analiz eder
 */
async function transcribeStorageAudio(audioPath: string, languageCode: string = 'tr-TR'): Promise<any | null> {
  const STT_API_KEY = Deno.env.get('GOOGLE_STT_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!STT_API_KEY) {
    console.error('GOOGLE_STT_API_KEY environment variable is not set');
    return null;
  }

  try {
    // Supabase Service Role client (storage erişimi için)
    const supabaseAdmin = createClient(
      SUPABASE_URL ?? '',
      SUPABASE_SERVICE_ROLE_KEY ?? ''
    );

    console.log('📥 Downloading audio from storage:', audioPath);
    
    // Storage'dan audio dosyasını indir
    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('audio-temp')
      .download(audioPath);

    if (downloadError) {
      console.error('❌ Storage download error:', downloadError);
      return null;
    }

    // Audio data'yı base64'e çevir
    const audioBuffer = await audioData.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    
    console.log(`🎵 Audio downloaded, size: ${audioBase64.length} chars`);

    // Google STT API çağrısı
    const body = {
      config: {
        languageCode,
        enableAutomaticPunctuation: true,
        maxAlternatives: 3,
        model: 'latest_long',
        encoding: 'LINEAR16', 
        sampleRateHertz: 16000
      },
      audio: {
        content: audioBase64
      }
    };

    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${STT_API_KEY}`;
    console.log('🌐 Calling Google STT API...');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'ObsessLess-StorageEdgeFunction/1.0'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google STT API Error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('✅ Google STT API Response received');

    const firstResult = data?.results?.[0]?.alternatives?.[0];
    if (!firstResult?.transcript) {
      console.warn('⚠️ No transcript found in STT response');
      return null;
    }

    return {
      text: firstResult.transcript,
      confidence: firstResult.confidence || 0.8,
      alternatives: data.results?.[0]?.alternatives?.slice(1) || []
    };

  } catch (error) {
    console.error('❌ Storage STT transcription error:', error);
    return null;
  }
}

/**
 * Gemini ile analiz yap (mevcut fonksiyon)
 */
async function analyzeWithGemini(text: string, retryCount: number = 0): Promise<any | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set');
    return null;
  }

  const SYSTEM_PROMPT = `
Sen ObsessLess uygulamasının AI asistanısın. OKB ile mücadele eden kullanıcılara yardım ediyorsun.

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
    "mood": { "detectedMood": "kaygılı", "intensity": 7, "triggers": ["iş"], "suggestions": ["öneri"] }
  }
}

Dil: Türkçe, ton: empatik ve destekleyici.
`;

  const prompt = `${SYSTEM_PROMPT}\n\nKullanıcı girişi: "${text}"`;

  try {
    const startTime = Date.now();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          topK: 40,
          topP: 0.95,
        },
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid Gemini API response format');
      return null;
    }

    let analysisText = data.candidates[0].content.parts[0].text.trim();
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysisText = jsonMatch[0];
    }

    const analysisResult = JSON.parse(analysisText);
    analysisResult.metadata = {
      modelUsed: GEMINI_MODEL,
      processingTime,
      timestamp: new Date().toISOString()
    };

    return analysisResult;

  } catch (error) {
    console.error('❌ Gemini analysis error:', error);
    return null;
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST method allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token || token.length < 10 || token.split('.').length !== 3) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request body parse
    const requestData: StorageAudioRequest = await req.json();
    const { audioPath, userId, languageCode = 'tr-TR', analysisType = 'voice', context } = requestData;

    if (!audioPath || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: audioPath, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ F-10 FIX: Rate limiting check before expensive STT + Gemini processing (ENV configurable)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { authorization: authHeader },
        },
      }
    );
    
    const isWithinLimit = await withinRateLimit(supabaseClient, userId);
    
    if (!isWithinLimit) {
      console.log(`🚨 Rate limit exceeded for user ${userId.substring(0, 8)}... in analyze-audio-storage`);
      
      // Get current config for telemetry and response
      const config = { windowMinutes: 10, maxRequests: 50 }; // Fallback for display
      try {
        config.windowMinutes = parseInt(Deno.env.get('RATE_LIMIT_WINDOW_MIN') || '10', 10);
        config.maxRequests = parseInt(Deno.env.get('RATE_LIMIT_MAX') || '50', 10);
      } catch (e) { /* use fallback */ }
      
      // Log rate limit hit for telemetry
      await logRateLimitHit(supabaseClient, userId, 'analyze-audio-storage', config.maxRequests, config.maxRequests);
      
      // Return 429 rate limit response
      return createRateLimitResponse(corsHeaders, config.windowMinutes, config.maxRequests);
    }

    console.log(`🚀 Processing Storage audio analysis:`, {
      userId: userId.substring(0, 8) + '...',
      audioPath,
      languageCode,
      hasSTTKey: !!Deno.env.get('GOOGLE_STT_API_KEY'),
      hasGeminiKey: !!Deno.env.get('GEMINI_API_KEY')
    });

    const overallStartTime = Date.now();

    // Step 1: Storage-based STT
    console.log('📋 Step 1: Storage-based speech-to-text...');
    const sttResult = await transcribeStorageAudio(audioPath, languageCode);

    if (!sttResult || !sttResult.text) {
      console.warn('⚠️ Storage STT failed');
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            category: 'MOOD',
            confidence: 0.3,
            summary: 'Ses analizi başarısız oldu',
            suggestions: ['Lütfen tekrar deneyin'],
            insights: {},
            metadata: {
              modelUsed: 'fallback-heuristic',
              processingTime: 0,
              timestamp: new Date().toISOString(),
              sttFailed: true,
              totalProcessingTime: Date.now() - overallStartTime
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Storage STT Success: "${sttResult.text}" (confidence: ${sttResult.confidence})`);

    // Step 2: Gemini Analysis
    console.log('📋 Step 2: Analyzing text with Gemini...');
    let analysisResult = await analyzeWithGemini(sttResult.text);

    if (!analysisResult) {
      analysisResult = {
        category: 'MOOD',
        confidence: 0.6,
        summary: `Ses analizi tamamlandı: "${sttResult.text.substring(0, 50)}..."`,
        suggestions: ['Bu durumla ilgili daha fazla bilgi verebilirsiniz.'],
        insights: {}
      };
    }

    // Metadata ekle
    if (analysisResult.metadata) {
      analysisResult.metadata.transcribedText = sttResult.text;
      analysisResult.metadata.transcriptionConfidence = sttResult.confidence;
      analysisResult.metadata.totalProcessingTime = Date.now() - overallStartTime;
      analysisResult.metadata.storageProcessing = true;
    }

    console.log('✅ Complete Storage pipeline successful');

    return new Response(
      JSON.stringify({
        success: true,
        result: analysisResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Storage Edge function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
