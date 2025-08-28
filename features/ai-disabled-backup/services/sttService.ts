import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

export type STTRequest = {
  uri: string;
  languageCode: string; // e.g., 'tr-TR' | 'en-US'
  sampleRateHertz?: number;
  enablePunctuation?: boolean;
  maxAlternatives?: number;
};

export type STTResult = {
  text: string;
  confidence: number;
  alternatives?: { text: string; confidence?: number }[];
};

class STTService {
  async transcribe(req: STTRequest): Promise<STTResult | null> {
    // Try ElevenLabs first, then Google as fallback
    const elevenKey = (Constants.expoConfig?.extra?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string) || (process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY as string);
    if (elevenKey) {
      await trackAIInteraction(AIEventType.AI_PROVIDER_HEALTH_CHECK, { provider: 'elevenlabs', trying: true });
      const el = await this.elevenLabsTranscribe(req, elevenKey);
      if (el) {
        await trackAIInteraction(AIEventType.AI_PROVIDER_HEALTH_CHECK, { provider: 'elevenlabs', isHealthy: true });
        return el;
      }
    }

    const googleKey = (Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_STT_API_KEY as string) || (process.env.EXPO_PUBLIC_GOOGLE_STT_API_KEY as string);
    if (googleKey) {
      await trackAIInteraction(AIEventType.AI_PROVIDER_HEALTH_CHECK, { provider: 'google', trying: true });
      const g = await this.googleTranscribe(req, googleKey);
      if (g) {
        await trackAIInteraction(AIEventType.AI_PROVIDER_HEALTH_CHECK, { provider: 'google', isHealthy: true });
        return g;
      }
    }
    
    await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'missing_api_key' });
    return null;
  }

  private async elevenLabsTranscribe(req: STTRequest, apiKey: string): Promise<STTResult | null> {
    try {
      const form = new FormData();
      form.append('file', { uri: req.uri, name: 'audio.wav', type: 'audio/wav' } as any);
      form.append('model_id', 'eleven_multilingual_v2');
      form.append('language_code', req.languageCode || 'tr');
      const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: form as any,
      } as any);
      if (!res.ok) {
        await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'http_error_elevenlabs', status: res.status });
        return null;
      }
      const data = await res.json();
      const text: string = data?.text || data?.transcript || '';
      if (!text) {
        await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'no_transcript_elevenlabs' });
        return null;
      }
      return { text, confidence: 0.8 };
    } catch (e: any) {
      await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'exception_elevenlabs', message: e?.message || 'unknown' });
      return null;
    }
  }

  private async googleTranscribe(req: STTRequest, apiKey: string): Promise<STTResult | null> {
    try {
      console.log('🔍 Google STT Debug:', { uri: req.uri, languageCode: req.languageCode, apiKeyLength: apiKey.length });
      const base64Audio = await FileSystem.readAsStringAsync(req.uri, { encoding: FileSystem.EncodingType.Base64 });
      console.log('📁 Audio file read, base64 length:', base64Audio.length);
      console.log('🎵 Audio sample (first 100 chars):', base64Audio.substring(0, 100));
      console.log('🎵 Audio sample (last 100 chars):', base64Audio.substring(base64Audio.length - 100));
      
      const body = {
        config: {
          encoding: 'LINEAR16', // PCM 16-bit signed integer
          sampleRateHertz: 16000, // Google optimal rate
          languageCode: req.languageCode || 'tr-TR',
          enableAutomaticPunctuation: req.enablePunctuation ?? true,
          maxAlternatives: req.maxAlternatives ?? 3,
          model: 'latest_long' // Best for long-form audio
        },
        audio: {
          content: base64Audio
        }
      };
      
      const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;
      console.log('🌐 Making request to:', url.replace(apiKey, 'API_KEY_HIDDEN'));
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'ObsessLess/1.0'
        },
        body: JSON.stringify(body)
      });
      
      console.log('📡 Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.log('❌ Google STT Error Response:', errorText);
        await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'http_error', status: res.status, error: errorText });
        return null;
      }
      const data = await res.json();
      console.log('✅ Google STT Response:', JSON.stringify(data, null, 2));
      
      const first = data?.results?.[0]?.alternatives?.[0];
      if (!first?.transcript) {
        await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'no_transcript_google' });
        return null;
      }
      return {
        text: String(first.transcript),
        confidence: typeof first.confidence === 'number' ? first.confidence : 0.7,
        alternatives: (data?.results?.[0]?.alternatives || [])
          .slice(1)
          .map((a: any) => ({ text: String(a.transcript || ''), confidence: a.confidence }))
      };
    } catch (e: any) {
      console.log('💥 Google STT Exception:', e);
      await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'exception', message: e?.message || 'unknown' });
      return null;
    }
  }
}

export const sttService = new STTService();


