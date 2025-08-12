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
    const elevenKey = (Constants.expoConfig?.extra?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string) || (process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY as string);
    if (elevenKey) {
      const el = await this.elevenLabsTranscribe(req, elevenKey);
      if (el) return el;
    }
    const googleKey = (Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_STT_API_KEY as string) || (process.env.EXPO_PUBLIC_GOOGLE_STT_API_KEY as string);
    if (googleKey) {
      return this.googleTranscribe(req, googleKey);
    }
    await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'missing_api_key' });
    return null;
  }

  private async elevenLabsTranscribe(req: STTRequest, apiKey: string): Promise<STTResult | null> {
    try {
      const base64Audio = await FileSystem.readAsStringAsync(req.uri, { encoding: FileSystem.EncodingType.Base64 });
      const blob = Buffer.from(base64Audio, 'base64');
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
        await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'no_transcript' });
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
      const base64Audio = await FileSystem.readAsStringAsync(req.uri, { encoding: FileSystem.EncodingType.Base64 });
      const body = {
        config: {
          encoding: 'LINEAR16',
          languageCode: req.languageCode || 'tr-TR',
          enableAutomaticPunctuation: req.enablePunctuation ?? true,
          sampleRateHertz: req.sampleRateHertz ?? 44100,
          maxAlternatives: req.maxAlternatives ?? 3,
          model: 'latest_long'
        },
        audio: {
          content: base64Audio
        }
      };
      const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'http_error', status: res.status });
        return null;
      }
      const data = await res.json();
      const first = data?.results?.[0]?.alternatives?.[0];
      if (!first?.transcript) {
        await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'no_transcript' });
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
      await trackAIInteraction(AIEventType.STT_FAILED, { reason: 'exception', message: e?.message || 'unknown' });
      return null;
    }
  }
}

export const sttService = new STTService();


