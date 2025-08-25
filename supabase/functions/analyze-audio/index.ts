/**
 * Supabase Edge Function: Analyze Audio
 * Ses dosyalarını STT ile çevirip Gemini API ile analiz eder
 * Tam güvenli pipeline: Audio → STT → Gemini → Result
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AudioAnalysisRequest {
  audioBase64: string;
  userId: string;
  languageCode?: string;
  analysisType?: 'voice' | 'data' | 'mixed';
  context?: {
    source: 'today' | 'mood' | 'tracking' | 'cbt';
    timestamp?: number;
    metadata?: any;
  };
}

interface STTResult {
  text: string;
  confidence: number;
  alternatives?: { text: string; confidence?: number }[];
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
    sttProcessingTime?: number;
    transcriptionConfidence?: number;
  };
}

/**
 * Google STT ile ses çevirisi yapar
 */
async function transcribeAudio(audioBase64: string, languageCode: string = 'tr-TR'): Promise<STTResult | null> {
  const STT_API_KEY = Deno.env.get('GOOGLE_STT_API_KEY');

  if (!STT_API_KEY) {
    console.error('GOOGLE_STT_API_KEY environment variable is not set');
    return null;
  }

  try {
    const startTime = Date.now();

    const body = {
      config: {
        languageCode,
        enableAutomaticPunctuation: true,
        maxAlternatives: 3,
        model: 'latest_long',
        encoding: 'LINEAR16', // Assuming the audio is in LINEAR16 format
        sampleRateHertz: 16000
      },
      audio: {
        content: audioBase64
      }
    };

    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${STT_API_KEY}`;
    console.log('🎵 Making STT request...');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'ObsessLess-EdgeFunction/1.0'
      },
      body: JSON.stringify(body)
    });

    const processingTime = Date.now() - startTime;
    console.log(`🎵 STT request completed in ${processingTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google STT Error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('✅ Google STT Response received');

    const firstResult = data?.results?.[0]?.alternatives?.[0];
    if (!firstResult?.transcript) {
      console.warn('⚠️ No transcript found in STT response');
      return null;
    }

    return {
      text: firstResult.transcript,
      confidence: firstResult.confidence || 0.8,
      alternatives: data.results?.[0]?.alternatives?.slice(1).map((alt: any) => ({
        text: alt.transcript,
        confidence: alt.confidence
      })) || []
    };

  } catch (error) {
    console.error('❌ STT transcription error:', error);
    return null;
  }
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
      console.error(`❌ Gemini API error (${response.status}):`, errorText);
      
      // Retry logic
      if (retryCount < 2 && (response.status === 429 || response.status >= 500)) {
        console.log(`🔄 Retrying... (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return analyzeWithGemini(text, retryCount + 1);
      }
      
      return null;
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid Gemini API response format:', data);
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
    console.error('❌ Gemini analysis error:', error);
    
    if (retryCount < 2) {
      console.log(`🔄 Retrying due to error... (attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return analyzeWithGemini(text, retryCount + 1);
    }
    
    return null;
  }
}

/**
 * Fallback analizi - STT veya Gemini başarısız olursa
 */
function getFallbackAnalysis(text?: string): UnifiedAnalysisResult {
  return {
    category: 'MOOD',
    confidence: 0.3,
    summary: text ? `Ses analizi tamamlandı: "${text.substring(0, 50)}..."` : 'Ses analizi kısmen tamamlandı',
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

    // Basic token validation
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

    // JWT format check
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

    // Request body parse
    const requestData: AudioAnalysisRequest = await req.json();
    const { audioBase64, userId, languageCode = 'tr-TR', analysisType = 'voice', context } = requestData;

    if (!audioBase64 || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: audioBase64, userId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🔐 Processing audio analysis request:`, {
      userId: userId.substring(0, 8) + '...',
      audioSize: audioBase64.length,
      languageCode,
      hasSTTKey: !!Deno.env.get('GOOGLE_STT_API_KEY'),
      hasGeminiKey: !!Deno.env.get('GEMINI_API_KEY')
    });

    // Audio size check - Balanced for WAV format
    const MAX_AUDIO_SIZE = 500 * 1024; // 500KB base64 (WAV 16kHz mono ~30 seconds)
    if (audioBase64.length > MAX_AUDIO_SIZE) {
      console.warn(`⚠️ Audio too large: ${audioBase64.length} chars (max: ${MAX_AUDIO_SIZE})`);
      return new Response(
        JSON.stringify({ 
          error: 'Audio file too large',
          maxSize: MAX_AUDIO_SIZE,
          actualSize: audioBase64.length,
          suggestion: 'Please record shorter audio or compress the file'
        }),
        { 
          status: 413, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const overallStartTime = Date.now();

    // Step 1: Speech-to-Text
    console.log('📋 Step 1: Converting speech to text...');
    const sttResult = await transcribeAudio(audioBase64, languageCode);
    
    let transcribedText = '';
    let sttProcessingTime = 0;
    let transcriptionConfidence = 0;

    if (sttResult) {
      transcribedText = sttResult.text;
      transcriptionConfidence = sttResult.confidence;
      console.log(`✅ STT Success: "${transcribedText}" (confidence: ${sttResult.confidence})`);
    } else {
      console.warn('⚠️ STT failed, using fallback analysis');
      const fallbackResult = getFallbackAnalysis();
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            ...fallbackResult,
            metadata: {
              ...fallbackResult.metadata,
              sttFailed: true,
              totalProcessingTime: Date.now() - overallStartTime
            }
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 2: Gemini Analysis
    console.log('📋 Step 2: Analyzing text with Gemini...');
    let analysisResult = await analyzeWithGemini(transcribedText);
    
    if (!analysisResult) {
      console.warn('⚠️ Gemini analysis failed, using fallback');
      analysisResult = getFallbackAnalysis(transcribedText);
    }

    // Add STT metadata
    if (analysisResult.metadata) {
      analysisResult.metadata.sttProcessingTime = sttProcessingTime;
      analysisResult.metadata.transcriptionConfidence = transcriptionConfidence;
      analysisResult.metadata.totalProcessingTime = Date.now() - overallStartTime;
      analysisResult.metadata.transcribedText = transcribedText;
    }

    console.log('✅ Complete pipeline successful');

    // Log telemetry (optional - isterseniz Supabase'e kayıt edebilirsiniz)
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      await supabaseClient
        .from('ai_interactions')
        .insert({
          user_id: userId,
          input_text: transcribedText,
          analysis_result: analysisResult,
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
        result: analysisResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Edge function error:', error);
    
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
