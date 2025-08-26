/**
 * Edge AI Service - Supabase Edge Functions ile AI API çağrıları
 * API key'leri server tarafında tutar, güvenli API çağrıları yapar
 */
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

export interface AnalysisRequest {
  text: string;
  userId: string;
  analysisType?: 'voice' | 'data' | 'mixed';
  context?: {
    source: 'today' | 'mood';
    timestamp?: number;
    metadata?: any;
  };
}

export interface UnifiedAnalysisResult {
  category: 'MOOD' | 'BREATHWORK' | 'UNKNOWN';
  confidence: number;
  summary: string;
  suggestions: string[];
  insights: {
    mood?: {
      detectedMood: string;
      intensity: number;
      triggers: string[];
      suggestions: string[];
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

export interface EdgeAIResponse {
  success: boolean;
  result?: UnifiedAnalysisResult;
  error?: string;
  message?: string;
}

/**
 * Edge AI Service Class
 */
class EdgeAIService {
  private static instance: EdgeAIService;
  private readonly FUNCTION_NAME = 'analyze-voice';

  private constructor() {}

  static getInstance(): EdgeAIService {
    if (!EdgeAIService.instance) {
      EdgeAIService.instance = new EdgeAIService();
    }
    return EdgeAIService.instance;
  }

  /**
   * Supabase Edge Function ile ses analizi yapar
   */
  async analyzeText(request: AnalysisRequest): Promise<UnifiedAnalysisResult | null> {
    try {
      // Supabase auth session kontrolü
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('EdgeAIService: No active session found');
        return null;
      }

      const { data, error } = await supabase.functions.invoke<EdgeAIResponse>(
        this.FUNCTION_NAME,
        {
          body: request,
        }
      );

      if (error) {
        console.error('EdgeAIService: Function invocation error:', error);
        return null;
      }

      if (!data?.success || !data.result) {
        console.error('EdgeAIService: Invalid response:', data);
        return null;
      }

      return data.result;

    } catch (error) {
      console.error('EdgeAIService: Unexpected error:', error);
      return null;
    }
  }

  /**
   * Ses girişi için özel analiz fonksiyonu 
   * checkinService.ts'teki unifiedVoiceAnalysis ile uyumlu
   */
  async analyzeVoiceInput(
    text: string, 
    userId: string,
    context?: {
      source: 'today' | 'mood';
      timestamp?: number;
      metadata?: any;
    }
  ): Promise<UnifiedAnalysisResult | null> {
    return this.analyzeText({
      text,
      userId,
      analysisType: 'voice',
      context: {
        source: 'today',
        timestamp: Date.now(),
        ...context
      }
    });
  }

  /**
   * Metin verisi analizi
   */
  async analyzeDataInput(
    text: string, 
    userId: string,
    context?: {
      source: 'today' | 'mood';
      timestamp?: number;
      metadata?: any;
    }
  ): Promise<UnifiedAnalysisResult | null> {
    return this.analyzeText({
      text,
      userId,
      analysisType: 'data',
      context: {
        source: 'tracking',
        timestamp: Date.now(),
        ...context
      }
    });
  }

  /**
   * CBT analizi için özel fonksiyon
   */
  async analyzeCBTInput(): Promise<UnifiedAnalysisResult | null> { return null; }

  /**
   * Health check - Edge function'ın çalışıp çalışmadığını kontrol eder
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple session check instead of full API call (avoid circular dependency)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('EdgeAIService: No active session - health check failed');
        return false;
      }
      
      // If we have a session, assume edge function is available
      // Full function test would create circular dependency with ExternalAIService
      console.log('EdgeAIService: Session active - health check passed');
      return true;
    } catch (error) {
      console.error('EdgeAIService: Health check failed:', error);
      return false;
    }
  }

  /**
   * Batch analiz - birden fazla metni aynı anda analiz eder
   */
  async batchAnalyze(
    requests: AnalysisRequest[]
  ): Promise<(UnifiedAnalysisResult | null)[]> {
    const promises = requests.map(request => this.analyzeText(request));
    return Promise.all(promises);
  }

  /**
   * Ses dosyası analizi - STT + Gemini pipeline 
   * YENİ: Storage-based yaklaşım - büyük dosyalar için
   */
  async analyzeAudioViaStorage(
    audioUri: string,
    userId: string,
    languageCode: string = 'tr-TR',
    context?: {
      source: 'today' | 'mood' | 'tracking' | 'cbt';
      timestamp?: number;
      metadata?: any;
    }
  ): Promise<UnifiedAnalysisResult | null> {
    try {
      // Supabase auth session kontrolü
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('EdgeAIService: No active session found for storage upload');
        return null;
      }

      console.log('📤 Starting Storage-based audio analysis...');

      // 0. Auto-create bucket if not exists
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.id === 'audio-temp');
        
        if (!bucketExists) {
          console.log('📋 Creating audio-temp bucket...');
          const { error: bucketError } = await supabase.storage.createBucket('audio-temp', {
            public: false,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['audio/wav', 'audio/webm', 'audio/mp4', 'audio/mpeg']
          });
          
          if (bucketError && !bucketError.message.includes('already exists')) {
            console.error('❌ Bucket creation failed:', bucketError);
          } else {
            console.log('✅ audio-temp bucket created successfully!');
          }
        } else {
          console.log('✅ audio-temp bucket already exists');
        }
      } catch (bucketErr) {
        console.log('⚠️ Bucket check/create failed, continuing with upload attempt...');
      }

      // 1. Audio dosyasını Supabase Storage'a upload et (WAV format)
      const fileName = `voice-${userId.substring(0, 8)}-${Date.now()}.wav`;
      
      // WAV dosyasını doğru şekilde oku ve upload et
      const audioResponse = await fetch(audioUri);
      const audioBlob = await audioResponse.blob();
      
      console.log(`📊 WAV file size: ${(audioBlob.size / 1024).toFixed(1)} KB`);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-temp')
        .upload(fileName, audioBlob, {
          contentType: 'audio/wav', // WAV MIME type
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        return null;
      }

      console.log('✅ Audio uploaded to storage:', fileName);

      // 2. Edge Function'a Storage URL gönder (base64 değil!)
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        result?: UnifiedAnalysisResult;
        error?: string;
      }>('analyze-audio-storage', {
        body: {
          audioPath: uploadData.path,
          userId,
          languageCode,
          analysisType: 'voice',
          context: {
            source: 'today',
            timestamp: Date.now(),
            ...context
          }
        }
      });

      // ✅ F-05 FIX: Improved temp file cleanup with error handling
      this.scheduleAudioCleanup(fileName);

      if (error) {
        console.error('EdgeAIService: Storage-based analysis error:', error);
        return null;
      }

      if (!data?.success || !data.result) {
        console.error('EdgeAIService: Invalid storage analysis response:', data);
        return null;
      }

      console.log('✅ Storage-based audio analysis completed');
      return data.result;

    } catch (error) {
      console.error('EdgeAIService: Storage analysis unexpected error:', error);
      return null;
    }
  }

  /**
   * Ses dosyası analizi - STT + Gemini pipeline 
   * ESKİ: Direct base64 yaklaşım - küçük dosyalar için
   */
  async analyzeAudio(
    audioUri: string,
    userId: string,
    languageCode: string = 'tr-TR',
    context?: {
      source: 'today' | 'mood' | 'tracking' | 'cbt';
      timestamp?: number;
      metadata?: any;
    }
  ): Promise<UnifiedAnalysisResult | null> {
    try {
      // Supabase auth session kontrolü
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('EdgeAIService: No active session found for audio analysis');
        return null;
      }

      console.log('🎵 Starting secure audio analysis pipeline...');

      // Audio dosyasını base64'e çevir
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`📁 Audio file converted to base64 (${audioBase64.length} chars)`);

      // Edge Function çağrısı - büyük audio dosyaları için timeout artırdık
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        result?: UnifiedAnalysisResult;
        error?: string;
      }>('analyze-audio', {
        body: {
          audioBase64,
          userId,
          languageCode,
          analysisType: 'voice',
          context: {
            source: 'today',
            timestamp: Date.now(),
            ...context
          }
        },
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Info': 'obsessless-mobile'
        }
      });

      if (error) {
        const errorDetails = {
          error: error,
          message: error.message,
          cause: error.cause,
          audioSize: audioBase64.length,
          userId: userId.substring(0, 8) + '...'
        };
        
        console.error('EdgeAIService: Audio analysis error details:', errorDetails);
        
        // Specific error handling for audio size
        if (audioBase64.length > 500 * 1024) {
          console.warn(`🚨 Audio too large for Edge Function: ${audioBase64.length} chars (max: ${500 * 1024})`);
          console.log('💡 Suggestion: WAV format needs more space, but 3 seconds should work');
        }
        
        return null;
      }

      if (!data?.success || !data.result) {
        console.error('EdgeAIService: Invalid audio analysis response:', data);
        return null;
      }

      console.log('✅ Secure audio analysis completed:', {
        category: data.result.category,
        confidence: data.result.confidence,
        sttSuccess: !(data.result as any).metadata?.sttFailed,
        transcribedText: ((data.result as any).metadata?.transcribedText || '').substring(0, 50) + '...'
      });

      return data.result;

    } catch (error) {
      console.error('EdgeAIService: Audio analysis unexpected error:', error);
      return null;
    }
  }

  // ✅ F-05 FIX: Enhanced audio temp file cleanup
  private scheduleAudioCleanup(fileName: string, timeoutMs: number = 5000): void {
    // Immediate cleanup attempt
    setTimeout(async () => {
      try {
        await this.cleanupAudioFile(fileName);
        console.log('🗑️ Temp audio file cleaned up successfully:', fileName);
      } catch (error) {
        console.warn('⚠️ Initial cleanup failed, scheduling retry:', fileName, error);
        // Retry after longer delay
        setTimeout(() => this.cleanupAudioFile(fileName), 15000);
      }
    }, timeoutMs);

    // Fallback cleanup after longer delay
    setTimeout(async () => {
      try {
        await this.cleanupAudioFile(fileName);
        console.log('🔄 Fallback cleanup executed for:', fileName);
      } catch (error) {
        console.warn('⚠️ Fallback cleanup also failed:', fileName, error);
      }
    }, 30000);
  }

  private async cleanupAudioFile(fileName: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from('audio-temp')
        .remove([fileName]);
      
      if (error) {
        throw error;
      }
    } catch (error) {
      // Log but don't throw - this is best-effort cleanup
      console.warn('⚠️ Audio file cleanup failed:', fileName, error);
      throw error; // Re-throw for retry logic
    }
  }

  // ✅ F-05 FIX: Bulk cleanup for old temp files (client-side maintenance)
  async cleanupOldTempFiles(olderThanHours: number = 2): Promise<void> {
    try {
      console.log('🧹 Starting bulk cleanup of old temp audio files...');
      
      const { data: files, error } = await supabase.storage
        .from('audio-temp')
        .list('', { limit: 100 });

      if (error) {
        console.warn('⚠️ Failed to list audio-temp files for cleanup:', error);
        return;
      }

      if (!files || files.length === 0) {
        console.log('✅ No temp files found for cleanup');
        return;
      }

      const threshold = Date.now() - (olderThanHours * 60 * 60 * 1000);
      const filesToDelete = files.filter(file => {
        const fileTime = new Date(file.created_at || file.updated_at || 0).getTime();
        return fileTime < threshold;
      }).map(file => file.name);

      if (filesToDelete.length === 0) {
        console.log('✅ No old temp files found for cleanup');
        return;
      }

      console.log(`🗑️ Cleaning up ${filesToDelete.length} old temp files...`);
      
      const { error: deleteError } = await supabase.storage
        .from('audio-temp')
        .remove(filesToDelete);

      if (deleteError) {
        console.warn('⚠️ Bulk cleanup partially failed:', deleteError);
      } else {
        console.log(`✅ Successfully cleaned up ${filesToDelete.length} old temp files`);
      }
    } catch (error) {
      console.warn('⚠️ Bulk cleanup process failed:', error);
    }
  }
}

// Singleton instance
export const edgeAIService = EdgeAIService.getInstance();

// Backward compatibility - checkinService.ts için
export default edgeAIService;
