import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

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
    const googleKey = (Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_STT_API_KEY as string) || (process.env.EXPO_PUBLIC_GOOGLE_STT_API_KEY as string);
    if (googleKey) {
      return this.googleTranscribe(req, googleKey);
    }
    // Not configured
    return null;
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
        throw new Error(`Google STT HTTP ${res.status}`);
      }
      const data = await res.json();
      const first = data?.results?.[0]?.alternatives?.[0];
      if (!first?.transcript) return null;
      return {
        text: String(first.transcript),
        confidence: typeof first.confidence === 'number' ? first.confidence : 0.7,
        alternatives: (data?.results?.[0]?.alternatives || [])
          .slice(1)
          .map((a: any) => ({ text: String(a.transcript || ''), confidence: a.confidence }))
      };
    } catch (e) {
      // Fail silently and let caller fallback
      return null;
    }
  }
}

export const sttService = new STTService();


